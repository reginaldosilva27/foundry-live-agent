"""Replay of REAL hosted-agent turns (spec 018, AC3 · AC4 · AC9 · AC10 · AC13).

Recorded on **2026-09-16** against `foundry-live-agent-hosted` version 1 — a LangGraph graph running
as a Foundry hosted agent, 1 vCPU / 2 GiB, in project `ai-admin2354ai223634534-project` (eastus2) —
by `scripts/spike_hosted.py`, and redacted by `scripts/redact_fixture.py`. So an assertion here is a
claim about Foundry, not about us (§5, §10).

The fixtures come in a pair on purpose, and the pair *is* the finding this spec exists to produce:

    prompt-agent-turn-20260915.jsonl        Foundry is the MCP client -> `mcp_call`
    langgraph-hosted-learn-20260916.jsonl   the CONTAINER is the MCP client -> plain tool calls

Same question, same instructions, same model. Only the harness changed.
"""

import json
from collections.abc import Iterator
from pathlib import Path

from harness._shared.contract import check_stream
from harness.langgraph.adapter import LangGraphAdapter
from harness.langgraph.events import normalise

FIXTURES = Path(__file__).parent / "fixtures" / "recorded"
LEARN = FIXTURES / "langgraph-hosted-learn-20260916.jsonl"
FUNCTION = FIXTURES / "langgraph-hosted-function-20260916.jsonl"
VOICE = FIXTURES / "langgraph-hosted-voice-20260916.jsonl"
PROMPT_AGENT = FIXTURES / "prompt-agent-turn-20260915.jsonl"


