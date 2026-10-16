"""`/voice/session` — the WebRTC handshake and the session's activity stream.

The browser sends an SDP offer and gets an SDP answer. That is the entire exchange: no token, no
endpoint, no Azure anything. Audio then flows browser ↔ Voice Live peer-to-peer, while the control
channel — and therefore the credential, and therefore the tool execution — stays here.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agents import AgentsUnavailable, select_agent
from app.harness_factory import build_harness
from app.sse import format_event
from app.voice_session import NegotiationError, VoiceSession

router = APIRouter(prefix="/voice")
_log = logging.getLogger(__name__)

MAX_SESSIONS = 4


class SessionRequest(BaseModel):
    """The browser's half of the WebRTC negotiation."""

    sdp: str = Field(min_length=1, description="The browser's SDP offer")
    #: Which agent to attach to, chosen on the agents screen (spec 019, AC8). Absent means the one
    #: this BFF is configured with. Voice Live attaching to a *hosted* agent was verified live on
    #: 2026-09-16 (spec 018, AC9), so both kinds honour the selection.
    agent: str | None = None
    #: Which voice to speak in (spec 043). Absent means the deployment's default. Validated against
    #: the declared list: a free-text value would let the browser ask the service for anything.
    voice: str | None = None


@router.post("/session")
async def create_session(body: SessionRequest, request: Request) -> dict:
    connect = request.app.state.voice_connect
    if connect is None:
        raise HTTPException(
            status_code=503,
            detail="Voice is not configured on this server: set VOICELIVE_ENDPOINT.",
        )

    sessions: dict[str, VoiceSession] = request.app.state.voice_sessions
    # Sessions that are already over do not hold a slot. Without this the bound below turned the
    # leak it guards against into a wedge: four sessions whose control channel had died left voice
    # permanently unavailable on this process, and restarting the BFF was the only way back.
    for dead in [key for key, session in sessions.items() if session.closed]:
        sessions.pop(dead, None)

    # Sessions still being negotiated count too. The check and the reservation run with no await
    # between them, so on one event loop no second request can slip in; every await that follows
    # (the agent lookup, the dial, a negotiation of up to 30s) happens while the slot is held.
    if len(sessions) + request.app.state.voice_pending >= MAX_SESSIONS:
        # Bounded here rather than trusting the browser to hang up: a closed tab sends no DELETE.
        raise HTTPException(status_code=429, detail="Too many voice sessions are already open.")

    request.app.state.voice_pending += 1
    try:
        session = await _open(body, request)
    finally:
        request.app.state.voice_pending -= 1

    sessions[session.id] = session
    return {"session_id": session.id, "sdp_answer": session.answer}


async def _open(body: SessionRequest, request: Request) -> VoiceSession:
    """Dial and negotiate. Any way out of here but success leaves no socket behind."""
    settings = request.app.state.settings
    if body.voice is not None and body.voice not in settings.offered_voices:
        # Refused at the BFF, not merely absent from the UI (AC6). A list the browser could step
        # outside of would not be a list.
        raise HTTPException(status_code=400, detail="voice_not_offered")

    from harness._shared.voice_events import attachment_query

    try:
        # Off the loop: resolving a named agent reads the project's listing over a synchronous
        # client, and this route is holding an event loop that other live sessions share.
        attachment = await asyncio.to_thread(_attachment, request, body.agent)
    except AgentsUnavailable as refused:
        # Refused before anything is dialled. The detail is the agent's name and the code is the
        # row's own, so the browser can say the same thing the dimmed row on the screen says.
        raise HTTPException(status_code=400, detail=refused.code) from None

    try:
        socket = await request.app.state.voice_connect(
            attachment_query(
                agent=attachment["agent_name"],
                project=attachment.get("project_name") or settings.project_name,
                version=attachment.get("agent_version"),
            )
        )
    except Exception:  # noqa: BLE001 - DNS, TLS, a refused token: all upstream, none ours
        _log.exception("voice: dialling Voice Live failed")
        raise HTTPException(status_code=502, detail="voice_connect_failed") from None

    session = VoiceSession(
        uuid.uuid4().hex, socket, session_config=settings.session_config_for(body.voice)
    )
    try:
        session.answer = await session.negotiate(body.sdp)
    except NegotiationError as exc:
        await session.close()
        raise HTTPException(status_code=502, detail=str(exc)) from None
    except BaseException as exc:
        # Anything else — a frame that is not JSON, a dropped socket, the browser giving up mid-
        # handshake (cancellation) — would otherwise leave an open, billed channel held by nothing.
        await asyncio.shield(session.close())
        if isinstance(exc, Exception):
            _log.exception("voice: negotiation failed unexpectedly")
            raise HTTPException(status_code=502, detail="voice_negotiation_failed") from None
        raise
    return session


@router.get("/session/{session_id}/events")
async def session_events(session_id: str, request: Request) -> StreamingResponse:
    """The tool activity of a voice session, as the same SSE stream `/chat` emits.

    Transcripts are deliberately absent: the browser already has them on the WebRTC data channel,
    straight from Voice Live. Relaying them would duplicate state and add a hop to something the
    user is currently listening to.
    """
    session = _require(request, session_id)

    async def frames() -> AsyncIterator[str]:
        try:
            async for event in session.events():
                yield format_event(event)
        finally:
            # The browser holds this stream open for the whole call, so it ending means the tab is
            # gone — and a tab that went away sends no DELETE. Releasing here is what stops an
            # abandoned session from holding both a slot and a socket to a service that bills per
            # second. A transient drop on this stream therefore ends the call too: the wrong
            # direction to err in is the one that leaves a meter running nobody can see (§5).
            await _release(request.app, session_id)

    return StreamingResponse(
        frames(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/session/{session_id}", status_code=204)
async def end_session(session_id: str, request: Request) -> Response:
    _require(request, session_id)
    await _release(request.app, session_id)
    return Response(status_code=204)


async def _release(app, session_id: str) -> None:
    """Close a session and forget it. Idempotent, because two things now end a call.

    A hangup and the activity stream unwinding can arrive in either order — and do, since closing
    the session is what makes that stream finish — so this must be safe to run twice.
    """
    session = app.state.voice_sessions.pop(session_id, None)
    if session is not None:
        await session.close()


def _require(request: Request, session_id: str) -> VoiceSession:
    session = request.app.state.voice_sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="No such voice session.")
    return session


def _attachment(request: Request, agent: str | None) -> dict:
    """Which agent this session attaches to.

    ASK THE HARNESS, don't read the environment — and when a selection exists, ask the harness
    built for *that* agent. `voice_attachment_params()` is the §9 Protocol's answer to "which agent
    is this?", so a selected hosted agent and a selected prompt agent each answer for themselves.
    """
    if not agent:
        return dict(request.app.state.harness.voice_attachment_params())

    selection = select_agent(request.app.state.list_agents, agent)
    harness = build_harness(
        request.app.state.settings,
        stream_factory=request.app.state.stream_factory,
        agent=selection,
        clients=request.app.state.clients,
    )
    return dict(harness.voice_attachment_params())
