"""The Foundry stream -> AgentEvent normaliser (spec 003).

Raw event shapes here are inline test inputs. Which of them are *observed* Foundry behaviour and
which are inferred from documented shapes is tracked by `MAPPINGS[...].verified` — see
`test_verified_flags_are_honest`.
"""

import pytest

from harness._shared.contract import ContractError, check_stream
from harness.prompt_agent.events import MAPPINGS, normalise, unmapped_types


def norm(raw):
    return list(normalise(raw))


# --- text and reasoning ----------------------------------------------------


def test_text_delta_becomes_text_delta():
    out = norm([{"type": "response.output_text.delta", "delta": "hello"}])
    assert out == [{"type": "text_delta", "text": "hello"}]


def test_empty_text_delta_is_dropped():
    """A zero-length delta is noise; forwarding it would flicker the caret for nothing."""
    assert norm([{"type": "response.output_text.delta", "delta": ""}]) == []


def test_reasoning_summary_delta_becomes_reasoning_summary():
    out = norm([{"type": "response.reasoning_summary_text.delta", "delta": "Thinking."}])
    assert out == [{"type": "reasoning_summary", "text": "Thinking."}]


def test_a_new_summary_part_starts_a_new_paragraph():
    """Foundry sends the summary in **parts**, each opening with its own `**Title**`, and marks each
    one with `reasoning_summary_part.added`. Dropping that boundary ran the phases together:
    `...spot-on!**Researching project architecture**...` — two phases, no seam. The boundary is
    data Foundry gave us, so it is carried through as a paragraph break rather than discarded."""
    out = norm(
        [
            {"type": "response.reasoning_summary_part.added", "summary_index": 0},
            {"type": "response.reasoning_summary_text.delta", "delta": "**One** first phase."},
            {"type": "response.reasoning_summary_part.added", "summary_index": 1},
            {"type": "response.reasoning_summary_text.delta", "delta": "**Two** second phase."},
        ]
    )

    assert "".join(e["text"] for e in out) == "\n\n**One** first phase.\n\n**Two** second phase."


# --- function calls --------------------------------------------------------


def test_completed_function_call_item_becomes_a_tool_call():
    out = norm(
        [
            {
                "type": "response.output_item.done",
                "item": {
                    "type": "function_call",
                    "call_id": "call_1",
                    "name": "get_current_datetime",
                    "arguments": '{"timezone":"UTC"}',
                },
            }
        ]
    )
    assert out == [
        {
            "type": "tool_call",
            "call_id": "call_1",
            "name": "get_current_datetime",
            "arguments": '{"timezone":"UTC"}',
            "executor": "app",
        }
    ]


def test_function_call_argument_deltas_are_not_emitted_as_events():
    """Partial arguments are not a tool_call yet; the contract carries whole calls."""
    assert norm([{"type": "response.function_call_arguments.delta", "delta": '{"tz'}]) == []


def test_a_non_function_output_item_is_not_a_tool_call():
    out = norm([{"type": "response.output_item.done", "item": {"type": "message", "content": []}}])
    assert out == []


# --- MCP -------------------------------------------------------------------


def test_a_completed_mcp_item_becomes_an_mcp_call():
    """Observed 2026-09-15: the MCP item, not the lifecycle event, is the complete record."""
    out = norm(
        [
            {
                "type": "response.output_item.done",
                "item": {
                    "type": "mcp_call",
                    "server_label": "microsoft_learn",
                    "name": "microsoft_docs_search",
                    "arguments": '{"query":"hosted agents"}',
                    "output": "some docs",
                    "error": None,
                },
            }
        ]
    )
    assert out[0]["type"] == "mcp_call"
    assert out[0]["server_label"] == "microsoft_learn"
    assert out[0]["output"] == "some docs"
    assert "error" not in out[0]


def test_the_mcp_lifecycle_event_is_not_the_call():
    """Observed 2026-09-15: `response.mcp_call.completed` carries `item_id` and nothing else.
    Building the card from it produced `server_label: unknown` and no output at all."""
    assert norm([{"type": "response.mcp_call.completed", "item_id": "mcp_1"}]) == []


def test_an_mcp_item_that_carries_an_error_is_reported_as_failed():
    out = norm(
        [
            {
                "type": "response.output_item.done",
                "item": {
                    "type": "mcp_call",
                    "server_label": "microsoft_learn",
                    "name": "microsoft_docs_fetch",
                    "arguments": "{}",
                    "error": "upstream timeout",
                },
            }
        ]
    )
    assert out[0]["error"] == "upstream timeout"


