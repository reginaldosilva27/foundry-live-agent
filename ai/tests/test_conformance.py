"""Tests for the adapter-agnostic conformance suite (spec 001, AC10).

The adapters here are **test doubles for the suite itself** — scripted event sources used to prove
the suite passes a well-behaved adapter and catches a misbehaving one. They are not recordings of
Foundry behaviour (constitution §5).
"""

import json
from collections.abc import Iterator
from pathlib import Path

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


# --- the second harness proves itself here (spec 018, AC2) ----------------
#
# This is the whole claim of spec 001, finally tested. `specs/README.md` promised:
#
#   > The HarnessAdapter contract tests are written once, parameterised over adapters, and replay
#   > recorded fixtures. When the LangGraph harness is built later, it proves itself against that
#   > same suite WITHOUT editing it.
#
# `tests/conformance.py` is byte-identical to its state before spec 018. The only change this spec
# made on the conformance side is the registration below — a new entry in the parameterisation,
# which is exactly what "parameterised over adapters" was supposed to mean.
#
# The two adapters are structurally different in the way that matters: the prompt agent loops over
# several legs and answers function calls; the hosted agent opens one stream and answers nothing.
# An abstraction with one implementation is shaped like that implementation and nobody can tell —
# this is how we can tell.

FIXTURES = Path(__file__).parent / "fixtures" / "recorded"


def _recorded(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def _prompt_agent_adapter():
    """The prompt agent, replaying a real Foundry turn split into its legs."""
    from harness.prompt_agent.adapter import PromptAgentAdapter
    from tests.test_recorded_turn import WITH_REASONING, legs

    remaining = legs(WITH_REASONING)

    def stream_factory(_inputs, _state) -> Iterator[dict]:
        return iter(remaining.pop(0))

    def executor(name: str, arguments: str) -> tuple[str, int, str | None]:
        return json.dumps({"replayed": name}), 5, None

    return PromptAgentAdapter(
        stream_factory=stream_factory,
        executor=executor,
        agent_name="foundry-live-agent",
        project_name="test-project",
    )


def _langgraph_adapter():
    """The hosted agent, replaying a real container turn. One leg, no tool round trip."""
    from harness.langgraph.adapter import LangGraphAdapter

    recorded = _recorded(FIXTURES / "langgraph-hosted-learn-20260916.jsonl")

    def stream_factory(_messages, _state) -> Iterator[dict]:
        return iter(recorded)

    return LangGraphAdapter(
        stream_factory=stream_factory,
        agent_name="foundry-live-agent-hosted",
        project_name="test-project",
    )


REAL_ADAPTERS = {
    "prompt-agent": _prompt_agent_adapter,
    "langgraph": _langgraph_adapter,
}


@pytest.mark.parametrize("harness", sorted(REAL_ADAPTERS))
async def test_every_shipped_harness_conforms(harness):
    """One suite, two harnesses, no edit between them (AC2)."""
    events = await run_conformance(REAL_ADAPTERS[harness]())
    assert events, f"{harness} produced an empty stream"
    assert events[-1]["type"] == "done"


@pytest.mark.parametrize("harness", sorted(REAL_ADAPTERS))
def test_every_shipped_harness_satisfies_the_protocol(harness):
    assert isinstance(REAL_ADAPTERS[harness](), HarnessAdapter)


async def test_the_two_harnesses_differ_in_exactly_one_visible_way():
    """The point of having two, asserted rather than described (spec 018).

    Both produce tool calls answered by tool results. The prompt agent's are `executor: "app"` —
    the BFF ran them — and the hosted agent's are `executor: "foundry"`, because the container did.
    Everything else the contract carries is the same shape.
    """
    prompt = await run_conformance(_prompt_agent_adapter())
    hosted = await run_conformance(_langgraph_adapter())

    def executors(events):
        return {e["executor"] for e in events if e["type"] == "tool_call"}

    assert executors(prompt) == {"app"}
    assert executors(hosted) == {"foundry"}

    # And the difference the harnesses inherit from WHO holds the MCP session (decision 5).
    assert any(e["type"] == "mcp_call" for e in prompt)
    assert not any(e["type"] == "mcp_call" for e in hosted)
