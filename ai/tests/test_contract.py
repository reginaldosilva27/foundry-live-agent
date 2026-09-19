"""Tests for the harness contract (spec 001).

The event sequences in this file are **inline unit-test inputs for our own validator**, not
recordings of Foundry behaviour. They assert what `validate_event` and `check_stream` do.
Real recorded streams land in `tests/fixtures/recorded/` in spec 002 (constitution §5).
"""

import pytest

from harness._shared.contract import (
    EVENT_TYPES,
    ConformanceError,
    ContractError,
    HarnessAdapter,
    check_stream,
    validate_event,
)

# --- helpers ---------------------------------------------------------------


def trace(response_id="resp_1"):
    return {"type": "trace_ids", "response_id": response_id}


def done(response_id="resp_1"):
    return {"type": "done", "response_id": response_id}


def app_call(call_id="call_1", name="get_current_datetime"):
    return {
        "type": "tool_call",
        "call_id": call_id,
        "name": name,
        "arguments": '{"timezone":"America/Sao_Paulo"}',
        "executor": "app",
    }


def result(call_id="call_1", name="get_current_datetime"):
    return {"type": "tool_result", "call_id": call_id, "name": name, "output": '{"iso":"..."}'}


# --- AC1: the union is closed ---------------------------------------------


def test_event_types_are_exactly_the_nine():
    expected = frozenset(
        {
            "reasoning_summary",
            "text_delta",
            "tool_call",
            "tool_result",
            "mcp_call",
            "usage",
            "trace_ids",
            "error",
            "done",
        }
    )
    assert sorted(EVENT_TYPES) == sorted(expected)


def test_accepts_one_of_every_type():
    for event in [
        {"type": "reasoning_summary", "text": "Considering the timezone."},
        {"type": "text_delta", "text": "It is "},
        app_call(),
        result(),
        {
            "type": "mcp_call",
            "server_label": "microsoft_learn",
            "name": "search",
            "arguments": "{}",
        },
        {"type": "usage", "input_tokens": 10, "output_tokens": 20},
        trace(),
        {"type": "error", "message": "upstream failed"},
        done(),
    ]:
        assert validate_event(event)["type"] in EVENT_TYPES


def test_rejects_unknown_event_type():
    with pytest.raises(ContractError, match="unknown event type"):
        validate_event({"type": "thinking_out_loud", "text": "hi"})


def test_rejects_event_without_a_type():
    with pytest.raises(ContractError, match="missing 'type'"):
        validate_event({"text": "hi"})


def test_rejects_non_mapping():
    with pytest.raises(ContractError, match="must be a mapping"):
        validate_event(["not", "a", "dict"])


# --- AC2: required and unknown fields --------------------------------------


def test_rejects_missing_required_field():
    with pytest.raises(ContractError, match="text"):
        validate_event({"type": "text_delta"})


def test_rejects_unknown_field():
    with pytest.raises(ContractError, match="unexpected_field"):
        validate_event({"type": "text_delta", "text": "hi", "unexpected_field": 1})


def test_accepts_optional_field():
    event = validate_event(
        {"type": "usage", "input_tokens": 1, "output_tokens": 2, "reasoning_tokens": 3}
    )
    assert event["reasoning_tokens"] == 3


def test_accepts_cached_input_tokens():
    """Spec 028 AC5 — the cache portion of the input, which Foundry reports and we now carry.

    It is a *subset* of ``input_tokens``, never an addition, and the contract says nothing about
    that arithmetic: the schema's job is the shape. The sum is pinned in `cost.test.ts`.
    """
    event = validate_event(
        {
            "type": "usage",
            "input_tokens": 17401,
            "output_tokens": 382,
            "cached_input_tokens": 1024,
        }
    )
    assert event["cached_input_tokens"] == 1024


def test_rejects_non_integer_cached_input_tokens():
    with pytest.raises(ContractError, match="cached_input_tokens"):
        validate_event(
            {"type": "usage", "input_tokens": 1, "output_tokens": 2, "cached_input_tokens": "1k"}
        )


# --- AC3: field types ------------------------------------------------------


def test_rejects_wrong_field_type():
    with pytest.raises(ContractError, match="input_tokens"):
        validate_event({"type": "usage", "input_tokens": "ten", "output_tokens": 2})


def test_rejects_bad_executor_value():
    bad = app_call() | {"executor": "somebody_else"}
    with pytest.raises(ContractError, match="executor"):
        validate_event(bad)


# --- AC4: exactly one terminal event, and it is last -----------------------


def test_stream_must_terminate():
    with pytest.raises(ConformanceError, match="did not terminate"):
        check_stream([trace(), {"type": "text_delta", "text": "hi"}])


def test_nothing_after_terminal():
    with pytest.raises(ConformanceError, match="after the terminal"):
        check_stream([trace(), done(), {"type": "text_delta", "text": "late"}])


def test_not_both_terminals():
    with pytest.raises(ConformanceError, match="after the terminal"):
        check_stream([trace(), {"type": "error", "message": "boom"}, done()])


def test_minimal_valid_stream():
    check_stream([trace(), done()])


def test_error_only_stream_is_valid():
    check_stream([{"type": "error", "message": "boom"}])


# --- AC5: every app-executed tool call is answered -------------------------


def test_unanswered_app_tool_call_fails():
    with pytest.raises(ConformanceError, match="call_1"):
        check_stream([trace(), app_call(), done()])


def test_answered_app_tool_call_passes():
    check_stream([trace(), app_call(), result(), done()])


def test_unanswered_is_ok_when_stream_errors():
    # A run that blew up mid-tool-call is allowed to leave the call unanswered.
    check_stream([trace(), app_call(), {"type": "error", "message": "run failed"}])


def test_foundry_executed_call_needs_no_result():
    foundry_call = app_call(call_id="call_f") | {"executor": "foundry"}
    check_stream([trace(), foundry_call, done()])


# --- AC6: call ids are unique ---------------------------------------------


def test_duplicate_call_id_fails():
    with pytest.raises(ConformanceError, match="duplicate"):
        check_stream([trace(), app_call(), result(), app_call(), result(), done()])


# --- AC7: usage at most once, before the terminal --------------------------


def test_usage_at_most_once():
    usage = {"type": "usage", "input_tokens": 1, "output_tokens": 2}
    with pytest.raises(ConformanceError, match="usage"):
        check_stream([trace(), usage, usage, done()])


def test_usage_is_optional():
    check_stream([trace(), done()])


# --- AC8: a done stream carries a response id ------------------------------


def test_done_requires_trace_ids():
    with pytest.raises(ConformanceError, match="trace_ids"):
        check_stream([{"type": "text_delta", "text": "hi"}, done()])


def test_done_requires_non_empty_response_id():
    with pytest.raises(ConformanceError, match="response_id"):
        check_stream([{"type": "trace_ids", "response_id": ""}, done()])


def test_error_does_not_require_trace_ids():
    check_stream([{"type": "error", "message": "boom"}])


# --- AC9: the adapter Protocol --------------------------------------------


def test_protocol_isinstance_requires_all_methods():
    class Incomplete:
        async def stream_response(self, messages, conversation_state):  # pragma: no cover
            yield done()

    class Complete(Incomplete):
        async def submit_tool_output(self, call_id, output, conversation_state):  # pragma: no cover
            return None

        def voice_attachment_params(self):  # pragma: no cover
            return {}

    assert not isinstance(Incomplete(), HarnessAdapter)
    assert isinstance(Complete(), HarnessAdapter)