def test_mcp_list_tools_is_not_a_call():
    """Observed 2026-09-04: listing a server's tools is setup, not a tool invocation."""
    assert norm([{"type": "response.mcp_list_tools.completed"}]) == []


# --- terminal events -------------------------------------------------------


def test_completed_emits_usage_then_trace_ids_then_done():
    out = norm(
        [
            {
                "type": "response.completed",
                "response": {
                    "id": "resp_1",
                    "usage": {"input_tokens": 10, "output_tokens": 4},
                },
            }
        ]
    )
    assert [e["type"] for e in out] == ["usage", "trace_ids", "done"]
    assert out[0]["input_tokens"] == 10
    assert out[1]["response_id"] == "resp_1"


def test_completed_without_usage_still_terminates():
    out = norm([{"type": "response.completed", "response": {"id": "resp_1"}}])
    assert [e["type"] for e in out] == ["trace_ids", "done"]


def test_failed_becomes_a_terminal_error():
    out = norm(
        [{"type": "response.failed", "response": {"error": {"message": "boom", "code": "x"}}}]
    )
    assert out == [{"type": "error", "message": "boom", "code": "x"}]


def test_bare_error_event_becomes_error():
    out = norm([{"type": "error", "message": "socket closed"}])
    assert out[0]["type"] == "error"


# --- unknown events --------------------------------------------------------


def test_unknown_events_are_counted_not_dropped_silently():
    """An event Foundry starts sending that we ignore should be visible, not invisible."""
    raw = [{"type": "response.something.new"}, {"type": "response.something.new"}]
    assert norm(raw) == []
    assert unmapped_types(raw) == {"response.something.new": 2}


def test_lifecycle_noise_is_ignored_on_purpose():
    for etype in ("response.created", "response.in_progress", "response.output_item.added"):
        assert norm([{"type": etype}]) == []
        assert unmapped_types([{"type": etype}]) == {}


# --- the whole thing conforms ---------------------------------------------


def test_a_realistic_stream_satisfies_the_contract():
    raw = [
        {"type": "response.created"},
        {"type": "response.reasoning_summary_text.delta", "delta": "Check the time."},
        {"type": "response.output_text.delta", "delta": "It is "},
        {"type": "response.output_text.delta", "delta": "17:00."},
        {
            "type": "response.completed",
            "response": {"id": "resp_1", "usage": {"input_tokens": 9, "output_tokens": 3}},
        },
    ]
    check_stream(norm(raw))


def test_every_emitted_event_is_contract_valid():
    from harness._shared.contract import validate_event

    for event in norm(
        [
            {"type": "response.output_text.delta", "delta": "x"},
            {"type": "response.completed", "response": {"id": "r"}},
        ]
    ):
        validate_event(event)


def test_a_malformed_raw_event_raises_rather_than_emitting_junk():
    with pytest.raises((ContractError, KeyError, TypeError)):
        norm([{"type": "response.output_item.done", "item": {"type": "function_call"}}])


# --- the verified flags stay honest ---------------------------------------


def test_verified_flags_are_honest():
    """Only event names this project has actually seen may be marked verified (§5, §10).

    The observed set is read from the recorded fixtures rather than typed here, so the flags can
    only move when a new recording moves them.
    """
    import json
    from pathlib import Path

    recorded = Path(__file__).parent / "fixtures" / "recorded"

    def rows(fixture):
        return [json.loads(line) for line in fixture.read_text().splitlines() if line.strip()]

    # Not every recording in this directory is a stream of contract events. Spec 005 added one of
    # Application Insights spans, whose rows carry `name`/`operation_Id` and no `type` at all — so
    # this selects the event streams by shape rather than assuming the whole directory is one.
    streams = [f for f in sorted(recorded.glob("*.jsonl")) if all("type" in row for row in rows(f))]
    assert streams, "no event-stream recordings to check the flags against"

    observed = {row["type"] for fixture in streams for row in rows(fixture)}
    assert observed, "no recordings to check the flags against"

    for mapping in MAPPINGS:
        if mapping.verified:
            assert mapping.raw_type in observed, (
                f"{mapping.raw_type} is marked verified but appears in no recorded fixture"
            )


def test_some_mappings_are_still_unverified():
    """A guard against someone flipping every flag to True to make the report look clean."""
    assert any(not m.verified for m in MAPPINGS)
