"""The harness contract — the boundary between any agent harness and the rest of the app.

This module is the source of truth for constitution §9. Every harness emits **only** the events
defined here; the BFF and the frontend consume **only** these events. Changing the event set is a
contract change: it needs a spec, and it moves its consumers, fixtures and docs in the same change.

Two levels of checking, with different jobs:

- :func:`validate_event` — is this *one object* a valid event? Cheap, called at the boundary.
- :func:`check_stream` — is this *sequence* a valid stream? The invariants that catch real bugs.

The most important invariant is that every tool call the app is responsible for gets answered.
Foundry emits a function call and then waits; if nothing answers, the run hangs until it expires
ten minutes later, and from the UI the stream simply stops. :func:`check_stream` turns that silent
hang into a loud failure.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterable, Mapping
from typing import Any, Literal, NotRequired, Protocol, TypedDict, runtime_checkable

__all__ = [
    "EVENT_TYPES",
    "AgentEvent",
    "ConformanceError",
    "ContractError",
    "Done",
    "ErrorEvent",
    "HarnessAdapter",
    "McpCall",
    "ReasoningSummary",
    "TextDelta",
    "ToolCall",
    "ToolResult",
    "TraceIds",
    "Usage",
    "check_stream",
    "validate_event",
]


class ContractError(ValueError):
    """One event does not conform to the contract."""


class ConformanceError(ValueError):
    """A sequence of events is individually valid but not a valid stream."""


# --- The event vocabulary --------------------------------------------------
# Nine types, closed. TypedDict rather than dataclasses because these become JSON on an SSE
# stream — a dict-shaped type is the honest representation of what crosses the wire.


class ReasoningSummary(TypedDict):
    """A fragment of the model's summarised chain of thought."""

    type: Literal["reasoning_summary"]
    text: str


class TextDelta(TypedDict):
    """A fragment of the assistant's visible answer."""

    type: Literal["text_delta"]
    text: str


class ToolCall(TypedDict):
    """A tool invocation the agent decided to make.

    ``executor`` is the whole of constitution §8 expressed in the type system: ``"app"`` means
    *we* must run this and answer, ``"foundry"`` means Foundry runs it and we only observe.
    Note that the app never decides *which* tool to call — it only executes what it is asked to.

    ``arguments`` is the raw JSON string, not parsed: it arrives in fragments while streaming, and
    the contract should not have to decide what a half-arrived argument means.
    """

    type: Literal["tool_call"]
    call_id: str
    name: str
    arguments: str
    executor: Literal["app", "foundry"]


class ToolResult(TypedDict):
    """The outcome of a tool call, keyed back to it by ``call_id``."""

    type: Literal["tool_result"]
    call_id: str
    name: str
    output: str
    duration_ms: NotRequired[int]
    error: NotRequired[str]


class McpCall(TypedDict):
    """A call to a remote MCP server, executed by Foundry.

    Kept separate from :class:`ToolCall` so the activity panel can attribute it to its server and
    show that it ran outside our process.
    """

    type: Literal["mcp_call"]
    server_label: str
    name: str
    arguments: str
    output: NotRequired[str]
    error: NotRequired[str]


class Usage(TypedDict):
    """Token accounting for the run. At most one per stream."""

    type: Literal["usage"]
    input_tokens: int
    output_tokens: int
    reasoning_tokens: NotRequired[int]


class TraceIds(TypedDict):
    """Identifiers that let the trace drawer find this run's spans."""

    type: Literal["trace_ids"]
    response_id: str
    conversation_id: NotRequired[str]
    otel_trace_id: NotRequired[str]
    gateway_request_id: NotRequired[str]


class ErrorEvent(TypedDict):
    """A terminal failure. Ends the stream."""

    type: Literal["error"]
    message: str
    code: NotRequired[str]


class Done(TypedDict):
    """A terminal success. Ends the stream."""

    type: Literal["done"]
    response_id: NotRequired[str]


AgentEvent = (
    ReasoningSummary
    | TextDelta
    | ToolCall
    | ToolResult
    | McpCall
    | Usage
    | TraceIds
    | ErrorEvent
    | Done
)

TERMINAL_TYPES = frozenset({"done", "error"})

# field name -> (required types, optional types). Kept as data so validation and the type
# declarations above cannot drift apart silently — a mismatch shows up as a failing test.
_SCHEMA: dict[str, tuple[dict[str, type | tuple[type, ...]], dict[str, type]]] = {
    "reasoning_summary": ({"text": str}, {}),
    "text_delta": ({"text": str}, {}),
    "tool_call": (
        {"call_id": str, "name": str, "arguments": str, "executor": str},
        {},
    ),
    "tool_result": (
        {"call_id": str, "name": str, "output": str},
        {"duration_ms": int, "error": str},
    ),
    "mcp_call": (
        {"server_label": str, "name": str, "arguments": str},
        {"output": str, "error": str},
    ),
    "usage": ({"input_tokens": int, "output_tokens": int}, {"reasoning_tokens": int}),
    "trace_ids": (
        {"response_id": str},
        {"conversation_id": str, "otel_trace_id": str, "gateway_request_id": str},
    ),
    "error": ({"message": str}, {"code": str}),
    "done": ({}, {"response_id": str}),
}

EVENT_TYPES = frozenset(_SCHEMA)

# Fields constrained to a fixed set of values.
_ENUMS: dict[tuple[str, str], frozenset[str]] = {
    ("tool_call", "executor"): frozenset({"app", "foundry"}),
}


