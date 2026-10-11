"""The prompt-agent harness: Foundry runs the agent loop, we answer its tool calls.

One call to :meth:`PromptAgentAdapter.stream_response` yields **one complete turn** — which may
involve several round trips to Foundry, because a turn pauses every time the agent asks us to run
a function tool.

Why the loop lives here rather than in the BFF's router: the §9 contract promises that a harness
stream always terminates, and the spec 001 conformance suite checks exactly that. If the router
owned the loop, this method would yield a *fragment* ending without a terminal whenever the agent
was waiting on tool output, and the invariant would be unverifiable against a real adapter.

Tool execution is **injected**, so `ai/` never imports `backend/`, and the LangGraph harness
gets the
same loop shape. §8 is intact: this code executes what Foundry asked for; it chooses nothing.

Three guarantees, in order of how much damage they prevent:

1. **Every executed call's output gets a submission leg.** The last execution leg reserves one
   more request on the same conversation; a local ``tool_result`` alone is not a receipt.
2. **Failure is explicit.** Transport failure or cancellation can prevent delivery. New requests
   on the settlement leg remain unanswered, unexecuted, and end in ``turn_limit_exceeded``.
3. **The loop is capped.** ``max_turns`` execution legs (default 8) plus at most one settlement
   leg: at most 9 upstream requests by default, with no recursive settlement or retry.

**The Foundry client is synchronous, and that is a streaming problem.** Iterating it directly
inside this async generator blocks the event loop between events, so the server never gets to flush
the frames it has already been handed and the whole turn lands on the browser at once. Measured
2026-09-15: Foundry sent 76 reasoning deltas over 1.35s and 78 text deltas over 0.8s; the browser
received all of them in one burst. Each `next()` therefore runs in a worker thread — see
:meth:`PromptAgentAdapter._stream_events`.

**A leg's terminal is not the turn's terminal.** Observed 2026-09-15 and recorded in
`tests/fixtures/recorded/prompt-agent-turn-20260915.jsonl`: Foundry does not hold the stream open
while it waits for tool output. It emits the function calls, says ``response.completed`` — with the
usage for that leg — and waits for a *new* request carrying the outputs. Forwarding that straight
through would put ``done`` in the middle of the turn and two ``usage`` events in it, both of which
the §9 contract forbids. So ``usage`` is accumulated across legs and ``done`` is held until the
turn really ends.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Callable, Iterable, Mapping
from contextlib import aclosing
from typing import Any

from harness._shared.contract import AgentEvent, VoiceAttachment
from harness._shared.event_diagnostics import EventDiagnostics
from harness._shared.streaming import stream_items
from harness.prompt_agent.events import convert

__all__ = ["PromptAgentAdapter"]

# (name, arguments) -> (output_json, duration_ms, error_or_None). Never raises.
Executor = Callable[[str, str], tuple[str, int, str | None]]
# (inputs, conversation_state) -> raw Foundry stream events
StreamFactory = Callable[[list[Mapping[str, Any]], Mapping[str, Any]], Iterable[Mapping[str, Any]]]

DEFAULT_MAX_TURNS = 8


class PromptAgentAdapter:
    """Streams a Foundry prompt agent as `AgentEvent`s, answering its function calls."""

    def __init__(
        self,
        stream_factory: StreamFactory,
        executor: Executor,
        agent_name: str,
        project_name: str,
        agent_version: str | None = None,
    ) -> None:
        self._stream_factory = stream_factory
        self._executor = executor
        self._agent_name = agent_name
        self._project_name = project_name
        self._agent_version = agent_version
        self.max_turns = DEFAULT_MAX_TURNS

    async def stream_response(
        self, messages: list[Mapping[str, Any]], conversation_state: Mapping[str, Any]
    ) -> AsyncIterator[AgentEvent]:
        """Yield one complete, contract-conforming turn."""
        inputs: list[Mapping[str, Any]] = list(messages)
        totals: dict[str, int] = {}
        done: AgentEvent | None = None
        max_turns = self.max_turns
        diagnostics = EventDiagnostics("prompt_agent")

        try:
            if max_turns <= 0:
                yield {
                    "type": "error",
                    "message": "the execution budget permits no turns; no request was sent",
                    "code": "turn_limit_exceeded",
                }
                return

            # Reserve one submission leg so the final execution never strands its outputs.
            for turn in range(max_turns + 1):
                pending: list[tuple[str, str, str]] = []
                terminated = False

                async with aclosing(
                    self._stream_events(inputs, conversation_state, diagnostics)
                ) as leg:
                    async for event in leg:
                        if event["type"] == "tool_call" and event["executor"] == "app":
                            pending.append((event["call_id"], event["name"], event["arguments"]))
                        if event["type"] == "usage":
                            for key, value in event.items():
                                if key != "type":
                                    totals[key] = totals.get(key, 0) + int(value)  # type: ignore[arg-type]
                            continue
                        if event["type"] == "done":
                            terminated = True
                            done = event
                            continue
                        if event["type"] == "error":
                            yield event
                            return
                        yield event
                if not pending:
                    if terminated and done is not None:
                        # The turn really is over: release what was held back across the legs.
                        if totals:
                            yield {"type": "usage", **totals}  # type: ignore[misc]
                        yield done
                    else:
                        # Foundry stopped without saying it completed and asked for nothing. That is
                        # an anomaly, not a success, so it terminates as an error — dressing it up
                        # as `done` would also mean emitting an empty response_id and leaving the
                        # trace drawer with nothing to query.
                        yield {
                            "type": "error",
                            "message": (
                                "the model stream ended without a completion event and without "
                                "requesting a tool"
                            ),
                            "code": "stream_ended_without_terminal",
                        }
                    return

                if turn == max_turns:
                    yield {
                        "type": "error",
                        "message": (
                            f"the agent requested more tools after {max_turns} execution turns "
                            "and one output-settlement leg; the settlement leg's tool calls "
                            "were not executed or answered; stopping at the protocol budget"
                        ),
                        "code": "turn_limit_exceeded",
                    }
                    return

                # Answer every collected call, then feed the outputs back as the next leg.
                inputs = []
                for call_id, name, arguments in pending:
                    # In a worker thread, for the reason `_stream_events` explains about the
                    # Foundry stream: this is the OTHER blocking call on the turn's path, and
                    # the longer one. `search_web` is an HTTP round trip to a third party, and
                    # holding the loop through it stops every other stream this process is
                    # serving (tests/test_adapter_concurrency.py).
                    output, duration_ms, error = await asyncio.to_thread(
                        self._executor, name, arguments
                    )
                    result: dict[str, Any] = {
                        "type": "tool_result",
                        "call_id": call_id,
                        "name": name,
                        "output": output,
                        "duration_ms": duration_ms,
                    }
                    if error:
                        result["error"] = error
                    yield result  # type: ignore[misc]
                    inputs.append(
                        {
                            "type": "function_call_output",
                            "call_id": call_id,
                            "output": output,
                        }
                    )

        except Exception as exc:  # noqa: BLE001 - a terminal event is a promise (§9)
            yield {
                "type": "error",
                "message": f"{type(exc).__name__}: {exc}",
                "code": "harness_error",
            }

        finally:
            diagnostics.flush()

    async def _stream_events(
        self,
        inputs: list[Mapping[str, Any]],
        conversation_state: Mapping[str, Any],
        diagnostics: EventDiagnostics,
    ) -> AsyncIterator[AgentEvent]:
        """One leg of the turn, as contract events, without holding the event loop.

        The stream factory is a **synchronous** iterable — that is what the Foundry SDK gives us —
        so every `next()` is a blocking network read. Run inline it would freeze the loop between
        events, and frames that are already encoded would sit unflushed until the turn ended. One
        `to_thread` per event keeps the loop free to write them as they arrive; ordering is
        unaffected, because the awaits are sequential.
        """
        async with aclosing(
            stream_items(lambda: self._stream_factory(inputs, conversation_state))
        ) as raw_events:
            async for raw in raw_events:
                for event in convert(raw, diagnostics=diagnostics):
                    yield event

    async def submit_tool_output(
        self, call_id: str, output: str, conversation_state: Mapping[str, Any]
    ) -> None:
        """Not used by this harness — the loop in :meth:`stream_response` owns the round trip.

        The method exists because it is part of the §9 Protocol, and a harness that streams legs
        instead of whole turns would need it. Raising here is honest: silently doing nothing would
        let a caller believe an output had been submitted when it had not (§5).
        """
        raise NotImplementedError(
            "PromptAgentAdapter answers function calls inside its own loop; "
            "submit_tool_output is not part of its flow."
        )

    def voice_attachment_params(self) -> VoiceAttachment:
        """Attach Voice Live to the same agent — one definition, two modalities."""
        params: dict[str, Any] = {
            "agent_name": self._agent_name,
            "project_name": self._project_name,
        }
        if self._agent_version:
            params["agent_version"] = self._agent_version
        return params  # type: ignore[return-value]


def build_inputs_from_messages(messages: list[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    """Helper for the production stream factory: user turns as Responses input items."""
    return [
        {"type": "message", "role": m.get("role", "user"), "content": m["content"]}
        for m in messages
    ]


def json_dumps(value: Any) -> str:
    """Compact JSON, used when building function_call_output payloads."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
