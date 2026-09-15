"""Replay of a REAL Foundry turn (spec 002, T12).

Every other test in this suite feeds the normaliser event shapes *we* wrote. This one feeds it
310 events Foundry actually sent, captured by `scripts/spike.py` on **2026-09-15** against project
`ai-admin2354ai223634534-project`, agent `spike-reasoning`, model `gpt-5.5`, and redacted by
`scripts/redact_fixture.py`. So an assertion here is a claim about Foundry, not about us
(constitution §5, §10).

The recorded turn is the interesting one: it contains reasoning summaries, **both** kinds of tool
(two function calls the app executes, two MCP calls Foundry executes), streamed answer text, and
the function-call round trip — which means Foundry sent `response.completed` on the leg that was
still waiting for our tool output.
"""

import json
from collections.abc import Iterator
from pathlib import Path

from harness._shared.contract import check_stream
from harness.prompt_agent.adapter import PromptAgentAdapter
from harness.prompt_agent.events import normalise, unmapped_types

FIXTURES = Path(__file__).parent / "fixtures" / "recorded"
WITH_REASONING = FIXTURES / "prompt-agent-turn-20260915.jsonl"
WITHOUT_REASONING = FIXTURES / "prompt-agent-no-reasoning-20260915.jsonl"


def events(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def legs(path: Path) -> list[list[dict]]:
    """Split a recording into the round trips it was made of.

    Foundry ends each leg with `response.completed`; the next leg starts when we submit the tool
    output. Replaying leg by leg is what the adapter really sees.
    """
    out: list[list[dict]] = []
    current: list[dict] = []
    for event in events(path):
        current.append(event)
        if event["type"] == "response.completed":
            out.append(current)
            current = []
    if current:
        out.append(current)
    return out


def replay(path: Path) -> PromptAgentAdapter:
    remaining = legs(path)

    def stream_factory(_inputs, _state) -> Iterator[dict]:
        return iter(remaining.pop(0))

    def executor(name: str, arguments: str) -> tuple[str, int, str | None]:
        return json.dumps({"replayed": name, "arguments": json.loads(arguments)}), 5, None

    return PromptAgentAdapter(
        stream_factory=stream_factory,
        executor=executor,
        agent_name="spike-reasoning",
        project_name="ai-admin2354ai223634534-project",
    )


async def collect(adapter: PromptAgentAdapter) -> list[dict]:
    return [e async for e in adapter.stream_response([{"role": "user", "content": "hi"}], {})]


# --- what was actually recorded -------------------------------------------


def test_the_recording_is_a_whole_turn_with_both_kinds_of_tool():
    """A guard on the fixture itself: if it stops covering the interesting cases, say so."""
    items = [e["item"] for e in events(WITH_REASONING) if e["type"] == "response.output_item.done"]
    kinds = [item["type"] for item in items]

    assert kinds.count("function_call") == 2, "the app-executed half of the story is missing"
    assert kinds.count("mcp_call") == 2, "the Foundry-executed half of the story is missing"
    assert kinds.count("reasoning") >= 1
    assert "message" in kinds
    assert len(legs(WITH_REASONING)) == 2, "a function-call round trip is two legs"


def test_foundry_completes_the_leg_that_is_still_waiting_for_our_tool_output():
    """The observation that drives the adapter's shape.

    Foundry does not hold the stream open while it waits: it emits the function calls, says
    `response.completed`, and waits for a *new* request carrying the outputs. So a leg's terminal
    is not the turn's terminal, and an adapter that forwards it emits `done` mid-stream.
    """
    first_leg = legs(WITH_REASONING)[0]
    kinds = [e["item"]["type"] for e in first_leg if e["type"] == "response.output_item.done"]

    assert first_leg[-1]["type"] == "response.completed"
    assert "function_call" in kinds


# --- the normaliser against the real wire ---------------------------------


def test_the_normaliser_knows_every_event_type_foundry_sent():
    """Nothing in a real stream may land in the unmapped bucket."""
    assert unmapped_types(events(WITH_REASONING)) == {}
    assert unmapped_types(events(WITHOUT_REASONING)) == {}


def test_an_mcp_call_carries_the_server_that_ran_it_and_its_output():
    """`response.mcp_call.completed` carries no item — only `item_id`. The data is in
    `response.output_item.done`, and reading the wrong one loses the whole card."""
    mcp = [e for e in normalise(events(WITH_REASONING)) if e["type"] == "mcp_call"]

    assert [e["name"] for e in mcp] == ["microsoft_docs_search", "microsoft_docs_fetch"]
    assert {e["server_label"] for e in mcp} == {"microsoft_learn"}
    assert all(e["output"] for e in mcp), "an MCP card with no output has nothing to show"
    assert all("error" not in e for e in mcp)


def test_the_two_function_calls_are_marked_as_ours_to_execute():
    calls = [e for e in normalise(events(WITH_REASONING)) if e["type"] == "tool_call"]

    assert [e["name"] for e in calls] == ["get_current_datetime", "lookup_knowledge"]
    assert {e["executor"] for e in calls} == {"app"}
    assert all(json.loads(e["arguments"]) for e in calls)


def test_reasoning_summaries_arrive_as_streamed_text():
    """O-9, answered: they do — once `reasoning.summary` is set on the agent definition."""
    summary = "".join(
        e["text"] for e in normalise(events(WITH_REASONING)) if e["type"] == "reasoning_summary"
    )
    assert len(summary) > 200


def test_the_same_agent_without_reasoning_configured_emits_no_summary():
    """The contrast that makes the finding legible: identical code, identical tools, no summaries —
    because the request-level `reasoning` parameter is rejected when an agent is specified."""
    assert not [e for e in normalise(events(WITHOUT_REASONING)) if e["type"] == "reasoning_summary"]


# --- the turn, end to end -------------------------------------------------


async def test_replaying_the_recording_conforms_to_the_contract():
    check_stream(await collect(replay(WITH_REASONING)))


async def test_the_turn_terminates_once_and_answers_every_call():
    types = [e["type"] for e in await collect(replay(WITH_REASONING))]

    assert types.count("done") == 1, "an intermediate leg's completion is not the turn's terminal"
    assert types[-1] == "done"
    assert types.count("tool_call") == types.count("tool_result") == 2
    assert types.count("usage") == 1, "two legs, one usage event"


async def test_usage_is_the_whole_turn_not_the_last_leg():
    """Both legs bill. Reporting only the last one understates the turn — recorded: 1091 + 17520
    input, 132 + 754 output, 68 + 342 reasoning."""
    usage = next(e for e in await collect(replay(WITH_REASONING)) if e["type"] == "usage")

    assert usage["input_tokens"] == 1091 + 17520
    assert usage["output_tokens"] == 132 + 754
    assert usage["reasoning_tokens"] == 68 + 342
