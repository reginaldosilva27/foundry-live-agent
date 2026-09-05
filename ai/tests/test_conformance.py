"""Tests for the adapter-agnostic conformance suite (spec 001, AC10).

The adapters here are **test doubles for the suite itself** — scripted event sources used to prove
the suite passes a well-behaved adapter and catches a misbehaving one. They are not recordings of
Foundry behaviour (constitution §5).
"""

import pytest

from harness._shared.contract import ConformanceError, HarnessAdapter
from tests.conformance import run_conformance


class ScriptedAdapter:
    """A minimal HarnessAdapter that replays a fixed list of events."""

    def __init__(self, events):
        self._events = events
        self.submitted: list[tuple[str, str]] = []

    async def stream_response(self, messages, conversation_state):
        for event in self._events:
            yield event

    async def submit_tool_output(self, call_id, output, conversation_state):
        self.submitted.append((call_id, output))

    def voice_attachment_params(self):
        return {"agent_name": "scripted", "project_name": "test"}


WELL_BEHAVED = [
    {"type": "trace_ids", "response_id": "resp_1"},
    {"type": "reasoning_summary", "text": "The user asked for the time."},
    {
        "type": "tool_call",
        "call_id": "call_1",
        "name": "get_current_datetime",
        "arguments": '{"timezone":"America/Sao_Paulo"}',
        "executor": "app",
    },
    {
        "type": "tool_result",
        "call_id": "call_1",
        "name": "get_current_datetime",
        "output": '{"iso":"2026-09-04T17:00:00-03:00"}',
    },
    {"type": "text_delta", "text": "It is 5pm in Sao Paulo."},
    {"type": "usage", "input_tokens": 120, "output_tokens": 34},
    {"type": "done", "response_id": "resp_1"},
]


async def test_conformance_suite_runs_against_any_adapter():
    # Two structurally different adapters, one suite, no edits between them.
    minimal = ScriptedAdapter([{"type": "trace_ids", "response_id": "r"}, {"type": "done"}])
    full = ScriptedAdapter(WELL_BEHAVED)

    assert len(await run_conformance(minimal)) == 2
    assert len(await run_conformance(full)) == len(WELL_BEHAVED)


async def test_conformance_catches_a_stream_that_never_terminates():
    adapter = ScriptedAdapter([{"type": "text_delta", "text": "hi"}])
    with pytest.raises(ConformanceError, match="did not terminate"):
        await run_conformance(adapter)


async def test_conformance_catches_an_unanswered_tool_call():
    unanswered = [e for e in WELL_BEHAVED if e["type"] != "tool_result"]
    with pytest.raises(ConformanceError, match="never answered"):
        await run_conformance(ScriptedAdapter(unanswered))


async def test_conformance_rejects_an_object_that_is_not_an_adapter():
    class NotAnAdapter:
        pass

    with pytest.raises(TypeError, match="HarnessAdapter"):
        await run_conformance(NotAnAdapter())


def test_scripted_adapter_satisfies_the_protocol():
    assert isinstance(ScriptedAdapter([]), HarnessAdapter)
