"""The BFF application.

A Backend For Frontend, not an agent runtime. It streams, executes the function tools Foundry asks
for, and reports configuration. It does not choose tools, re-prompt the model, or hold conversation
state — those belong to Foundry (constitution §8).
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.harness_factory import build_harness
from app.routers import chat, config, health, voice
from app.settings import load_settings
from app.voice_connect import build_connect

__all__ = ["create_app"]


def create_app(
    stream_factory: Callable[..., Any] | None = None,
    voice_connect: Callable[..., Any] | None = None,
    **settings_overrides: object,
) -> FastAPI:
    """Build the app.

    ``stream_factory`` injects a raw Foundry stream and ``voice_connect`` injects a Voice Live
    control channel. Production leaves both unset; tests pass a replay, which exercises the
    identical code path with no credential.

    The harness is resolved **here, at startup**, so a bad ``AGENT_HARNESS`` stops the process
    with an explanation instead of failing on someone's first message.
    """
    settings = load_settings(**settings_overrides)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        yield
        # A browser tab closed without a DELETE sends nothing. Nothing may outlive the process.
        for session in list(app.state.voice_sessions.values()):
            await session.close()
        app.state.voice_sessions.clear()

    app = FastAPI(
        title="foundry-live-agent BFF",
        description="Streams a Microsoft Foundry agent. Contains no agent-loop logic.",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.harness = build_harness(settings, stream_factory=stream_factory)
    app.state.voice_connect = voice_connect or build_connect(settings)
    # Voice sessions live in this process, so the BFF is single-replica for voice. Said out loud
    # in docs/how-it-works/voice-live-lifecycle.md rather than solved: a session store is a
    # different feature, and pretending otherwise would be the kind of drawing-of-a-feature §5
    # forbids.
    app.state.voice_sessions = {}

    # Local reference app: the Vite dev server is a different origin. There is no auth here on
    # purpose — a half-real auth layer would be worse than none. See backend/README.md.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["*"],
    )

    for router in (chat.router, config.router, health.router, voice.router):
        app.include_router(router)
    return app


app_factory = create_app
