"""The BFF application.

A Backend For Frontend, not an agent runtime. It streams, executes the function tools Foundry asks
for, and reports configuration. It does not choose tools, re-prompt the model, or hold conversation
state — those belong to Foundry (constitution §8).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.harness_factory import build_harness
from app.routers import chat, config, health
from app.settings import load_settings

__all__ = ["create_app"]


def create_app(
    stream_factory: Callable[..., Any] | None = None,
    **settings_overrides: object,
) -> FastAPI:
    """Build the app.

    ``stream_factory`` injects a raw Foundry stream. Production leaves it unset; tests pass a
    replay,
    which exercises the identical code path with no credential.

    The harness is resolved **here, at startup**, so a bad ``AGENT_HARNESS`` stops the process
    with an explanation instead of failing on someone's first message.
    """
    settings = load_settings(**settings_overrides)
    app = FastAPI(
        title="foundry-live-agent BFF",
        description="Streams a Microsoft Foundry agent. Contains no agent-loop logic.",
        version="0.1.0",
    )
    app.state.settings = settings
    app.state.harness = build_harness(settings, stream_factory=stream_factory)

    # Local reference app: the Vite dev server is a different origin. There is no auth here on
    # purpose — a half-real auth layer would be worse than none. See backend/README.md.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    for router in (chat.router, config.router, health.router):
        app.include_router(router)
    return app


app_factory = create_app
