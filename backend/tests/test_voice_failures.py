"""A voice session that fails on the way up must not keep a socket, a slot, or the cap's promise.

Regressions from the 2026-10-15 assessment. Three holes, all in the stretch between a browser
asking for a session and the session being registered:

- the `MAX_SESSIONS` check ran before three long awaits and the insert after them, so concurrent
  requests all passed the check and the cap was never a cap;
- only `NegotiationError` closed the socket — any other failure left an open control channel to a
  service that bills per second, held by nothing;
- a receive loop that died enqueued its terminal event but never marked the session closed, so the
  sweep that frees dead sessions could not see it.
"""

from __future__ import annotations

import asyncio

import httpx
from fastapi.testclient import TestClient

from app.main import create_app
from app.routers.voice import MAX_SESSIONS
from app.voice_session import VoiceSession
from tests.test_voice import RECORDED, SDP_OFFER, FakeSocket


def _app(connect):
    return create_app(
        voice_connect=connect,
        project_endpoint="https://example.services.ai.azure.com/api/projects/p",
        project_name="p",
        model="gpt-5.5",
    )


async def test_concurrent_requests_cannot_open_more_than_the_cap():
    async def slow_connect(_query):
        await asyncio.sleep(0.2)  # the window every request used to slip through
        return FakeSocket(RECORDED)

    app = _app(slow_connect)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://bff"
    ) as c:
        responses = await asyncio.gather(
            *(c.post("/voice/session", json={"sdp": SDP_OFFER}) for _ in range(MAX_SESSIONS + 2))
        )

    statuses = sorted(r.status_code for r in responses)
    assert statuses == [200] * MAX_SESSIONS + [429, 429]
    for session in list(app.state.voice_sessions.values()):
        await session.close()


class GarbledSocket(FakeSocket):
    """Answers the offer with something that is not JSON — not a `NegotiationError`."""

    async def recv(self) -> str:
        return "<html>502 Bad Gateway</html>"


def test_an_unexpected_negotiation_failure_closes_the_socket_and_frees_the_slot():
    socket = GarbledSocket(RECORDED)

    async def connect(_query):
        return socket

    app = _app(connect)
    response = TestClient(app, raise_server_exceptions=False).post(
        "/voice/session", json={"sdp": SDP_OFFER}
    )

    assert response.status_code == 502
    assert socket.closed
    assert app.state.voice_sessions == {}
    assert app.state.voice_pending == 0


def test_a_connect_that_fails_is_a_bad_gateway_not_a_crash():
    async def connect(_query):
        raise OSError("name resolution failed")

    app = _app(connect)
    response = TestClient(app, raise_server_exceptions=False).post(
        "/voice/session", json={"sdp": SDP_OFFER}
    )

    assert response.status_code == 502
    assert app.state.voice_pending == 0


class DyingSocket(FakeSocket):
    """Negotiates, then the control channel breaks."""

    def __init__(self) -> None:
        super().__init__([])
        self.answered = False

    async def recv(self) -> str:
        if self.answered:
            raise ConnectionError("control channel dropped")
        self.answered = True
        return await super().recv()


async def test_a_receive_loop_that_dies_leaves_a_closed_session():
    socket = DyingSocket()
    session = VoiceSession("s1", socket)
    await session.negotiate(SDP_OFFER)

    events = [event async for event in session.events()]

    assert events[-1]["code"] == "voice_channel_error"
    assert session.closed
    assert socket.closed
