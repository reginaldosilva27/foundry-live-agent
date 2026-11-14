"""Every turn states the current moment, once (spec 067, AC1 · AC3 · AC5 · AC7 · AC8).

The sentence itself is pinned in `ai/tests/test_current_moment.py`. These tests pin where it goes:
ahead of the person's message on a text turn, never on the leg that answers a tool call, and once
when a voice session opens — and that nothing about time arrives from the browser.
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from harness._shared.current_moment import current_moment_item

from app.routers.chat import ChatRequest, chat, turn_messages
from app.settings import SettingsError, load_settings
from app.voice_session import VoiceSession
from tests.test_harness_factory import CALL, COMPLETED, harness
from tests.test_voice import SDP_OFFER, FakeSocket, app_with, open_session

LATE_EVENING = datetime(2026, 11, 15, 1, 30, tzinfo=UTC)


def _context_items(sent: list[dict]) -> list[str]:
    return [
        frame["item"]["content"][0]["text"]
        for frame in sent
        if frame["type"] == "conversation.item.create" and frame["item"].get("role") == "system"
    ]


# --- AC3: the timezone is checked when the app starts ------------------------


def test_the_default_timezone_is_sao_paulo(monkeypatch):
    monkeypatch.delenv("AGENT_TIMEZONE", raising=False)
    assert load_settings().agent_timezone == "America/Sao_Paulo"


def test_the_deployment_declares_the_timezone(monkeypatch):
    monkeypatch.setenv("AGENT_TIMEZONE", "Europe/Lisbon")
    assert load_settings().agent_timezone == "Europe/Lisbon"


def test_an_unknown_timezone_refuses_to_load_and_names_the_setting(monkeypatch):
    """AC3 — at startup, not on the first turn, where it would surface as a `harness_error`."""
    monkeypatch.setenv("AGENT_TIMEZONE", "America/Atlantis")
    with pytest.raises(SettingsError, match="AGENT_TIMEZONE"):
        load_settings()


# --- AC1: the moment goes ahead of the message -------------------------------


def test_a_turn_is_the_moment_then_the_message_unchanged():
    """AC1 — both items typed: two untyped items are refused by the service (spec 067, Risks)."""
    messages = turn_messages("quanto foi o jogo do Brasil?", "America/Sao_Paulo", now=LATE_EVENING)

    assert messages == [
        current_moment_item("America/Sao_Paulo", now=LATE_EVENING),
        {"type": "message", "role": "user", "content": "quanto foi o jogo do Brasil?"},
    ]


async def test_the_route_hands_the_harness_the_moment_in_the_declared_timezone():
    """AC1 — wired: the route reads the deployment's timezone, not the server's."""
    seen: list[list[dict]] = []

    class Harness:
        async def stream_response(self, messages, state):
            seen.append(list(messages))
            yield {"type": "done", "response_id": "resp_1"}

    state = SimpleNamespace(harness=Harness(), settings=load_settings(agent_timezone="UTC"))
    request = SimpleNamespace(app=SimpleNamespace(state=state))
    response = await chat(ChatRequest(message="oi"), request)
    async for _ in response.body_iterator:
        pass

    (messages,) = seen
    assert messages[0]["role"] == "developer"
    assert "(UTC, UTC+00:00)" in messages[0]["content"]
    assert messages[1] == {"type": "message", "role": "user", "content": "oi"}


# --- AC5: once per turn, not once per leg ------------------------------------


async def test_the_leg_that_answers_a_tool_call_carries_only_outputs(monkeypatch):
    """AC5 — the moment is stated once. The output leg must carry only `function_call_output`
    items, or the round trip that Foundry is waiting on stops being the round trip it asked for."""
    adapter, openai = harness(monkeypatch, [[CALL, COMPLETED], [COMPLETED]])

    events = [e async for e in adapter.stream_response(turn_messages("hi", "UTC"), {})]

    assert events[-1]["type"] == "done"
    first, second = (request["input"] for request in openai.requests)
    assert first[0]["role"] == "developer"
    assert first[1]["content"] == "hi"
    assert {item["type"] for item in second} == {"function_call_output"}


# --- AC8: nothing about time comes from the browser --------------------------


def test_the_chat_request_still_takes_three_fields():
    """AC8 — the timezone is the deployment's; the browser's clock and locale never travel.
    `App.routing.test.tsx` pins the same three keys from the frontend side."""
    assert set(ChatRequest.model_fields) == {"message", "conversation_id", "agent"}


# --- AC7: a voice session states it once, when it opens ----------------------


async def test_a_voice_session_opens_with_exactly_two_context_items():
    """AC7 — spec 017's spoken-conversation item, then the moment. Two, and no more."""
    socket = FakeSocket([])
    session = VoiceSession("s-moment", socket, timezone="America/Sao_Paulo")

    await session.negotiate(SDP_OFFER)
    await session.close()

    spoken, moment = _context_items(socket.sent)
    assert "spoken" in spoken.lower()
    assert moment.startswith("Current date and time: ")
    assert "(America/Sao_Paulo, UTC-03:00)" in moment


def test_the_voice_route_uses_the_deployments_timezone():
    """AC7 — wired: the session is built with the setting, not with a default of its own."""
    socket = FakeSocket([])
    app, _ = app_with(socket, agent_timezone="UTC")

    with TestClient(app) as client:
        open_session(client)

    assert "(UTC, UTC+00:00)" in _context_items(socket.sent)[1]
