"""Foundry Responses stream -> `AgentEvent`.

Constitution §10 forbids writing a Foundry integration from memory. Some of these event names have
been **observed** coming out of Foundry; the rest are inferred from documented payload shapes and
have not yet been seen on the wire. That difference is tracked, not hidden:

- :data:`MAPPINGS` records every raw event type with a ``verified`` flag and a note.
- ``verified=True`` means *this project watched Foundry emit it*, with a date.
- :func:`mapping_report` surfaces the split, and ``GET /config`` exposes it, so a reader can see how
  much of the normaliser is still inference.
- A test asserts no mapping is marked verified unless it is in the observed set, so the flags cannot
  drift into optimism.

The unverified half exists because the spike run on 2026-09-04 reached
``response.mcp_list_tools.completed`` and then died on a gateway 404 (the reference environment has
no model deployment, and the connection's Base URL stops one segment short). Finish that run and the
flags move.

Unrecognised events are **counted**, not silently dropped — see :func:`unmapped_types`. An event
Foundry starts sending that we ignore is exactly the kind of thing that should be visible.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass
from typing import Any

from harness._shared.contract import AgentEvent

__all__ = ["MAPPINGS", "EventMapping", "mapping_report", "normalise", "unmapped_types"]


@dataclass(frozen=True)
class EventMapping:
    """One raw Foundry event type and what we do with it."""

    raw_type: str
    produces: str
    verified: bool
    note: str


# Observed 2026-09-04 against proj-default, agent `spike-byom`. See docs/REFERENCES.md.
_OBSERVED = "observed 2026-09-04"
_INFERRED = "NOT yet observed — inferred from documented payload shape"

MAPPINGS: tuple[EventMapping, ...] = (
    EventMapping("response.created", "—", True, f"{_OBSERVED}; lifecycle noise, ignored"),
    EventMapping("response.in_progress", "—", True, f"{_OBSERVED}; lifecycle noise, ignored"),
    EventMapping(
        "response.output_item.added", "—", True, f"{_OBSERVED}; the item is empty until .done"
    ),
    EventMapping(
        "response.mcp_list_tools.in_progress", "—", True, f"{_OBSERVED}; MCP setup, not a call"
    ),
    EventMapping(
        "response.mcp_list_tools.completed", "—", True, f"{_OBSERVED}; MCP setup, not a call"
    ),
    EventMapping("response.output_text.delta", "text_delta", False, _INFERRED),
    EventMapping("response.reasoning_summary_text.delta", "reasoning_summary", False, _INFERRED),
    EventMapping("response.function_call_arguments.delta", "—", False, f"{_INFERRED}; partial"),
    EventMapping(
        "response.function_call_arguments.done", "—", False, f"{_INFERRED}; see item.done"
    ),
    EventMapping(
        "response.output_item.done", "tool_call", False, f"{_INFERRED}; function_call item"
    ),
    EventMapping("response.mcp_call.completed", "mcp_call", False, _INFERRED),
    EventMapping("response.mcp_call.failed", "mcp_call", False, _INFERRED),
    EventMapping("response.completed", "usage+trace_ids+done", False, _INFERRED),
    EventMapping("response.failed", "error", False, _INFERRED),
    EventMapping("response.incomplete", "error", False, _INFERRED),
    EventMapping("error", "error", False, _INFERRED),
)

_KNOWN: frozenset[str] = frozenset(m.raw_type for m in MAPPINGS)
_IGNORED: frozenset[str] = frozenset(m.raw_type for m in MAPPINGS if m.produces == "—")


def normalise(raw_events: Iterable[Mapping[str, Any]]) -> Iterator[AgentEvent]:
    """Convert raw Foundry stream events into contract events.

    A single raw event may produce zero (lifecycle noise), one, or three (``response.completed``
    yields usage, trace ids and the terminal).
    """
    for raw in raw_events:
        yield from _convert(raw)


def _convert(raw: Mapping[str, Any]) -> Iterator[AgentEvent]:
    etype = raw.get("type", "")

    if etype in _IGNORED or etype not in _KNOWN:
        return

    if etype == "response.output_text.delta":
        if text := raw.get("delta", ""):
            yield {"type": "text_delta", "text": text}
        return

    if etype == "response.reasoning_summary_text.delta":
        if text := raw.get("delta", ""):
            yield {"type": "reasoning_summary", "text": text}
        return

    if etype == "response.output_item.done":
        item = raw.get("item") or {}
        if item.get("type") == "function_call":
            # executor="app": Foundry emitted this and is now WAITING. See contract.check_stream.
            yield {
                "type": "tool_call",
                "call_id": item["call_id"],
                "name": item["name"],
                "arguments": item.get("arguments") or "{}",
                "executor": "app",
            }
        return

    if etype.startswith("response.mcp_call."):
        item = raw.get("item") or {}
        event: dict[str, Any] = {
            "type": "mcp_call",
            "server_label": item.get("server_label", "unknown"),
            "name": item.get("name", "unknown"),
            "arguments": item.get("arguments") or "{}",
        }
        if (output := item.get("output")) is not None:
            event["output"] = output
        if etype.endswith(".failed"):
            event["error"] = str(item.get("error") or "mcp call failed")
        yield event  # type: ignore[misc]
        return

    if etype == "response.completed":
        response = raw.get("response") or {}
        if usage := response.get("usage"):
            emitted: dict[str, Any] = {
                "type": "usage",
                "input_tokens": int(usage.get("input_tokens", 0)),
                "output_tokens": int(usage.get("output_tokens", 0)),
            }
            details = usage.get("output_tokens_details") or {}
            if (reasoning := details.get("reasoning_tokens")) is not None:
                emitted["reasoning_tokens"] = int(reasoning)
            yield emitted  # type: ignore[misc]

        trace: dict[str, Any] = {"type": "trace_ids", "response_id": response.get("id", "")}
        if conversation := response.get("conversation"):
            trace["conversation_id"] = (
                conversation if isinstance(conversation, str) else conversation.get("id", "")
            )
        yield trace  # type: ignore[misc]
        yield {"type": "done", "response_id": response.get("id", "")}
        return

    if etype in {"response.failed", "response.incomplete", "error"}:
        detail = (raw.get("response") or {}).get("error") or raw
        error: dict[str, Any] = {
            "type": "error",
            "message": str(detail.get("message") or "the run failed"),
        }
        if code := detail.get("code"):
            error["code"] = str(code)
        yield error  # type: ignore[misc]


def unmapped_types(raw_events: Iterable[Mapping[str, Any]]) -> dict[str, int]:
    """Count raw event types this normaliser does not know about.

    Surfaced rather than swallowed: an event Foundry begins sending that we ignore should show up
    somewhere a human looks.
    """
    counts: dict[str, int] = {}
    for raw in raw_events:
        etype = raw.get("type", "")
        if etype not in _KNOWN:
            counts[etype] = counts.get(etype, 0) + 1
    return counts


def mapping_report() -> dict[str, Any]:
    """How much of the mapping is observed versus inferred. Exposed by ``GET /config``."""
    verified = [m.raw_type for m in MAPPINGS if m.verified]
    return {
        "total": len(MAPPINGS),
        "verified": len(verified),
        "unverified": [m.raw_type for m in MAPPINGS if not m.verified],
        "note": (
            "Unverified entries are inferred from documented payload shapes and have not been seen "
            "on the wire. Run ai/scripts/spike.py against a working model deployment to confirm."
        ),
    }
