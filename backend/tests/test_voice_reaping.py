"""An abandoned voice session must not hold its slot for ever.

`MAX_SESSIONS` bounds how many control channels this process holds at once, and the comment beside
it names the reason correctly: *a closed tab sends no DELETE*. But nothing ever removed a session
that was never ended, so the bound turned the leak into a wedge — after four abandoned tabs, voice
is unavailable on this process until somebody restarts it, and each of those four still holds a
socket open to a service that bills per second.

The signal was already there and was not being read: the browser holds `GET
/voice/session/{id}/events` open for the whole call (`useVoiceSession.followActivity`), so that
stream ending is the tab going away. The trade-off is stated rather than hidden — a transient drop
on that stream ends the session too, which is the safe direction when the alternative is a metered
socket nobody can see and nobody can close.

**Why these tests drive the generator directly.** `httpx.ASGITransport` buffers a response whole
(it waits for `http.response.body` with `more_body: False`), so an endless SSE route hangs it for
ever and `TestClient` inherits the same limit. Iterating the `StreamingResponse`'s own body iterator
and closing it is what a browser going away does to the server, expressed in the one layer that can
observe it.
"""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.main import create_app
from app.routers.voice import MAX_SESSIONS, session_events
from tests.test_voice import RECORDED, SDP_ANSWER, SDP_OFFER, FakeSocket


def _app():
    """An app that hands out a fresh replaying socket per session."""
    sockets: list[FakeSocket] = []

    async def connect(_query: dict[str, str]) -> FakeSocket:
        socket = FakeSocket(RECORDED)
        sockets.append(socket)
        return socket

    app = create_app(
        voice_connect=connect,
        project_endpoint="https://example.services.ai.azure.com/api/projects/p",
        project_name="p",
        model="gpt-5.5",
    )
    return app, sockets


def _open(client: TestClient) -> str:
    response = client.post("/voice/session", json={"sdp": SDP_OFFER})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sdp_answer"] == SDP_ANSWER
    return body["session_id"]


async def _follow(app, session_id: str, frames: int = 1) -> list[dict]:
    """Read `frames` frames off the activity stream, then walk away — as a closed tab does."""
    response = await session_events(session_id, SimpleNamespace(app=app))
    body = response.body_iterator
    received: list[dict] = []
    try:
        async with asyncio.timeout(5.0):
            async for chunk in body:
                for line in chunk.splitlines():
                    if line.startswith("data: "):
                        received.append(json.loads(line[6:]))
                if len(received) >= frames:
                    break
    finally:
        await body.aclose()
    return received


async def test_an_abandoned_activity_stream_releases_the_session():
    """The browser went away. Its session, and its socket, must go with it."""
    app, sockets = _app()
    with TestClient(app) as client:
        session_id = _open(client)
        assert session_id in app.state.voice_sessions

        await _follow(app, session_id)

        assert session_id not in app.state.voice_sessions, "the abandoned session kept its slot"
        assert sockets[0].closed, "the abandoned session kept a metered socket open"


async def test_abandoned_sessions_do_not_wedge_the_cap():
    """Filling the cap with abandoned tabs must not make voice unavailable."""
    app, _ = _app()
    with TestClient(app) as client:
        for _ in range(MAX_SESSIONS):
            await _follow(app, _open(client))

        # The one that matters: a person picks the microphone back up.
        response = client.post("/voice/session", json={"sdp": SDP_OFFER})
        assert response.status_code == 200, (
            f"voice was wedged after {MAX_SESSIONS} abandoned tabs: {response.text}"
        )


async def test_a_session_whose_channel_died_does_not_hold_a_slot():
    """A control channel that failed leaves a session nobody will ever DELETE."""
    app, _ = _app()
    with TestClient(app) as client:
        session_id = _open(client)
        await app.state.voice_sessions[session_id].close()  # what the pump does on a dead socket

        assert client.post("/voice/session", json={"sdp": SDP_OFFER}).status_code == 200
        assert session_id not in app.state.voice_sessions, "a closed session kept its slot"


async def test_hanging_up_still_works_and_stays_idempotent():
    """The ordinary path is unchanged, and a retried hangup is a clean 404, never a 500."""
    app, sockets = _app()
    with TestClient(app) as client:
        session_id = _open(client)
        assert client.delete(f"/voice/session/{session_id}").status_code == 204
        assert session_id not in app.state.voice_sessions
        assert sockets[0].closed
        assert client.delete(f"/voice/session/{session_id}").status_code == 404


async def test_the_activity_stream_still_delivers_what_the_session_did():
    """Reaping must not cost the feature: a live session still streams its tool activity."""
    app, _ = _app()
    with TestClient(app) as client:
        received = await _follow(app, _open(client), frames=1)
    assert received, "the activity stream delivered nothing"
    assert "type" in received[0]
