"""Demo mode: the whole application, replayed, with no Azure credential (spec 050).

**This module is not part of the BFF.** It is a second *composition* of it — `create_app` filled in
through the seams the test suite already uses, pointed at the recordings in
`ai/tests/fixtures/recorded/`. Nothing in `app.main` imports this file, no environment variable
reaches it, and `tests/test_demo.py` asserts both over the import graph. That direction is the whole
reason this is an entrypoint and not a flag: a mistyped variable that turned a real deployment into
a replaying one would serve a recorded answer as a live one, and nobody downstream could tell.

**What it does not do.** It chooses no tool, re-prompts nothing and normalises nothing of its own:
the recorded bytes go through the *same* `harness.prompt_agent.events.convert` the live path uses,
so a replayed turn earns the §9 contract rather than being excused from it. It also cannot answer a
question — a recording has one answer — and the banner says so rather than letting a reader find
out.

**Why it reads a test fixture from application code**, which nothing else here does: the recordings
are the single source of truth for how Foundry behaves (§4, §5), and a copy under `backend/` would
be the second place a hand edit could land. This module is a local developer tool started from a
checkout, never something a container image runs.
"""

from __future__ import annotations

import json
import time
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI

from app.agents import AgentSummary, AgentsUnavailable, detail_of, summarise

__all__ = [
    "RECORDED_AT",
    "RECORDINGS",
    "RECORDINGS_DIR",
    "Recording",
    "create_demo_app",
]

#: Where the recordings live. The same directory the contract tests replay from (§4).
RECORDINGS_DIR = Path(__file__).resolve().parents[2] / "ai" / "tests" / "fixtures" / "recorded"

#: The recorded agent listing, which `summarise` turns into the agents screen. A real project's
#: ten agents, so the screen has something true to show — including the ones this repository did
#: not write, which is half of what that screen teaches.
LISTING_FIXTURE = (
    Path(__file__).resolve().parents[1] / "tests" / "fixtures" / ("agents-listing-20260916.json")
)

#: One recorded run's spans, for the trace panel.
SPANS_FIXTURE = RECORDINGS_DIR / "appinsights-spans-20260916.jsonl"


@dataclass(frozen=True)
class Recording:
    """One turn the reader can watch.

    ``id`` is a **code**, not a sentence: the frontend says what it demonstrates, in the reader's
    language (§7). The BFF ships no user-facing prose, here as everywhere.
    """

    id: str
    file: str
    recorded_at: str


#: What the picker offers.
#:
#: **Prompt-agent recordings only, and that is a deliberate limit.** The two harnesses normalise
#: different raw streams — spec 018's finding — and the single `stream_factory` seam cannot tell
#: which adapter is calling it, so a hosted recording replayed through the prompt-agent normaliser
#: would be noise. Pairing them needs a per-harness seam, which is a second feature; until then the
#: listing says `demo_not_recorded` on the hosted agent rather than pretending (§5).
RECORDINGS: list[Recording] = [
    Recording("round-trip", "prompt-agent-turn-20260915.jsonl", "2026-09-15"),
    Recording("no-reasoning", "prompt-agent-no-reasoning-20260915.jsonl", "2026-09-15"),
    Recording("preamble", "prompt-agent-preamble-20260916.jsonl", "2026-09-16"),
]

#: The default pick's date — what `GET /config` reports and `/about` renders. Derived, so the date
#: cannot drift from the recording it describes (§4).
RECORDED_AT = RECORDINGS[0].recorded_at

#: Milliseconds between replayed events. Not decoration: delivered as fast as the disk allows, a
#: whole turn lands in one frame and the streaming this repository exists to show is invisible. The
#: sleep is safe because the adapter reads the factory in a worker thread (`asyncio.to_thread`), so
#: it blocks nothing else. Tests pass `0`.
DEFAULT_PACE_MS = 4


def create_demo_app(*, pace_ms: int = DEFAULT_PACE_MS) -> FastAPI:
    """The app, composed against the recordings.

    Settings are passed explicitly and the Azure-shaped ones are passed **empty**, so the demo
    behaves the same on a laptop with a populated `.env` and on a fresh clone with none. In
    particular `voice_endpoint=""`: it otherwise derives from the project endpoint, and a voice
    button that reported itself configured in a build with no Voice Live is exactly the drawing of
    a feature §5 forbids.
    """
    from app.main import create_app

    # `recorded_at` rides along so `GET /config` can report it without importing this module —
    # `config.py` is reachable from `app.main`, and that import would be the production path
    # learning about the replay (AC2).
    state: dict[str, Any] = {
        "current": RECORDINGS[0].id,
        "recorded_at": RECORDED_AT,
        "queue": [],
        "queue_for": None,
    }

    app = create_app(
        stream_factory=_replay_factory(state, pace_ms),
        agent_lister=_recorded_agents,
        agent_detail=_recorded_agent_detail,
        trace_query=_recorded_spans,
        # A project endpoint that goes nowhere: it is never dialled, and the screens that name a
        # project should name one.
        project_endpoint="https://demo.services.ai.azure.com/api/projects/demo-project",
        project_name="demo-project",
        agent_name="foundry-live-agent",
        model="gpt-5.5",
        harness="prompt-agent",
        # Not derived from the project endpoint. See the docstring.
        voice_endpoint="",
        speech_endpoint="",
        speech_resource_id="",
        allow_version_promote=False,
        # The two tools that need nothing run for real; `search_web` answers `search_unavailable`,
        # which is the most instructive output it has (spec 042, AC5).
        allow_playground=True,
    )

    from harness._shared.tools import registry
    from harness._shared.tools.web_search_tool import TavilySearch

    @app.middleware("http")
    async def isolate_search(request, call_next):
        # An inherited key must not turn a replay into a metered live-tool session (spec 051).
        with registry.use_search_backend(TavilySearch("")):
            return await call_next(request)

    app.state.demo = state

    from app.routers import demo as demo_router

    app.include_router(demo_router.router)
    return app