def raw(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def events(path: Path) -> list[dict]:
    return list(normalise(raw(path)))


def replay(path: Path) -> LangGraphAdapter:
    recorded = raw(path)

    def stream_factory(_messages, _state) -> Iterator[dict]:
        return iter(recorded)

    return LangGraphAdapter(
        stream_factory=stream_factory,
        agent_name="foundry-live-agent-hosted",
        project_name="test-project",
    )


# --- AC3: who is the MCP client -------------------------------------------


def test_the_hosted_agent_never_emits_an_mcp_call():
    """Decision 5, confirmed live. With a prompt agent, Foundry is the MCP client for you and the
    Learn call arrives as an `mcp_call`. With a hosted agent, YOU are the client — the container
    holds the MCP session — so the same call is an ordinary tool call in its own loop."""
    assert [e for e in events(LEARN) if e["type"] == "mcp_call"] == []


def test_the_prompt_agent_still_does_emit_one():
    """The other half of the pair. Without this, the assertion above could pass because the
    normaliser simply lost the event."""
    from harness.prompt_agent.events import normalise as prompt_normalise

    mcp = [e for e in prompt_normalise(raw(PROMPT_AGENT)) if e["type"] == "mcp_call"]
    assert mcp, "the prompt-agent fixture must still show Foundry acting as the MCP client"
    assert {e["server_label"] for e in mcp} == {"microsoft_learn"}


def test_the_learn_call_arrives_as_a_foundry_executed_tool_call():
    """AC3 — the same work, reported as `tool_call`/`tool_result` with `executor: "foundry"`.

    The names are the Learn server's own (`microsoft_docs_search`, `microsoft_docs_fetch`), not the
    `microsoft_learn` label the definition uses: observed 2026-09-16, that one server exposes three
    tools, and the container binds them individually.
    """
    calls = [e for e in events(LEARN) if e["type"] == "tool_call"]
    assert calls, "the Learn turn must show the calls the container made"
    assert {e["executor"] for e in calls} == {"foundry"}
    assert all(e["name"].startswith("microsoft_docs_") for e in calls)

    results = {e["call_id"] for e in events(LEARN) if e["type"] == "tool_result"}
    assert {e["call_id"] for e in calls} <= results, "every call the container made is answered"


# --- AC4: a function tool, executed in the container ----------------------


def test_a_function_tool_runs_in_the_container_and_carries_its_real_output():
    """AC4 — the same two events the prompt agent produces, differing only in the executor.

    With the prompt agent these are `executor: "app"` and the BFF runs them. Here the app never
    sees them: they are already answered when they arrive.
    """
    calls = {e["call_id"]: e for e in events(FUNCTION) if e["type"] == "tool_call"}
    results = {e["call_id"]: e for e in events(FUNCTION) if e["type"] == "tool_result"}

    assert sorted(c["name"] for c in calls.values()) == [
        "get_current_datetime",
        "lookup_knowledge",
    ]
    assert {c["executor"] for c in calls.values()} == {"foundry"}
    assert calls.keys() == results.keys()

    datetime_call = next(c for c in calls.values() if c["name"] == "get_current_datetime")
    output = json.loads(results[datetime_call["call_id"]]["output"])
    assert output["timezone"] == "America/Sao_Paulo", "the tool's real output, not a placeholder"


def test_the_app_is_never_asked_to_execute_anything():
    """The structural difference between the harnesses, as an assertion.

    `check_stream` only requires `executor="app"` calls to be answered. Here there are none at
    all, which is why this adapter is a single leg with no loop and `submit_tool_output` is never
    reached on the request path.
    """
    for path in (LEARN, FUNCTION):
        assert not [
            e for e in events(path) if e["type"] == "tool_call" and e["executor"] == "app"
        ]


# --- the stream as a whole -------------------------------------------------


def test_both_recorded_turns_are_valid_streams():
    for path in (LEARN, FUNCTION):
        check_stream(events(path))


def test_a_turn_is_one_leg():
    """Observed 2026-09-16: exactly one `response.completed`.

    The prompt agent sends two — Foundry completes the leg it is waiting on — which is why that
    adapter accumulates usage and holds `done` back. This harness needs neither, because the
    container never hands the turn back mid-flight.
    """
    for path in (LEARN, FUNCTION):
        assert sum(1 for e in raw(path) if e["type"] == "response.completed") == 1


def test_the_answer_is_streamed_as_text():
    text = "".join(e["text"] for e in events(LEARN) if e["type"] == "text_delta")
    assert len(text) > 200, "the turn must carry the assistant's visible answer"


# --- AC13: reasoning summaries --------------------------------------------


def test_a_hosted_turn_carries_no_reasoning_summary():
    """AC13 — measured, not assumed, and the answer is *none*.

    `reasoning` is a prompt-agent *definition* field: it configures Foundry's own runtime. This
    harness runs our loop against a chat-completions call, and nothing in that path produces a
    summary. Spec 015 already made an empty reasoning card a survivable state, so the UI is
    correct as it stands — but the comparison must say so rather than leave the panel looking
    broken.
    """
    for path in (LEARN, FUNCTION):
        assert not [e for e in events(path) if e["type"] == "reasoning_summary"]


# --- AC10: what a hosted trace actually looks like -------------------------


def test_a_hosted_turn_reports_no_usage():
    """Observed 2026-09-16: `response.completed` carries `usage: null`.

    The prompt agent reports tokens; this one does not. The contract always allowed `usage` to be
    absent — `check_stream` forbids a second one, never requires a first — so §9 is untouched. What
    it costs is real: the cost line is empty on this harness, and spec 020's comparison must render
    that as "not reported" rather than as zero.
    """
    for path in (LEARN, FUNCTION):
        assert not [e for e in events(path) if e["type"] == "usage"]
        completed = next(e for e in raw(path) if e["type"] == "response.completed")
        assert completed["response"]["usage"] is None


def test_the_turn_still_carries_trace_ids_so_the_panel_has_something_to_query():
    """`check_stream` requires a non-empty `response_id` on any stream ending in `done`."""
    for path in (LEARN, FUNCTION):
        trace = next(e for e in events(path) if e["type"] == "trace_ids")
        assert trace["response_id"].startswith("caresp_")


def test_the_spans_are_not_reachable_by_response_id_and_the_fixture_shows_why():
    """AC10 — the measurement, written down as a test rather than a sentence in a doc.

    Queried against the live workspace on 2026-09-16: **no span carries `gen_ai.response.id`** at
    all. The hosted agent's spans key on `microsoft.session.id`, which equals the response's
    `agent_session_id` — 29 spans matched the recorded turn that way, including `invoke_agent
    LangGraph`, `invoke_agent tools_condition` and `execute_tool microsoft_docs_search`.

    So the trace panel's join (`gen_ai.response.id == response_id`, spec 005) finds nothing here.
    Carrying `agent_session_id` on `trace_ids` would fix it and would be an `AgentEvent` change —
    which this spec lists as a non-goal and §9 says needs its own spec. The finding ships; the
    change does not.
    """
    for path in (LEARN, FUNCTION):
        completed = next(e for e in raw(path) if e["type"] == "response.completed")
        assert completed["response"]["agent_session_id"], (
            "the only identifier that joins a hosted turn to its spans"
        )


# --- AC9: voice attaches ---------------------------------------------------


def test_voice_live_attaches_to_the_hosted_agent():
    """AC9 — attempted live on 2026-09-16, and the service accepted it.

    Same `agent_name` + `agent_project_name` query the prompt agent uses; only the agent named
    changed. The session reports the hosted agent as its `model` and echoes the agent definition,
    so voice really is attached to this harness and not silently falling back.

    Because it attaches, the "voice unavailable" branch AC9 provided for does not ship, and no
    bilingual refusal string exists to maintain.
    """
    frames = raw(VOICE)
    created = next(f for f in frames if f["type"] == "session.created")
    session = created["session"]

    assert session["agent"]["name"] == "foundry-live-agent-hosted"
    assert session["model"] == "foundry-live-agent-hosted"
    assert session["instructions"] is None, (
        "`instructions` is unsupported with a custom agent — on this harness too"
    )


# --- the adapter, driven by the recordings --------------------------------


def test_the_adapter_replays_a_recorded_turn_as_a_conforming_stream():
    import asyncio

    async def collect():
        return [e async for e in replay(LEARN).stream_response([], {})]

    check_stream(asyncio.run(collect()))
