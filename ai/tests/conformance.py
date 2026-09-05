"""The adapter-agnostic conformance suite (spec 001, AC10).

This is the payoff of writing the contract first. It takes **any** :class:`HarnessAdapter`, drives
it, and asserts that what it emits is a valid stream. A new harness proves itself by being passed
to this function — not by editing it.

Spec 002 runs it against a replay adapter fed by streams recorded from real Foundry runs. Phase 4
runs the same function, unchanged, against the LangGraph harness.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from harness._shared.contract import AgentEvent, HarnessAdapter, check_stream

__all__ = ["collect_stream", "run_conformance"]


async def collect_stream(
    adapter: HarnessAdapter,
    messages: list[Mapping[str, Any]] | None = None,
    conversation_state: Mapping[str, Any] | None = None,
) -> list[Any]:
    """Drive ``adapter`` once and collect everything it emits, without judging it."""
    return [
        event async for event in adapter.stream_response(messages or [], conversation_state or {})
    ]


async def run_conformance(
    adapter: HarnessAdapter,
    messages: list[Mapping[str, Any]] | None = None,
    conversation_state: Mapping[str, Any] | None = None,
) -> list[AgentEvent]:
    """Assert that ``adapter`` is a conforming harness, and return the stream it produced.

    Raises :class:`TypeError` if the object is not a :class:`HarnessAdapter`,
    :class:`~harness._shared.contract.ContractError` if it emits a malformed event, and
    :class:`~harness._shared.contract.ConformanceError` if the sequence is not a valid stream.
    """
    if not isinstance(adapter, HarnessAdapter):
        raise TypeError(
            f"{type(adapter).__name__} does not satisfy HarnessAdapter: it must provide "
            "stream_response, submit_tool_output and voice_attachment_params"
        )
    return check_stream(await collect_stream(adapter, messages, conversation_state))
