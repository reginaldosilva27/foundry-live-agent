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

1. **Every collected call is answered.** An unanswered function call leaves Foundry waiting until
   the run expires ten minutes later, and the browser sees a stream that merely stops.
2. **The stream always terminates.** If Foundry explodes, the last thing out is an ``error``.
3. **The loop is capped.** A pathological agent ends with an ``error``, not an infinite stream.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Callable, Iterable, Mapping
from typing import Any

from harness._shared.contract import AgentEvent, VoiceAttachment
from harness.prompt_agent.events import normalise

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

        try:
            for _turn in range(self.max_turns):
                pending: list[tuple[str, str, str]] = []
                terminated = False

                for event in normalise(self._stream_factory(inputs, conversation_state)):
                    if event["type"] == "tool_call" and event["executor"] == "app":
                        pending.append((event["call_id"], event["name"], event["arguments"]))
                    if event["type"] in {"done", "error"}:
                        terminated = True
                    yield event

                if not pending:
                    if not terminated:
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

                # Answer every collected call, then feed the outputs back as the next leg.
                inputs = []
                for call_id, name, arguments in pending:
                    output, duration_ms, error = self._executor(name, arguments)
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

            yield {
                "type": "error",
                "message": (
                    f"the agent did not finish within {self.max_turns} turns; "
                    "stopping rather than streaming indefinitely"
                ),
                "code": "turn_limit_exceeded",
            }
        except Exception as exc:  # noqa: BLE001 - a terminal event is a promise (§9)
            yield {
                "type": "error",
                "message": f"{type(exc).__name__}: {exc}",
                "code": "harness_error",
            }

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
