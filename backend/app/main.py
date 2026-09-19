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

from app.agents import build_agent_detail_reader, build_agent_lister
from app.harness_factory import AzureClients, build_harness
from app.routers import agents, chat, config, health, speech, traces, voice
from app.settings import load_settings
from app.speech import build_synthesizer
from app.traces import build_trace_reader
from app.voice_connect import build_connect

__all__ = ["create_app"]


def create_app(
    stream_factory: Callable[..., Any] | None = None,
    voice_connect: Callable[..., Any] | None = None,
    synthesize: Callable[..., Any] | None = None,
    trace_query: Callable[..., Any] | None = None,
    agent_lister: Callable[..., Any] | None = None,
    agent_detail: Callable[..., Any] | None = None,
    **settings_overrides: object,
) -> FastAPI:
    """Build the app.

    ``stream_factory`` injects a raw Foundry stream, ``voice_connect`` a Voice Live control
    channel, ``synthesize`` a text-to-speech call, ``trace_query`` a log query, ``agent_lister``
    the project's agent listing and ``agent_detail`` one agent of it. Production leaves all six
    unset; tests pass a replay, which exercises the identical code path with no credential.

    The harness is resolved **here, at startup**, so a bad ``AGENT_HARNESS`` stops the process
    with an explanation instead of failing on someone's first message.
    """
    settings = load_settings(**settings_overrides)
    # One credential and one project client for the process. Spec 019 builds a harness per turn,
    # so anything expensive has to outlive the adapter or it lands on every message.
    clients = AzureClients()

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
    app.state.clients = clients
    # Kept so a turn that names an agent can build its own adapter with the same seam — in tests a
    # replayed stream, in production `None`, meaning "make the real one".
    app.state.stream_factory = stream_factory
    # The DEFAULT, and never mutated. A selection builds its own adapter per turn (spec 019).
    app.state.harness = build_harness(settings, stream_factory=stream_factory, clients=clients)
    app.state.voice_connect = voice_connect or build_connect(settings)
    # `None` when the BFF has no speech configuration — the routers turn that into an answer that
    # says so, rather than into a failure on the first sentence (spec 008, AC9).
    app.state.synthesize = synthesize or build_synthesizer(settings)
    # `None` when no Application Insights resource is configured — the trace route turns that into
    # "unavailable", so the app runs complete and normal without tracing (spec 005, AC19).
    app.state.read_trace = trace_query or build_trace_reader(settings)
    # Reads the project's agents for the picker (spec 019). Injectable like every other Azure call
    # here, which is what keeps the suite credential-free.
    app.state.list_agents = agent_lister or build_agent_lister(settings, clients.credential)
    # Spec 030. A second projection of the same listing, not a second call — see `agents.py`.
    app.state.agent_detail = agent_detail or build_agent_detail_reader(settings, clients.credential)
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

    for router in (
        agents.router,
        chat.router,
        config.router,
        health.router,
        speech.router,
        traces.router,
        voice.router,
    ):
        app.include_router(router)
    return app


app_factory = create_app
