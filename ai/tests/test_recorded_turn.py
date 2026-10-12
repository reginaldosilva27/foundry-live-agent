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
PREAMBLE = FIXTURES / "prompt-agent-preamble-20260916.jsonl"
WRITTEN = FIXTURES / "prompt-agent-written-citations-20260916.jsonl"


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
    # A later recording, on a newer agent version: still nothing the table does not know.
    assert unmapped_types(events(PREAMBLE)) == {}


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


async def test_usage_carries_the_cache_foundry_reported():
    """Spec 028 AC5 — the prompt cache, from the stream rather than from spans.

    Foundry puts `cached_tokens` in `input_tokens_details`, in the very payload the normaliser
    already reads `output_tokens_details` from. Recorded here: leg one cached nothing, leg two
    served 1024 of its 17520 input tokens from cache. The number is Foundry's, not ours.

    It is a **subset** of `input_tokens`, which the same recording proves: `total_tokens` is
    17783 == 17401 + 382 on that leg, with the cache counted inside the input, not beside it.
    """
    usage = next(e for e in await collect(replay(WITH_REASONING)) if e["type"] == "usage")

    assert usage["cached_input_tokens"] == 0 + 1024
    assert usage["cached_input_tokens"] < usage["input_tokens"]


async def test_usage_reports_a_cache_of_zero_rather_than_omitting_it():
    """Zero cache is a measurement, and `0` is what Foundry said.

    The distinction that matters is *absent* vs *zero*: a turn Foundry said nothing about must not
    render as free (§5), and a turn it said `0` about is honestly zero. This recording contains
    both legs, so the summed field is present and the pricing layer can trust it.
    """
    usage = next(e for e in await collect(replay(PREAMBLE)) if e["type"] == "usage")

    assert usage["cached_input_tokens"] == 0 + 0 + 3584


# --- spec 016 AC3: the agent speaks before it goes quiet --------------------


async def test_the_agent_speaks_before_it_calls_a_tool():
    """The whole point of spec 016, and the only test that can prove it.

    An instruction is a request to a model, not a guarantee — the unit test on `agent.yaml` proves
    the rule was written, and this one proves `gpt-5.5` obeyed it. Recorded 2026-09-16 against
    agent version 6, asking in Portuguese for Corinthians' last match: the turn opens with
    *"Vou verificar na web e confirmar a data atual para identificar o jogo mais recente."*
    and only then calls a tool.

    If a future definition loses the rule, this fails with the fixture untouched — which is the
    correct failure, because the fixture is a claim about Foundry and never edited to pass (§5).
    """
    types = [event["type"] for event in await collect(replay(PREAMBLE))]

    assert types.index("text_delta") < types.index("tool_call"), (
        "the turn went straight to the tool — in voice mode that is unexplained silence"
    )


async def test_the_preamble_is_one_short_sentence_and_names_no_tool():
    """AC2 as the model actually performed it, not as the instruction asked for it."""
    events_ = await collect(replay(PREAMBLE))
    spoken = "".join(
        event["text"]
        for event in events_[: [e["type"] for e in events_].index("tool_call")]
        if event["type"] == "text_delta"
    )

    assert 0 < len(spoken) < 200, f"a preamble of {len(spoken)} chars is not a short sentence"
    assert spoken.count(".") == 1, "one sentence, not a paragraph"
    for identifier in ("search_web", "get_current_datetime", "lookup_knowledge"):
        assert identifier not in spoken


def test_the_recording_covers_a_multi_leg_turn():
    """A guard on the fixture: three legs and three function calls, so 'once, not per call' is
    something this recording can actually speak to.

    What it says, observed: the agent narrates **once per leg**, not once per call — leg 1 covers
    two calls with one sentence. That is not what the instruction literally asks for, and it is
    better than what it asks for: each leg is a separate silence to fill.
    """
    calls = [
        e["item"]
        for e in events(PREAMBLE)
        if e["type"] == "response.output_item.done" and e["item"]["type"] == "function_call"
    ]

    assert len(legs(PREAMBLE)) == 3
    assert len(calls) == 3


# --- spec 017 AC4: the written answer keeps its sources --------------------


def test_the_written_answer_still_cites_its_sources():
    """The other half of the pair. Spec 017 suppresses URLs **in speech**, and the way to be sure it
    did not simply delete citations everywhere is to record the same question in the other modality
    and find them still there.

    Recorded 2026-09-16 on agent version 8 — the same version as the voice recording, with no
    session context item, because the text path sends none.
    """
    answer = "".join(
        event["text"] for event in events(WRITTEN) if event["type"] == "response.output_text.done"
    )

    assert "https://" in answer, "the written chat lost its citations — spec 013's whole point"


async def test_recorded_final_leg_outputs_are_submitted_at_budget_one():
    remaining = legs(WITH_REASONING)
    submitted = []

    def factory(inputs, state):
        submitted.append((list(inputs), state))
        return iter(remaining.pop(0))

    a = PromptAgentAdapter(factory, lambda n, args: ("{}", 0, None), "agent", "project")
    a.max_turns = 1
    state = {"conversation_id": "conv_recorded"}
    events_ = [e async for e in a.stream_response([{"role": "user", "content": "hi"}], state)]
    assert len(submitted) == 2
    assert all(request[1] is state for request in submitted)
    results = [e for e in events_ if e["type"] == "tool_result"]
    assert len(results) == 2
    assert submitted[1][0] == [
        {"type": "function_call_output", "call_id": result["call_id"], "output": result["output"]}
        for result in results
    ]
    assert [e["type"] for e in events_ if e["type"] in {"done", "error"}] == ["done"]
    usage = next(e for e in events_ if e["type"] == "usage")
    assert usage["input_tokens"] == 1091 + 17520
    assert usage["output_tokens"] == 132 + 754
    check_stream(events_)
