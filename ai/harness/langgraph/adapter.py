"""SCAFFOLD ONLY — the LangGraph harness is not implemented.

This module exists so the intended shape is visible and so `AGENT_HARNESS=langgraph` fails loudly
rather than mysteriously. It satisfies :class:`HarnessAdapter` structurally — every method is
present — and every method raises. Constitution §5: a scaffold says it is a scaffold; it does not
pretend to work.

The design it will implement is documented in README.md. When it is built, it proves itself by being
passed to the **existing** conformance suite:

    from tests.conformance import run_conformance
    await run_conformance(LangGraphAdapter(...))

No test is edited to accommodate it. That is the point of spec 001.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from typing import Any

from harness._shared.contract import AgentEvent, VoiceAttachment

_NOT_BUILT = (
    "The LangGraph harness is a documented scaffold, not an implementation. "
    "See ai/harness/langgraph/README.md for the intended design, and PLAN.md Phase 4. "
    "Set AGENT_HARNESS=prompt-agent to use the harness that exists."
)


class LangGraphAdapter:
    """Planned: a LangGraph graph packaged as a Foundry hosted agent container."""

    def __init__(self, **_: Any) -> None:
        raise NotImplementedError(_NOT_BUILT)

    def stream_response(
        self, messages: list[Mapping[str, Any]], conversation_state: Mapping[str, Any]
    ) -> AsyncIterator[AgentEvent]:
        raise NotImplementedError(_NOT_BUILT)

    async def submit_tool_output(
        self, call_id: str, output: str, conversation_state: Mapping[str, Any]
    ) -> None:
        raise NotImplementedError(_NOT_BUILT)

    def voice_attachment_params(self) -> VoiceAttachment:
        raise NotImplementedError(_NOT_BUILT)
