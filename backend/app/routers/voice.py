"""`/voice/session` — the WebRTC handshake and the session's activity stream.

The browser sends an SDP offer and gets an SDP answer. That is the entire exchange: no token, no
endpoint, no Azure anything. Audio then flows browser ↔ Voice Live peer-to-peer, while the control
channel — and therefore the credential, and therefore the tool execution — stays here.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.sse import format_event
from app.voice_session import NegotiationError, VoiceSession

router = APIRouter(prefix="/voice")

MAX_SESSIONS = 4


class SessionRequest(BaseModel):
    """The browser's half of the WebRTC negotiation."""

    sdp: str = Field(min_length=1, description="The browser's SDP offer")


@router.post("/session")
async def create_session(body: SessionRequest, request: Request) -> dict:
    connect = request.app.state.voice_connect
    if connect is None:
        raise HTTPException(
            status_code=503,
            detail="Voice is not configured on this server: set VOICELIVE_ENDPOINT.",
        )

    sessions: dict[str, VoiceSession] = request.app.state.voice_sessions
    if len(sessions) >= MAX_SESSIONS:
        # Bounded here rather than trusting the browser to hang up: a closed tab sends no DELETE.
        raise HTTPException(status_code=429, detail="Too many voice sessions are already open.")

    settings = request.app.state.settings
    from harness._shared.voice_events import attachment_query

    socket = await connect(
        attachment_query(
            agent=settings.agent_name,
            project=settings.project_name,
            version=settings.agent_version,
        )
    )
    session = VoiceSession(uuid.uuid4().hex, socket)

    try:
        answer = await session.negotiate(body.sdp)
    except NegotiationError as exc:
        await session.close()
        raise HTTPException(status_code=502, detail=str(exc)) from None

    sessions[session.id] = session
    return {"session_id": session.id, "sdp_answer": answer}


@router.get("/session/{session_id}/events")
async def session_events(session_id: str, request: Request) -> StreamingResponse:
    """The tool activity of a voice session, as the same SSE stream `/chat` emits.

    Transcripts are deliberately absent: the browser already has them on the WebRTC data channel,
    straight from Voice Live. Relaying them would duplicate state and add a hop to something the
    user is currently listening to.
    """
    session = _require(request, session_id)

    async def frames() -> AsyncIterator[str]:
        async for event in session.events():
            yield format_event(event)

    return StreamingResponse(
        frames(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/session/{session_id}", status_code=204)
async def end_session(session_id: str, request: Request) -> Response:
    session = _require(request, session_id)
    await session.close()
    del request.app.state.voice_sessions[session_id]
    return Response(status_code=204)


def _require(request: Request, session_id: str) -> VoiceSession:
    session = request.app.state.voice_sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="No such voice session.")
    return session
