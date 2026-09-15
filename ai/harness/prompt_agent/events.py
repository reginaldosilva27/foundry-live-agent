"""Foundry Responses stream -> `AgentEvent`.

Constitution §10 forbids writing a Foundry integration from memory. Most of these event names have
been **observed** coming out of Foundry; the rest are inferred from documented payload shapes and
have not yet been seen on the wire. That difference is tracked, not hidden:

- :data:`MAPPINGS` records every raw event type with a ``verified`` flag and a note.
- ``verified=True`` means *this project watched Foundry emit it*, with a date.
- :func:`mapping_report` surfaces the split, and ``GET /config`` exposes it, so a reader can see how
  much of the normaliser is still inference.
- A test replays the recorded fixtures and asserts no mapping is marked verified unless it appears
  in one of them, so the flags cannot drift into optimism.

What remains unverified is the failure half — ``response.failed``, ``response.incomplete``, the bare
``error`` frame, and ``response.mcp_call.failed``. Nothing has gone wrong on the wire yet, and
provoking a failure deliberately is a different exercise.

Two shapes here were **wrong before the 2026-09-15 recording** and are worth naming, because both
were plausible and neither survived contact:

1. ``response.mcp_call.completed`` carries **no ``item``** — only ``item_id``, ``output_index`` and
   ``sequence_number``. The server label, the arguments and the output live on
   ``response.output_item.done``, which is where the ``mcp_call`` event is now built from. Reading
   the lifecycle event gave a card labelled ``unknown`` with no output.
2. ``response.function_call_arguments.done`` carries ``name: null``, so it cannot identify a call
   on its own either. The completed output item is again the only complete record.

Unrecognised events are **counted**, not silently dropped — see :func:`unmapped_types`. An event
Foundry starts sending that we ignore is exactly the kind of thing that should be visible.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass
from typing import Any

from harness._shared.contract import AgentEvent

__all__ = ["MAPPINGS", "EventMapping", "convert", "mapping_report", "normalise", "unmapped_types"]


@dataclass(frozen=True)
class EventMapping:
    """One raw Foundry event type and what we do with it."""

    raw_type: str
    produces: str
    verified: bool
    note: str


# Observed 2026-09-15 against ai-admin2354ai223634534-project, agent `spike-reasoning`, model
# gpt-5.5, and recorded in tests/fixtures/recorded/. See docs/REFERENCES.md.
_OBSERVED = "observed 2026-09-15"
_INFERRED = "NOT yet observed — inferred from documented payload shape"

MAPPINGS: tuple[EventMapping, ...] = (
    # --- lifecycle: real events that carry nothing the contract needs ---
    EventMapping("response.created", "—", True, f"{_OBSERVED}; lifecycle noise, ignored"),
    EventMapping("response.in_progress", "—", True, f"{_OBSERVED}; lifecycle noise, ignored"),
    EventMapping(
        "response.output_item.added", "—", True, f"{_OBSERVED}; the item is empty until .done"
    ),
    EventMapping(
        "response.content_part.added", "—", True, f"{_OBSERVED}; the part is empty until deltas"
    ),
    EventMapping(
        "response.content_part.done", "—", True, f"{_OBSERVED}; the deltas already said it"
    ),
    EventMapping(
        "response.mcp_list_tools.in_progress", "—", True, f"{_OBSERVED}; MCP setup, not a call"
    ),
    EventMapping(
        "response.mcp_list_tools.completed", "—", True, f"{_OBSERVED}; MCP setup, not a call"
    ),
    EventMapping(
        "response.mcp_call.in_progress", "—", True, f"{_OBSERVED}; carries item_id only, no item"
    ),
    EventMapping(
        "response.mcp_call.completed",
        "—",
        True,
        f"{_OBSERVED}; carries item_id only — the call is built from response.output_item.done",
    ),
    EventMapping(
        "response.mcp_call_arguments.delta", "—", True, f"{_OBSERVED}; partial, see item.done"
    ),
    EventMapping(
        "response.mcp_call_arguments.done",
        "—",
        True,
        f"{_OBSERVED}; no server_label, see item.done",
    ),
    EventMapping(
        "response.function_call_arguments.delta", "—", True, f"{_OBSERVED}; partial, see item.done"
    ),
    EventMapping(
        "response.function_call_arguments.done",
        "—",
        True,
        f"{_OBSERVED}; carries `name: null`, so it cannot identify the call — see item.done",
    ),
    # --- the events that become contract events ---
    EventMapping("response.output_text.delta", "text_delta", True, _OBSERVED),
    EventMapping(
        "response.output_text.done", "—", True, f"{_OBSERVED}; the whole text, already streamed"
    ),
    EventMapping(
        "response.reasoning_summary_text.delta",
        "reasoning_summary",
        True,
        f"{_OBSERVED}; 159 of them",
    ),
    EventMapping(
        "response.reasoning_summary_text.done",
        "—",
        True,
        f"{_OBSERVED}; the whole summary, already streamed",
    ),
    EventMapping(
        "response.reasoning_summary_part.added",
        "reasoning_summary",
        True,
        f"{_OBSERVED}; a new summary part — carried through as a paragraph break, see below",
    ),
    EventMapping(
        "response.reasoning_summary_part.done", "—", True, f"{_OBSERVED}; end of paragraph"
    ),
    EventMapping(
        "response.output_item.done",
        "tool_call | mcp_call",
        True,
        f"{_OBSERVED}; the only complete record of either kind of call",
    ),
    EventMapping("response.completed", "usage+trace_ids+done", True, _OBSERVED),
    # --- the failure half, still inferred ---
    EventMapping("response.mcp_call.failed", "mcp_call", False, _INFERRED),
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
        yield from convert(raw)


def convert(raw: Mapping[str, Any]) -> Iterator[AgentEvent]:
    """Convert **one** raw event. Stateless, which is what lets the adapter consume the Foundry
    stream one event at a time off the event loop (see `adapter._stream_events`)."""
    etype = raw.get("type", "")

    if etype in _IGNORED or etype not in _KNOWN:
        return

    if etype == "response.output_text.delta":
        if text := raw.get("delta", ""):
            yield {"type": "text_delta", "text": text}
        return

    if etype == "response.reasoning_summary_part.added":
        # Foundry sends the summary in parts, each opening with its own `**Title**`, and this event
        # is the only thing that marks where one ends and the next begins. Ignoring it ran the
        # phases together — `...spot-on!**Researching project architecture**...`. The break is
        # Foundry's own boundary carried through, not formatting invented here (§5).
        yield {"type": "reasoning_summary", "text": "\n\n"}
        return

    if etype == "response.reasoning_summary_text.delta":
        if text := raw.get("delta", ""):
            yield {"type": "reasoning_summary", "text": text}
        return

    if etype == "response.output_item.done":
        item = raw.get("item") or {}
        kind = item.get("type")

        if kind == "function_call":
            # executor="app": Foundry emitted this and is now WAITING. See contract.check_stream.
            yield {
                "type": "tool_call",
                "call_id": item["call_id"],
                "name": item["name"],
                "arguments": item.get("arguments") or "{}",
                "executor": "app",
            }
        elif kind == "mcp_call":
            # executor is Foundry's: the call already ran, output and all. We only report it.
            yield _mcp_call(item)
        return

    if etype == "response.mcp_call.failed":
        yield _mcp_call(raw.get("item") or {}, failed=True)
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


def _mcp_call(item: Mapping[str, Any], *, failed: bool = False) -> AgentEvent:
    """Build an `mcp_call` from a completed MCP output item.

    An `error` on the item counts as a failure even on the success path: observed items carry
    `error: null` when they worked, and reporting a failed call as successful would put a green
    card on the screen for a call that returned nothing.
    """
    event: dict[str, Any] = {
        "type": "mcp_call",
        "server_label": item.get("server_label") or "unknown",
        "name": item.get("name") or "unknown",
        "arguments": item.get("arguments") or "{}",
    }
    if (output := item.get("output")) is not None:
        event["output"] = output
    if failed or item.get("error"):
        event["error"] = str(item.get("error") or "mcp call failed")
    return event  # type: ignore[return-value]


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
