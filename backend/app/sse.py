"""Server-Sent Events framing for the `AgentEvent` stream.

SSE is a **transport** for the §9 contract, not a second schema. Every event is validated against
the contract before it is framed, so the browser can never receive something the frontend's types
do not cover — a mismatch fails here, loudly, rather than as a blank card in the UI.

Why SSE and not WebSocket: the browser needs one-way streaming from a POST. `EventSource` is
GET-only,
so the client reads the response body with `fetch` + `ReadableStream`. WebSocket is reserved for the
Voice Live control channel, which genuinely is bidirectional.

Framing detail worth knowing: SSE splits records on a blank line, so a raw payload containing a
blank line would break the stream. Encoding each event as **single-line JSON** sidesteps that
entirely: a newline inside a string becomes an escape and never reaches the wire as a newline.
"""

from __future__ import annotations

import json

from harness._shared.contract import AgentEvent, validate_event

__all__ = ["format_event", "parse_frames"]


def format_event(event: object) -> str:
    """Validate an :data:`AgentEvent` and render it as one SSE frame.

    Raises :class:`~harness._shared.contract.ContractError` if the event is not valid.
    """
    validated = validate_event(event)
    payload = json.dumps(validated, ensure_ascii=False, separators=(",", ":"))
    return f"event: {validated['type']}\ndata: {payload}\n\n"


def parse_frames(stream: str) -> list[AgentEvent]:
    """Parse a complete SSE stream back into events. Used by tests and by the reference client."""
    events: list[AgentEvent] = []
    for block in stream.split("\n\n"):
        for line in block.splitlines():
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: ") :]))
    return events
