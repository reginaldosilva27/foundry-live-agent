"""Hosted-agent Responses stream -> `AgentEvent`.

Written **after** the first real recording, not before it (§10). Spec 002 built the prompt agent's
normaliser against inferred shapes and the first live stream contradicted three of them; this file
exists only because `scripts/spike_hosted.py` ran first, on 2026-09-16, against
`foundry-live-agent-hosted` version 1.

`MAPPINGS` carries the same `verified` discipline as `prompt_agent/events.py`: a flag per raw event
type, a test that refuses to let one claim `verified` unless a committed fixture shows it, and
:func:`mapping_report` so a reader can see how much is still inference.

**Two differences from the prompt agent's normaliser, both observed.**

1. **A `function_call` here is a report, not a request.** Foundry's prompt runtime emits a
   `function_call` and *stops*, waiting for the app to answer; an unanswered one hangs the run for
   ten minutes. The hosted agent emits `function_call` **and** `function_call_output` with the same
   `call_id` in one stream — the container already ran the tool. So every tool call this harness
   produces carries `executor: "foundry"` and is answered before the app ever sees it, and the
   adapter has no loop at all.

2. **This normaliser is stateful, and it has to be.** `function_call_output` carries no `name` —
   only `call_id` and `output`. The `tool_result` contract event requires a name, so the call_id ->
   name map built from the preceding `function_call` is the only way to fill it. The prompt agent's
   `convert()` is a pure function; this one cannot be, and pretending otherwise would mean emitting
   `name: "unknown"` on every result.

**What this harness never emits, and why it is a finding rather than a gap:**

- **`mcp_call`.** With a prompt agent, Foundry is the MCP client and a Learn search arrives as an
  `mcp_call`. Here the container holds the MCP session, so the same work arrives as ordinary tool
  calls named `microsoft_docs_search` / `microsoft_docs_fetch` — the Learn server's own three tools,
  not the single `microsoft_learn` label the definition uses.
- **`reasoning_summary`.** `reasoning` is a prompt-agent *definition* field; this loop is our code
  calling chat completions, and no summary comes back. Spec 015 already made an empty reasoning card
  survivable.
- **`usage`.** `response.completed` carries `usage: null`. The contract always permitted that —
  `check_stream` forbids a second `usage`, never requires a first — but any surface that reads token
  counts must render "not reported" rather than zero.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass
from typing import Any

from harness._shared.contract import AgentEvent
from harness._shared.event_diagnostics import MAX_TYPE_LENGTH, EventDiagnostics

__all__ = [
    "MAPPINGS",
    "EventMapping",
    "Normaliser",
    "mapping_report",
    "normalise",
    "unmapped_types",
]


@dataclass(frozen=True)
class EventMapping:
    """One raw hosted-agent event type and what we do with it."""

    raw_type: str
    produces: str
    verified: bool
    note: str


# Observed 2026-09-16 against agent `foundry-live-agent-hosted` version 1, model gpt-5.5, project
# ai-admin2354ai223634534-project (eastus2), recorded in tests/fixtures/recorded/. See
# docs/REFERENCES.md.
_OBSERVED = "observed 2026-09-16"
_INFERRED = "NOT in a committed fixture — see the note"

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
        "response.output_text.done", "—", True, f"{_OBSERVED}; the whole text, already streamed"
    ),
    EventMapping(
        "response.function_call_arguments.delta", "—", True, f"{_OBSERVED}; partial, see item.done"
    ),
    EventMapping(
        "response.function_call_arguments.done",
        "—",
        True,
        f"{_OBSERVED}; the completed output item is the full record",
    ),
    # --- the events that become contract events ---
    EventMapping("response.output_text.delta", "text_delta", True, f"{_OBSERVED}; 450 of them"),
    EventMapping(
        "response.output_item.done",
        "tool_call | tool_result",
        True,
        f"{_OBSERVED}; function_call AND function_call_output both arrive here, paired by call_id",
    ),
    EventMapping("response.completed", "trace_ids+done", True, f"{_OBSERVED}; usage is null"),
    # --- the failure half ---
    EventMapping(
        "response.failed",
        "error",
        False,
        "observed 2026-09-16 while the agent identity lacked model access — `error.code: "
        "internal_error`, message carrying the upstream 401 — but NOT captured as a committed "
        "fixture, so it is flagged unverified rather than backdated into one (§5)",
    ),
    EventMapping("response.incomplete", "error", False, _INFERRED),
    EventMapping("error", "error", False, _INFERRED),
)

_KNOWN: frozenset[str] = frozenset(m.raw_type for m in MAPPINGS)
_IGNORED: frozenset[str] = frozenset(m.raw_type for m in MAPPINGS if m.produces == "—")


class Normaliser:
    """Converts one raw event at a time, remembering what it needs to.

    Stateful because `function_call_output` carries no tool name — see the module docstring. One
    instance per turn; the adapter creates one and feeds the stream through it, which is what keeps
    conversion off the event loop one event at a time.
    """

    def __init__(self) -> None:
        #: call_id -> tool name, learned from `function_call`, needed by `function_call_output`.
        self._names: dict[str, str] = {}

    def convert(
        self, raw: Mapping[str, Any], *, diagnostics: EventDiagnostics | None = None
    ) -> Iterator[AgentEvent]:
        etype = raw.get("type", "")

        if type(etype) is not str or len(etype) > MAX_TYPE_LENGTH or etype not in _KNOWN:
            if diagnostics is not None:
                diagnostics.observe(etype)
            return
        if etype in _IGNORED:
            return

        if etype == "response.output_text.delta":
            if text := raw.get("delta", ""):
                yield {"type": "text_delta", "text": text}
            return

        if etype == "response.output_item.done":
            yield from self._output_item(raw.get("item") or {})
            return

        if etype == "response.completed":
            response = raw.get("response") or {}
            # No `usage` event: observed `usage: null`. Emitting a zeroed one would be a fabricated
            # measurement, which is worse than an absent one (§5).
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

    def _output_item(self, item: Mapping[str, Any]) -> Iterator[AgentEvent]:
        kind = item.get("type")

        if kind == "function_call":
            call_id, name = item["call_id"], item["name"]
            self._names[call_id] = name
            # executor="foundry": the container already ran this. Unlike the prompt agent's
            # `executor="app"`, nothing is waiting on us — see the module docstring.
            yield {
                "type": "tool_call",
                "call_id": call_id,
                "name": name,
                "arguments": item.get("arguments") or "{}",
                "executor": "foundry",
            }
        elif kind == "function_call_output":
            call_id = item["call_id"]
            yield {
                "type": "tool_result",
                "call_id": call_id,
                # The item carries no name; the call that preceded it did.
                "name": self._names.get(call_id, "unknown"),
                "output": _as_text(item.get("output")),
            }
        # `message` items are ignored: the text already streamed as deltas.


def normalise(raw_events: Iterable[Mapping[str, Any]]) -> Iterator[AgentEvent]:
    """Convert a whole recorded stream. One :class:`Normaliser` for the whole turn."""
    normaliser = Normaliser()
    diagnostics = EventDiagnostics("langgraph")
    try:
        for raw in raw_events:
            yield from normaliser.convert(raw, diagnostics=diagnostics)
    finally:
        diagnostics.flush()


def _as_text(output: Any) -> str:
    """Tool output as the string the contract wants.

    Observed 2026-09-16: `output` is a JSON string for our function tools and a plain markdown
    string for `microsoft_docs_fetch`. Both are already text; anything else is rendered rather
    than dropped, because a result that silently became empty reads as a tool that returned
    nothing.
    """
    if output is None:
        return ""
    return output if isinstance(output, str) else str(output)


def unmapped_types(raw_events: Iterable[Mapping[str, Any]]) -> dict[str, int]:
    """Count raw event types this normaliser does not know about."""
    counts: dict[str, int] = {}
    for raw in raw_events:
        etype = raw.get("type", "")
        if etype not in _KNOWN:
            counts[etype] = counts.get(etype, 0) + 1
    return counts


def mapping_report() -> dict[str, Any]:
    """How much of the mapping is observed versus inferred. Exposed by ``GET /config``."""
    return {
        "total": len(MAPPINGS),
        "verified": sum(1 for m in MAPPINGS if m.verified),
        "unverified": [m.raw_type for m in MAPPINGS if not m.verified],
        "note": (
            "Unverified entries are the failure half. `response.failed` WAS observed on "
            "2026-09-16, while the agent identity lacked model access, but was not kept as a "
            "committed fixture. Re-record with ai/scripts/spike_hosted.py against a deliberately "
            "broken deployment to confirm."
        ),
    }
