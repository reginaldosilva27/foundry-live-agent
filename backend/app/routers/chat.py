"""`POST /chat` — stream a turn to the browser as SSE."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import aclosing

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agents import AgentsUnavailable, select_agent
from app.harness_factory import build_harness
from app.sse import format_event

router = APIRouter()


class ChatRequest(BaseModel):
    """One user turn.

    Deliberately *not* a message history: Foundry owns conversation state, keyed by
    ``conversation_id``. Accepting history from the client would duplicate state the platform
    already holds, and duplicated state drifts (§8).
    """

    message: str = Field(min_length=1)
    conversation_id: str | None = None
    #: Which agent answers, chosen on the agents screen (spec 019). Absent means the one this BFF
    #: is configured with, which is why an app with no selection behaves exactly as before (AC12).
    #: A **name**, never a description: what that agent is remains the service's answer, not the
    #: browser's, so nothing here can reshape an agent at request time (§8).
    agent: str | None = None


@router.post("/chat")
async def chat(body: ChatRequest, request: Request) -> StreamingResponse:
    # Resolved before the stream opens, and never by mutating `app.state.harness`: a process-global
    # swap would let one browser's choice decide another browser's turn (spec 019 plan).
    # Off the loop: resolving the agent reads the project's listing over a SYNCHRONOUS client,
    # and this runs on the path of every turn that names an agent. Run inline it would freeze
    # every other stream in the process for the length of that read — the same reason the
    # adapter reads the Foundry stream in a worker thread (tests/test_concurrency.py).
    harness, refused = await asyncio.to_thread(_harness_for, request, body.agent)

    async def frames() -> AsyncIterator[str]:
        """Re-stream the harness as SSE, guaranteeing a terminal frame no matter what.

        The harness already promises to terminate (§9). This is a second belt at the transport
        layer: if it breaks that promise, or breaks while breaking it, the browser still receives an
        `error` rather than a connection that goes quiet.
        """
        if refused is not None:
            # A refusal is a contract event, not an HTTP status: the browser is reading a stream,
            # and the one rule it relies on is that a turn ends in `done` or `error`. The code is
            # the row's own, so the reason matches what the dimmed row on the screen said.
            yield format_event({"type": "error", "message": refused.detail, "code": refused.code})
            return

        terminated = False
        try:
            messages = [{"role": "user", "content": body.message}]
            # Mutable on purpose: the first turn of a session has no conversation yet, and the
            # stream factory writes the one it creates back here so every leg names it.
            state = {"conversation_id": body.conversation_id} if body.conversation_id else {}
            async with aclosing(harness.stream_response(messages, state)) as events:
                async for event in events:
                    if event["type"] in {"done", "error"}:
                        terminated = True
                    yield format_event(event)
        except Exception as exc:  # noqa: BLE001 - a terminal frame is a promise to the client
            terminated = True
            yield format_event(
                {
                    "type": "error",
                    "message": f"{type(exc).__name__}: {exc}",
                    "code": "bff_error",
                }
            )
        else:
            if not terminated:
                yield format_event(
                    {
                        "type": "error",
                        "message": "the harness stream ended without a terminal event",
                        "code": "missing_terminal",
                    }
                )

    return StreamingResponse(
        frames(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _harness_for(request: Request, agent: str | None):
    """The adapter for this turn, or the failure that stops it before anything is dialled.

    Building per request is cheap — the adapter is a closure and a name — because the expensive
    things, the credential and the project client, live in `app.state.clients` and outlive it.
    """
    if not agent:
        return request.app.state.harness, None
    try:
        selection = select_agent(request.app.state.list_agents, agent)
    except AgentsUnavailable as refusal:
        return None, refusal

    return (
        build_harness(
            request.app.state.settings,
            stream_factory=request.app.state.stream_factory,
            agent=selection,
            clients=request.app.state.clients,
        ),
        None,
    )
