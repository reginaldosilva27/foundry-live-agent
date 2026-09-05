"""SSE framing (spec 003, AC1)."""

import json

from app.sse import format_event, parse_frames


def test_frame_carries_the_event_type_and_json_payload():
    frame = format_event({"type": "text_delta", "text": "hello"})
    assert frame.startswith("event: text_delta\n")
    assert "data: " in frame
    assert frame.endswith("\n\n")


def test_payload_round_trips():
    event = {"type": "usage", "input_tokens": 10, "output_tokens": 2}
    [parsed] = parse_frames(format_event(event))
    assert parsed == event


def test_newlines_in_text_do_not_break_framing():
    """A multi-line answer must not be read as several SSE frames."""
    event = {"type": "text_delta", "text": "line one\nline two\n\nline four"}
    [parsed] = parse_frames(format_event(event))
    assert parsed["text"] == "line one\nline two\n\nline four"


def test_several_events_parse_back_in_order():
    events = [
        {"type": "trace_ids", "response_id": "resp_1"},
        {"type": "text_delta", "text": "a"},
        {"type": "done", "response_id": "resp_1"},
    ]
    stream = "".join(format_event(e) for e in events)
    assert parse_frames(stream) == events


def test_unicode_survives():
    [parsed] = parse_frames(format_event({"type": "text_delta", "text": "São Paulo · 17h"}))
    assert parsed["text"] == "São Paulo · 17h"


def test_invalid_event_is_rejected_before_framing():
    """The contract is enforced at the transport boundary, not trusted."""
    import pytest
    from harness._shared.contract import ContractError

    with pytest.raises(ContractError):
        format_event({"type": "telepathy", "text": "nope"})


def test_data_line_is_compact_json():
    frame = format_event({"type": "text_delta", "text": "hi"})
    data = frame.split("data: ", 1)[1].split("\n", 1)[0]
    assert json.loads(data)["text"] == "hi"
    assert ", " not in data  # compact separators keep frames small
