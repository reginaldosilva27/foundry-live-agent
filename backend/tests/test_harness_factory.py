"""The production stream factory: one conversation per turn (regression).

Observed 2026-09-15 against the live service: the second leg of a turn carries only
`function_call_output` items. Unless it names the same conversation as the leg that emitted the
call, Foundry has no record of the call being answered and rejects the request with

    400 — No tool call found for function call output with call_id call_…

which reached the browser as a `harness_error` after the tool card had already rendered green.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app import harness_factory
from app.harness_factory import build_harness
from app.settings import load_settings

COMPLETED = {"type": "response.completed", "response": {"id": "resp_1"}}
CALL = {
    "type": "response.output_item.done",
    "item": {
        "type": "function_call",
        "call_id": "call_1",
        "name": "get_current_datetime",
        "arguments": '{"timezone":"UTC"}',
    },
}


class FakeOpenAI:
    """The two surfaces the factory touches: `conversations.create` and `responses.create`."""

    def __init__(self, legs: list[list[dict]]) -> None:
        self._legs = legs
        self.created_conversations = 0
        self.requests: list[dict] = []
        self.conversations = SimpleNamespace(create=self._create_conversation)
        self.responses = SimpleNamespace(create=self._create_response)

    def _create_conversation(self):
        self.created_conversations += 1
        return SimpleNamespace(id=f"conv_{self.created_conversations}")

    def _create_response(self, **request):
        self.requests.append(request)
        return iter(self._legs.pop(0))


def harness(monkeypatch, legs: list[list[dict]], built: list | None = None):
    openai = FakeOpenAI(legs)

    def build(*_args):
        if built is not None:
            built.append(openai)
        return openai

    monkeypatch.setattr(harness_factory, "_openai_client", build)
    settings = load_settings(
        project_endpoint="https://example.services.ai.azure.com/api/projects/proj",
        project_name="proj",
        agent_name="foundry-live-agent",
        model="conn/gpt-4o",
        harness="prompt-agent",
    )
    return build_harness(settings), openai


async def drain(adapter, state):
    messages = [{"role": "user", "content": "hi"}]
    return [event async for event in adapter.stream_response(messages, state)]


@pytest.mark.asyncio
async def test_both_legs_of_a_tool_round_trip_name_the_same_conversation(monkeypatch):
    adapter, openai = harness(monkeypatch, [[CALL, COMPLETED], [COMPLETED]])

    events = await drain(adapter, {})

    assert [e["type"] for e in events][-1] == "done"
    conversations = [r["conversation"] for r in openai.requests]
    assert len(conversations) == 2
    assert conversations[0] == conversations[1]
    assert openai.created_conversations == 1


@pytest.mark.asyncio
async def test_a_turn_that_arrives_with_a_conversation_reuses_it(monkeypatch):
    adapter, openai = harness(monkeypatch, [[COMPLETED]])

    await drain(adapter, {"conversation_id": "conv_existing"})

    assert [r["conversation"] for r in openai.requests] == ["conv_existing"]
    assert openai.created_conversations == 0


@pytest.mark.asyncio
async def test_the_conversation_is_reported_back_so_the_next_turn_can_continue_it(monkeypatch):
    """The turn's state carries the new id out, so the next `POST /chat` names the same thread."""
    adapter, _ = harness(monkeypatch, [[COMPLETED]])
    state: dict = {}

    await drain(adapter, state)

    assert state["conversation_id"] == "conv_1"


@pytest.mark.asyncio
async def test_the_client_is_built_once_rather_than_per_leg(monkeypatch):
    """Each build is a fresh `DefaultAzureCredential`, and acquiring a token costs seconds — dead
    time before a single byte reaches the browser, paid again on the second leg of every turn."""
    built: list = []
    adapter, _ = harness(monkeypatch, [[CALL, COMPLETED], [COMPLETED], [COMPLETED]], built=built)

    await drain(adapter, {})
    await drain(adapter, {"conversation_id": "conv_1"})

    assert len(built) == 1


# --- the second harness (spec 018, AC1) -----------------------------------
#
# Until spec 018 the factory's langgraph branch returned an object whose constructor raised, and a
# test here asserted exactly that. It now returns a working adapter, so the assertion inverts: the
# scaffold's sentinel must be gone and no NotImplementedError may be reachable on the request path.


HOSTED_CALL = {
    "type": "response.output_item.done",
    "item": {
        "type": "function_call",
        "call_id": "call_h1",
        "name": "get_current_datetime",
        "arguments": '{"timezone":"UTC"}',
    },
}
HOSTED_OUTPUT = {
    "type": "response.output_item.done",
    "item": {
        "type": "function_call_output",
        "call_id": "call_h1",
        "output": '{"iso":"2026-09-16T12:00:00Z"}',
    },
}
HOSTED_COMPLETED = {"type": "response.completed", "response": {"id": "caresp_1"}}


def hosted_settings(**overrides):
    values = {
        "project_endpoint": "https://example.services.ai.azure.com/api/projects/proj",
        "project_name": "proj",
        "model": "gpt-5.5",
        "harness": "langgraph",
    }
    return load_settings(**{**values, **overrides})


