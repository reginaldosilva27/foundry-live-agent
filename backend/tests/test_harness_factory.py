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

    def build(_settings):
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