# --- Replaying a recording -------------------------------------------------


def _replay_factory(state: dict[str, Any], pace_ms: int):
    """A `stream_factory` that yields one recorded leg per call.

    The adapter calls this once per leg of a turn — the recording ends each leg with
    `response.completed`, which is where Foundry stops and waits for tool output — so splitting on
    that boundary is replaying what the adapter really saw, not a reconstruction of it.
    """

    def factory(_inputs: list[Mapping[str, Any]], _state: Mapping[str, Any]) -> Iterator[dict]:
        # Rebuilt when the queue runs out, and when the reader picked a different recording
        # mid-turn — otherwise the rest of the previous turn would leak into the next one.
        if not state["queue"] or state["queue_for"] != state["current"]:
            state["queue"] = _legs(_recording(state["current"]))
            state["queue_for"] = state["current"]

        leg = state["queue"].pop(0)

        def paced() -> Iterator[dict]:
            for event in leg:
                if pace_ms:
                    time.sleep(pace_ms / 1000)
                yield event

        return paced()

    return factory


def _recording(recording_id: str) -> Recording:
    for recording in RECORDINGS:
        if recording.id == recording_id:
            return recording
    raise AgentsUnavailable("unknown_recording", recording_id)


def _legs(recording: Recording) -> list[list[dict]]:
    """A recording, split into the round trips it was made of.

    Read on every rebuild rather than cached: a recording is a few hundred lines, this happens once
    per turn, and a cache would be a copy of a file that is already the source of truth.
    """
    path = RECORDINGS_DIR / recording.file
    if not path.exists():
        # Loud, with the path, at the moment it is needed — a demo that failed with a bare
        # KeyError on somebody's first message would look like a bug in the agent.
        raise FileNotFoundError(f"the demo recording is missing: {path}")

    legs: list[list[dict]] = []
    current: list[dict] = []
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        event = json.loads(line)
        current.append(event)
        if event.get("type") == "response.completed":
            legs.append(current)
            current = []
    if current:
        legs.append(current)
    return legs


# --- The other three screens -----------------------------------------------


def _listing() -> dict[str, Any]:
    return json.loads(LISTING_FIXTURE.read_text())


def _recorded_agents() -> list[AgentSummary]:
    """The recorded listing, projected by the **real** `summarise` (§4).

    Ten agents from a real project: two this repository wrote, and eight it did not. Only the
    refusal is added — an agent whose harness is not the one being replayed cannot answer here, and
    saying so is a different fact from having no harness for it, which is what `no_harness` means.
    """
    return [
        row
        if row.harness == "prompt-agent"
        else AgentSummary(
            **{
                **row.__dict__,
                "selectable": False,
                "reason": "demo_not_recorded",
            }
        )
        for row in summarise(_listing())
    ]


def _recorded_agent_detail(name: str):
    """One agent of that listing, inspected (spec 030).

    ``None`` for the versions: the demo did not read them, and reporting "not reported" is what the
    screen already renders for an agent whose version list could not be read.
    """
    from app.agents import _find_agent

    return detail_of(_find_agent(_listing(), name), None)


def _recorded_spans(_kql: str) -> list[dict[str, Any]]:
    """The spans of one recorded run, whatever is asked for.

    **They are not the spans of the turn being replayed**, and nothing here pretends otherwise: the
    event stream and this workspace export came from different runs, so the ids do not line up.
    What the panel renders is a true span tree from a true recording — the alternative, rows
    fabricated to match, is the §5 failure this whole build is arranged to avoid. The banner says
    the build is a replay; this is part of what that means.

    One operation, not all three in the file: `read_trace` puts every row it is given on a shared
    time axis, and rows from three unrelated runs would draw one tree that never happened.
    """
    rows = [json.loads(line) for line in SPANS_FIXTURE.read_text().splitlines() if line.strip()]
    if not rows:
        return []

    operations: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        operations.setdefault(str(row.get("operation_Id") or ""), []).append(row)
    return max(operations.values(), key=len)
