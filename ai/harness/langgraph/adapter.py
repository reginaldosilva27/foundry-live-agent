"""The hosted-agent harness: our container runs the agent loop, we only watch.

One call to :meth:`LangGraphAdapter.stream_response` yields **one complete turn**, from **one**
request. That is the whole difference from `PromptAgentAdapter`, and it is worth stating plainly
because the asymmetry is the finding spec 018 exists to produce:

    prompt agent   Foundry emits a function call and STOPS. The BFF runs the tool, submits the
                   output on a second request bound to the same conversation, and Foundry resumes.
                   Two legs, two `response.completed`, usage summed, `done` held back. An
                   unanswered call hangs the run for ten minutes.

    hosted agent   The container runs its own tools. Every `function_call` arrives already paired
                   with its `function_call_output`. One leg, one `response.completed`, nothing to
                   answer, nothing to accumulate — so there is no loop here at all.

Observed 2026-09-16 and recorded in `tests/fixtures/recorded/langgraph-hosted-*.jsonl`.

**§8 is intact, and this file is where the amended wording earns its keep.** The agent loop for this
harness is real and it is in this repository — in `agent/graph.py`, which is deployed to Foundry and
runs in a sandbox Foundry provisions. This module is the *adapter*: imported by the BFF, it opens a
stream and normalises it. It chooses no tool, re-prompts nothing, and keeps no state the platform
owns. Swap the harness and the BFF still is not choosing tools.

**The Foundry client is synchronous, and that is a streaming problem** — the same one
`PromptAgentAdapter` documents. Iterating it inside this async generator would block the event loop
between events and land the whole turn on the browser at once, so each `next()` runs in a worker
thread.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable, Iterable, Mapping
from contextlib import aclosing
from typing import Any

from harness._shared.contract import AgentEvent, VoiceAttachment
from harness._shared.event_diagnostics import EventDiagnostics
from harness._shared.streaming import stream_items
from harness.langgraph.events import Normaliser

__all__ = ["LangGraphAdapter"]

# (messages, conversation_state) -> raw hosted-agent Responses stream events
StreamFactory = Callable[[list[Mapping[str, Any]], Mapping[str, Any]], Iterable[Mapping[str, Any]]]


class LangGraphAdapter:
    """Streams a Foundry **hosted agent** as `AgentEvent`s. A LangGraph graph in a container."""

    def __init__(
        self,
        stream_factory: StreamFactory,
        agent_name: str,
        project_name: str,
        agent_version: str | None = None,
    ) -> None:
        self._stream_factory = stream_factory
        self._agent_name = agent_name
        self._project_name = project_name
        self._agent_version = agent_version

    async def stream_response(
        self, messages: list[Mapping[str, Any]], conversation_state: Mapping[str, Any]
    ) -> AsyncIterator[AgentEvent]:
        """Yield one complete, contract-conforming turn.

        Two guarantees, and the third the prompt agent needs is absent because nothing here can
        leave a call unanswered:

        1. **The stream always terminates.** If the container or the service explodes, the last
           thing out is an ``error`` — a terminal event is a promise (§9).
        2. **No `done` is emitted twice.** The container sends one `response.completed`; the
           normaliser turns it into `trace_ids` + `done` and the generator stops.
        """
        normaliser = Normaliser()
        diagnostics = EventDiagnostics("langgraph")
        terminated = False

        try:
            async with aclosing(
                stream_items(lambda: self._stream_factory(messages, conversation_state))
            ) as raw_events:
                async for raw in raw_events:
                    for event in normaliser.convert(raw, diagnostics=diagnostics):
                        yield event
                        if event["type"] in {"done", "error"}:
                            terminated = True
                            return

            if not terminated:
                # The container stopped without completing. Dressing that up as `done` would mean
                # emitting an empty response_id and leaving the trace panel nothing to query.
                yield {
                    "type": "error",
                    "message": (
                        "the hosted agent's stream ended without a completion event; the container "
                        "may have been evicted mid-turn"
                    ),
                    "code": "stream_ended_without_terminal",
                }
        except Exception as exc:  # noqa: BLE001 - a terminal event is a promise (§9)
            yield {
                "type": "error",
                "message": f"{type(exc).__name__}: {exc}",
                "code": "harness_error",
            }

        finally:
            diagnostics.flush()

    async def submit_tool_output(
        self, call_id: str, output: str, conversation_state: Mapping[str, Any]
    ) -> None:
        """Never reached on this harness's request path — the container answers its own calls.

        Present because it is part of the §9 Protocol. Raising is honest: silently doing nothing
        would let a caller believe an output had been submitted when it had not (§5). Unlike the
        prompt agent, where this exists for a hypothetical leg-streaming harness, here it is
        structurally unreachable — no `tool_call` this adapter emits carries ``executor="app"``,
        and `check_stream` only ever asks the app to answer those.
        """
        raise NotImplementedError(
            "The hosted agent executes its own tools inside the container; nothing is ever "
            "submitted back to it."
        )

    def voice_attachment_params(self) -> VoiceAttachment:
        """Attach Voice Live to the same hosted agent — verified 2026-09-16 (AC9).

        Voice Live attaches **by name**, so a hosted agent works exactly as a prompt agent does:
        the session reports the hosted agent as its `model` and echoes its definition. Nothing
        here is harness-specific beyond which agent is named.
        """
        params: dict[str, Any] = {
            "agent_name": self._agent_name,
            "project_name": self._project_name,
        }
        if self._agent_version:
            params["agent_version"] = self._agent_version
        return params  # type: ignore[return-value]