def test_the_langgraph_harness_builds_a_working_adapter():
    """AC1 — `AGENT_HARNESS=langgraph` no longer fails by design."""
    from harness._shared.contract import HarnessAdapter

    adapter = build_harness(hosted_settings(), stream_factory=lambda *_: iter(()))

    assert isinstance(adapter, HarnessAdapter)


def test_the_langgraph_harness_takes_its_agent_name_from_its_own_definition():
    """The hosted agent cannot share a name with the prompt agent in one project, and adding an
    env var that can disagree with the definition would be a second source of truth (§4). AGENT_NAME
    stays the prompt agent's."""
    adapter = build_harness(hosted_settings(), stream_factory=lambda *_: iter(()))

    assert adapter.voice_attachment_params()["agent_name"] == "foundry-live-agent-hosted"


@pytest.mark.asyncio
async def test_the_langgraph_harness_streams_a_turn_the_app_never_has_to_answer():
    """The structural difference, through the factory: tool calls arrive already answered."""
    legs = [[HOSTED_CALL, HOSTED_OUTPUT, HOSTED_COMPLETED]]
    adapter = build_harness(hosted_settings(), stream_factory=lambda *_: iter(legs.pop(0)))

    events = await drain(adapter, {})

    assert [e["type"] for e in events][-1] == "done"
    calls = [e for e in events if e["type"] == "tool_call"]
    assert [e["executor"] for e in calls] == ["foundry"]
    assert [e["call_id"] for e in events if e["type"] == "tool_result"] == ["call_h1"]


def test_the_scaffold_sentinel_is_gone_from_the_shipped_package():
    """AC1's second half. The old module said "not implemented" in a sentence; a stale copy of that
    sentence would be the most confusing thing a reader of a working harness could find."""
    from pathlib import Path

    package = Path(harness_factory.__file__).resolve().parents[2] / "ai" / "harness" / "langgraph"
    for source in package.rglob("*.py"):
        assert "documented scaffold, not an implementation" not in source.read_text(), source


def test_an_unknown_harness_still_fails_at_startup():
    with pytest.raises(ValueError, match="unknown harness"):
        build_harness(hosted_settings(harness="telepathy"))


# --- spec 019: a harness for a chosen agent --------------------------------


def selected(name: str, kind: str):
    from app.agents import AgentSummary

    return AgentSummary(
        name=name,
        kind=kind,
        version="1",
        version_status="active",
        model="gpt-5.5",
        harness="prompt-agent",
        selectable=True,
        reason="",
    )


def test_a_harness_built_for_a_selected_agent_talks_to_that_agent(monkeypatch):
    """AC6, at the only level where "runs against that agent" is literally observable: the
    `agent_reference` the Responses call carries."""
    openai = FakeOpenAI([[COMPLETED]])
    monkeypatch.setattr(harness_factory, "_openai_client", lambda *_: openai)
    settings = load_settings(
        project_endpoint="https://example.services.ai.azure.com/api/projects/proj",
        project_name="proj",
        agent_name="foundry-live-agent",
        model="conn/gpt-4o",
        harness="prompt-agent",
    )

    adapter = build_harness(settings, agent=selected("spike-reasoning", "prompt"))
    import asyncio

    asyncio.run(drain(adapter, {}))

    assert openai.requests[0]["extra_body"]["agent_reference"]["name"] == "spike-reasoning"


def test_the_kind_decides_the_harness_not_the_configured_default():
    """`AGENT_HARNESS` is the default, not the law (decision 5). An app configured for the prompt
    agent still drives a selected hosted agent with the hosted harness."""
    settings = load_settings(
        project_endpoint="https://example.services.ai.azure.com/api/projects/proj",
        project_name="proj",
        agent_name="foundry-live-agent",
        model="conn/gpt-4o",
        harness="prompt-agent",
    )

    adapter = build_harness(
        settings,
        stream_factory=lambda *_: iter(()),
        agent=selected("foundry-live-agent-hosted", "hosted"),
    )

    assert adapter.voice_attachment_params()["agent_name"] == "foundry-live-agent-hosted"
    assert type(adapter).__name__ == "LangGraphAdapter"


def test_a_kind_with_no_harness_is_refused_rather_than_guessed():
    settings = hosted_settings(harness="prompt-agent", agent_name="foundry-live-agent")

    with pytest.raises(ValueError, match="no harness"):
        build_harness(settings, agent=selected("DatabricksGenie", "workflow"))


def test_per_turn_harnesses_share_one_client_rather_than_one_each(monkeypatch):
    """The plan's named risk. Each `DefaultAzureCredential` costs seconds to acquire a token, so a
    harness built per turn that also built a client per turn would put that cost on every message —
    the exact symptom spec 002 documented, reintroduced by spec 019."""
    built: list = []
    openai = FakeOpenAI([[COMPLETED], [COMPLETED]])

    def build(*_args):
        built.append(openai)
        return openai

    monkeypatch.setattr(harness_factory, "_openai_client", build)
    settings = load_settings(
        project_endpoint="https://example.services.ai.azure.com/api/projects/proj",
        project_name="proj",
        agent_name="foundry-live-agent",
        model="conn/gpt-4o",
        harness="prompt-agent",
    )
    clients = harness_factory.AzureClients()

    import asyncio

    for _turn in range(2):
        adapter = build_harness(
            settings, agent=selected("spike-reasoning", "prompt"), clients=clients
        )
        asyncio.run(drain(adapter, {}))

    assert len(built) == 1