def validate_event(event: Any) -> AgentEvent:
    """Return ``event`` if it conforms to the contract, else raise :class:`ContractError`.

    Rejects unknown types, missing required fields, unknown fields, wrong field types, and values
    outside a constrained set. Unknown fields are an error rather than being ignored: silently
    dropping a field is how a harness starts emitting something no consumer reads.
    """
    if not isinstance(event, Mapping):
        raise ContractError(f"event must be a mapping, got {type(event).__name__}")

    event_type = event.get("type")
    if event_type is None:
        raise ContractError("event is missing 'type'")
    if event_type not in _SCHEMA:
        raise ContractError(
            f"unknown event type {event_type!r}; expected one of {sorted(EVENT_TYPES)}"
        )

    required, optional = _SCHEMA[event_type]

    for field, expected in required.items():
        if field not in event:
            raise ContractError(f"{event_type}: missing required field {field!r}")
        _check_field_type(event_type, field, event[field], expected)

    known = {"type", *required, *optional}
    for field in event:
        if field not in known:
            raise ContractError(f"{event_type}: unexpected field {field!r}")
        if field in optional:
            _check_field_type(event_type, field, event[field], optional[field])

    for (scoped_type, field), allowed in _ENUMS.items():
        if scoped_type == event_type and event[field] not in allowed:
            raise ContractError(
                f"{event_type}: field {field!r} must be one of {sorted(allowed)}, "
                f"got {event[field]!r}"
            )

    return event  # type: ignore[return-value]


def _check_field_type(
    event_type: str, field: str, value: Any, expected: type | tuple[type, ...]
) -> None:
    # bool is an int subclass; an accidental True in a token count should not pass.
    if expected is int and isinstance(value, bool):
        raise ContractError(f"{event_type}: field {field!r} must be int, got bool")
    if not isinstance(value, expected):
        name = getattr(expected, "__name__", str(expected))
        raise ContractError(
            f"{event_type}: field {field!r} must be {name}, got {type(value).__name__}"
        )


def check_stream(events: Iterable[Any]) -> list[AgentEvent]:
    """Validate a whole stream and return it, or raise :class:`ConformanceError`.

    Invariants (spec 001, AC4–AC8):

    1. Exactly one terminal event (``done`` or ``error``), and nothing after it.
    2. Every ``tool_call`` with ``executor="app"`` is answered by a matching ``tool_result`` —
       unless the stream terminates with ``error``.
    3. No ``call_id`` appears on two ``tool_call`` events.
    4. ``usage`` appears at most once.
    5. A stream ending in ``done`` carries a ``trace_ids`` with a non-empty ``response_id``.
    """
    validated = [validate_event(event) for event in events]

    terminal_index = next((i for i, e in enumerate(validated) if e["type"] in TERMINAL_TYPES), None)
    if terminal_index is None:
        raise ConformanceError("stream did not terminate: no 'done' or 'error' event")
    if terminal_index != len(validated) - 1:
        extra = validated[terminal_index + 1]["type"]
        raise ConformanceError(
            f"{len(validated) - terminal_index - 1} event(s) after the terminal "
            f"{validated[terminal_index]['type']!r}, starting with {extra!r}"
        )

    terminal = validated[terminal_index]

    if sum(1 for e in validated if e["type"] == "usage") > 1:
        raise ConformanceError("stream contains more than one 'usage' event")

    app_calls: dict[str, str] = {}
    for event in validated:
        if event["type"] != "tool_call":
            continue
        call_id = event["call_id"]
        if call_id in app_calls:
            raise ConformanceError(f"duplicate tool_call call_id {call_id!r}")
        app_calls[call_id] = event["executor"]

    if terminal["type"] == "done":
        answered = {e["call_id"] for e in validated if e["type"] == "tool_result"}
        unanswered = sorted(
            call_id
            for call_id, executor in app_calls.items()
            if executor == "app" and call_id not in answered
        )
        if unanswered:
            raise ConformanceError(
                "app-executed tool call(s) never answered: "
                + ", ".join(repr(c) for c in unanswered)
                + ". Foundry waits for the output; an unanswered call hangs the run "
                "until it expires."
            )

        traces = [e for e in validated if e["type"] == "trace_ids"]
        if not traces:
            raise ConformanceError(
                "stream ended in 'done' without a 'trace_ids' event; "
                "the trace drawer would have nothing to query"
            )
        if not any(e["response_id"] for e in traces):
            raise ConformanceError("'trace_ids' carries an empty response_id")

    return validated


# --- The adapter Protocol --------------------------------------------------


class VoiceAttachment(TypedDict):
    """What a harness needs to hand Voice Live so it drives the same agent."""

    agent_name: str
    project_name: str
    agent_version: NotRequired[str]
    conversation_id: NotRequired[str]


@runtime_checkable
class HarnessAdapter(Protocol):
    """The only interface the BFF knows about.

    Deliberately narrow. A harness streams events, accepts tool output, and says how Voice Live
    should attach to it. It does not expose the model, the tool list, or any way for the caller to
    influence *which* tool runs — that would put the agent loop back in the app (§8).
    """

    def stream_response(
        self, messages: list[Mapping[str, Any]], conversation_state: Mapping[str, Any]
    ) -> AsyncIterator[AgentEvent]:
        """Stream the agent's response as :data:`AgentEvent`s."""
        ...

    async def submit_tool_output(
        self, call_id: str, output: str, conversation_state: Mapping[str, Any]
    ) -> None:
        """Return the output of an app-executed tool call to the agent."""
        ...

    def voice_attachment_params(self) -> VoiceAttachment:
        """Parameters that attach Voice Live to this same agent."""
        ...
