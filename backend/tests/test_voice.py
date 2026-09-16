"""The voice control channel (spec 006, AC1 · AC3–AC6).

The socket is injected, exactly as the chat router injects a raw Foundry stream, so the whole round
trip runs with no credential and no microphone. The frames it replays are the ones the live service
sent on 2026-09-15, read from `ai/tests/fixtures/recorded/`.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.main import create_app
from app.voice_session import VoiceSession

FIXTURES = Path(__file__).resolve().parents[2] / "ai" / "tests" / "fixtures" / "recorded"
RECORDED = [
    json.loads(line)
    for line in (FIXTURES / "voice-live-tool-call-20260915.jsonl").read_text().splitlines()
    if line.strip()
]
SDP_OFFER = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"
SDP_ANSWER = (
    "v=0\r\no=str0m 1 2 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"
)


class FakeSocket:
    """A Voice Live control channel that replays recorded frames and records what we sent."""

    def __init__(self, frames: list[dict], *, refuse: str | None = None) -> None:
        self.sent: list[dict] = []
        self.closed = False
        self._refuse = refuse
        self._inbox: asyncio.Queue[dict] = asyncio.Queue()
        self._pending = list(frames)

    async def send(self, payload: str) -> None:
        frame = json.loads(payload)
        self.sent.append(frame)
        if frame["type"] != "rtc.call.sdp.create":
            return
        if self._refuse is not None:
            # The observed refusal shape: `rtc.call.error`, not silence. Seen on 2026-09-15 when
            # the SDP was sent under the wrong field name.
            await self._inbox.put(
                {
                    "type": "rtc.call.error",
                    "operation": "rtc.call.sdp.create",
                    "error": {"type": "invalid_request_error", "message": self._refuse},
                }
            )
            return
        await self._inbox.put(
            {"type": "rtc.call.sdp.created", "rtc_call_id": "rtc_1", "sdp_answer": SDP_ANSWER}
        )
        for recorded in self._pending:
            await self._inbox.put(recorded)
        self._pending = []

    async def recv(self) -> str:
        return json.dumps(await self._inbox.get())

    async def close(self) -> None:
        self.closed = True


def app_with(socket: FakeSocket):
    """An app whose voice sessions talk to `socket` instead of Azure."""
    sockets: list[FakeSocket] = []

    async def connect(_query: dict[str, str]) -> FakeSocket:
        sockets.append(socket)
        return socket

    app = create_app(
        voice_connect=connect,
        project_endpoint="https://example.services.ai.azure.com/api/projects/p",
        project_name="p",
        model="gpt-5.5",
    )
    return app, sockets


def open_session(client: TestClient) -> dict:
    response = client.post("/voice/session", json={"sdp": SDP_OFFER})
    assert response.status_code == 200, response.text
    return response.json()


async def drain(socket: FakeSocket, predicate, timeout: float = 2.0) -> None:
    """Wait until the session has sent what we are asserting about."""
    async with asyncio.timeout(timeout):
        while not predicate(socket.sent):
            await asyncio.sleep(0.01)


# --- AC1: the handshake ----------------------------------------------------


def test_session_returns_an_answer_and_never_a_credential():
    socket = FakeSocket(RECORDED)
    app, _ = app_with(socket)

    with TestClient(app) as client:
        body = open_session(client)

    assert body["sdp_answer"] == SDP_ANSWER
    assert body["session_id"]

    flat = json.dumps(body).lower()
    for leak in ("token", "bearer", "key", "secret", "azure.com", "authorization"):
        assert leak not in flat, f"the browser must not receive {leak!r}"


def test_the_browsers_offer_is_what_is_sent_to_voice_live():
    socket = FakeSocket(RECORDED)
    app, _ = app_with(socket)

    with TestClient(app) as client:
        open_session(client)

    create = next(f for f in socket.sent if f["type"] == "rtc.call.sdp.create")
    # Observed 2026-09-15: the field is `sdp_offer`. `sdp` and `offer` are both rejected with
    # "SDP offer is required", which reads like a missing value rather than a wrong key.
    assert create["sdp_offer"] == SDP_OFFER


def test_a_refused_negotiation_is_a_502_and_closes_the_channel():
    socket = FakeSocket(RECORDED, refuse="SDP offer is required")

    app, _ = app_with(socket)
    with TestClient(app) as client:
        response = client.post("/voice/session", json={"sdp": SDP_OFFER})

    assert response.status_code == 502
    assert "SDP offer is required" in response.json()["detail"]
    assert socket.closed, "a failed negotiation must not leave the control channel open"


def test_a_negotiation_that_never_answers_times_out_rather_than_hanging():
    """Silence is the worst failure mode: the browser sits on a spinner with no reason given."""
    import app.voice_session as voice_session

    class Silent:
        closed = False

        async def send(self, payload: str) -> None: ...
        async def recv(self) -> str:
            await asyncio.sleep(3600)
            raise AssertionError("unreachable")

        async def close(self) -> None:
            self.Silent_closed = True

    original = voice_session.NEGOTIATION_TIMEOUT
    voice_session.NEGOTIATION_TIMEOUT = 0.05
    try:
        session = voice_session.VoiceSession("s1", Silent())
        with pytest.raises(voice_session.NegotiationError, match="did not answer"):
            asyncio.run(session.negotiate(SDP_OFFER))
    finally:
        voice_session.NEGOTIATION_TIMEOUT = original


# --- AC3, AC4, AC5: the function-call round trip ---------------------------


def test_a_function_call_on_the_control_channel_is_executed_and_submitted():
    socket = FakeSocket(RECORDED)
    app, _ = app_with(socket)

    def submitted(sent):
        # Specifically the tool output — a session now also opens with a `system` context item
        # (spec 017), and "the first conversation item" stopped meaning "the answer".
        return any(
            f["item"].get("type") == "function_call_output"
            for f in sent
            if f["type"] == "conversation.item.create"
        )

    with TestClient(app) as client:
        open_session(client)
        asyncio.run(drain(socket, submitted))

    answer = next(
        f
        for f in socket.sent
        if f["type"] == "conversation.item.create"
        and f["item"].get("type") == "function_call_output"
    )
    item = answer["item"]
    assert item["type"] == "function_call_output"
    assert item["call_id"] == next(
        f["call_id"] for f in RECORDED if f["type"] == "response.function_call_arguments.done"
    )
    # The real tool ran: the output is a datetime payload, not an echo.
    assert "America/Sao_Paulo" in item["output"]


def test_answering_a_call_asks_for_the_response_to_continue():
    """Submitting the output is not enough — the agent resumes only on `response.create`, and a
    conversation that stops talking mid-turn is the symptom of forgetting it."""
    socket = FakeSocket(RECORDED)
    app, _ = app_with(socket)

    with TestClient(app) as client:
        open_session(client)
        asyncio.run(drain(socket, lambda sent: any(f["type"] == "response.create" for f in sent)))

    types = [f["type"] for f in socket.sent]
    assert types.index("conversation.item.create") < types.index("response.create")


async def session_events(socket: FakeSocket, count: int) -> list[dict]:
    """Drive a session through the recorded frames and collect what it publishes.

    Against the session rather than over HTTP: a voice session's event stream has no terminal — it
    lives until someone hangs up — and an HTTP client that has to walk away mid-stream tests its own
    buffering more than it tests this. The SSE layer is covered separately, below, by a session that
    has ended and therefore streams a finite body.
    """
    session = VoiceSession("s-test", socket)
    await session.negotiate(SDP_OFFER)

    events: list[dict] = []
    async for event in session.events():
        events.append(dict(event))
        if len(events) >= count:
            break
    await session.close()
    return events


async def test_a_voice_tool_call_produces_the_same_events_as_a_text_one():
    """AC4 — the activity panel has no voice-specific branch: there is nothing to branch on."""
    events = await session_events(FakeSocket(RECORDED), 2)

    call = next(e for e in events if e["type"] == "tool_call")
    result = next(e for e in events if e["type"] == "tool_result")

    assert call["executor"] == "app"
    assert call["name"] == "get_current_datetime"
    assert result["call_id"] == call["call_id"]
    assert result["duration_ms"] >= 0
    assert "America/Sao_Paulo" in result["output"]


async def test_every_call_is_answered_or_the_session_errors():
    """AC5. Voice Live waits on an unanswered call exactly as the Responses API does; in a spoken
    conversation the symptom is the agent going quiet mid-sentence."""
    events = await session_events(FakeSocket(RECORDED), 2)

    calls = {e["call_id"] for e in events if e["type"] == "tool_call"}
    answered = {e["call_id"] for e in events if e["type"] == "tool_result"}
    assert calls and calls == answered


async def test_the_session_reports_what_the_conversation_cost():
    """Both response turns bill; the activity panel shows usage in voice as it does in text."""
    usage = next(e for e in await session_events(FakeSocket(RECORDED), 3) if e["type"] == "usage")
    assert usage["input_tokens"] > 0


async def test_the_events_endpoint_serves_sse_and_ends_when_the_session_does():
    """The transport half of AC4: the same SSE framing `/chat` uses, and a stream that finishes
    rather than dangling once the control channel is gone."""
    socket = FakeSocket(RECORDED)
    session = VoiceSession("s-http", socket)
    await session.negotiate(SDP_OFFER)
    async with asyncio.timeout(2):
        while not any(f["type"] == "response.create" for f in socket.sent):
            await asyncio.sleep(0.01)
    await session.close()

    app, _ = app_with(FakeSocket(RECORDED))
    app.state.voice_sessions["s-http"] = session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://bff") as client:
        response = await client.get("/voice/session/s-http/events")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: tool_call" in response.text
    assert "event: tool_result" in response.text


# --- AC6: lifecycle --------------------------------------------------------


def test_deleting_a_session_closes_the_control_channel():
    socket = FakeSocket(RECORDED)
    app, _ = app_with(socket)

    with TestClient(app) as client:
        session = open_session(client)
        assert client.delete(f"/voice/session/{session['session_id']}").status_code == 204
        assert client.delete(f"/voice/session/{session['session_id']}").status_code == 404

    assert socket.closed


def test_shutdown_closes_a_session_the_browser_abandoned():
    """A closed tab sends no DELETE. Nothing may outlive the process."""
    socket = FakeSocket(RECORDED)
    app, _ = app_with(socket)

    with TestClient(app) as client:
        open_session(client)

    assert socket.closed


def test_events_for_an_unknown_session_are_a_404_not_an_empty_stream():
    socket = FakeSocket(RECORDED)
    app, _ = app_with(socket)

    with TestClient(app) as client:
        assert client.get("/voice/session/nope/events").status_code == 404


def test_voice_is_refused_when_it_is_not_configured():
    """A server without a Voice Live endpoint says so, rather than failing at negotiation."""
    app = create_app(project_endpoint="", project_name="p", model="gpt-5.5", voice_connect=None)

    with TestClient(app) as client:
        response = client.post("/voice/session", json={"sdp": SDP_OFFER})

    assert response.status_code == 503
    assert "voice" in response.json()["detail"].lower()


@pytest.mark.parametrize("payload", [{}, {"sdp": ""}])
def test_a_session_without_an_offer_is_rejected(payload: dict):
    socket = FakeSocket(RECORDED)
    app, _ = app_with(socket)

    with TestClient(app) as client:
        assert client.post("/voice/session", json=payload).status_code == 422


def test_voice_executes_tools_through_the_same_module_as_chat():
    """AC11, stated positively. The §8 import guards in `test_routes.py` already cover every module
    under `app/`, voice included. What they cannot see is a *second* executor being introduced that
    happens to name no tools — so this pins the identity."""
    import app.tool_executor as chat_path
    import app.voice_session as voice_path

    assert voice_path.execute is chat_path.execute


# --- spec 012: the session configuration rides on the SDP frame -------------


async def test_the_sdp_frame_carries_the_session_configuration():
    """AC1-AC3, AC5. The WebRTC doc carries the session object inside `rtc.call.sdp.create`, so the
    voice is set before a single word is spoken rather than one round trip later."""
    socket = FakeSocket(RECORDED)
    session = VoiceSession(
        "s-config",
        socket,
        session_config={
            "voice": {"name": "pt-BR-ThalitaMultilingualNeural", "type": "azure-standard"},
            "turn_detection": {"type": "azure_semantic_vad_multilingual"},
        },
    )

    await session.negotiate(SDP_OFFER)
    await session.close()

    frame = next(f for f in socket.sent if f["type"] == "rtc.call.sdp.create")
    assert frame["session"]["voice"]["name"] == "pt-BR-ThalitaMultilingualNeural"
    assert frame["session"]["turn_detection"]["type"] == "azure_semantic_vad_multilingual"
    assert "instructions" not in frame["session"]
    assert frame["sdp_offer"] == SDP_OFFER


async def test_an_unconfigured_session_sends_exactly_what_it_sent_before():
    """AC6. Configuration that cannot be turned off is a trap, and the recorded fixtures were
    captured without it."""
    socket = FakeSocket(RECORDED)
    session = VoiceSession("s-plain", socket)

    await session.negotiate(SDP_OFFER)
    await session.close()

    frame = next(f for f in socket.sent if f["type"] == "rtc.call.sdp.create")
    assert frame == {"type": "rtc.call.sdp.create", "sdp_offer": SDP_OFFER}


async def test_the_session_reports_what_it_negotiated(caplog):
    """A session that comes back `modalities: ["text"]` is a session with no sound, and until now
    the only symptom was silence. What the service agreed to is logged, so the difference between
    "the agent did not speak" and "the browser did not play" is one line away."""
    negotiated = {
        "type": "session.updated",
        "session": {
            "modalities": ["text"],
            "voice": {"name": "en-US-AvaNeural", "type": "azure-standard"},
        },
    }
    socket = FakeSocket([negotiated, *RECORDED])
    session = VoiceSession("s-log", socket)

    with caplog.at_level("INFO"):
        await session.negotiate(SDP_OFFER)
        await asyncio.sleep(0)
        await session.close()

    logged = " ".join(record.message for record in caplog.records)
    assert "modalities" in logged and "text" in logged
    assert "en-US-AvaNeural" in logged


# --- spec 016: the Portuguese voice, and the four places that state it ------

HD_VOICE = "pt-BR-Thalita:DragonHDLatestNeural"


def test_the_default_session_speaks_portuguese_in_the_hd_tier():
    """AC5. Chosen by listening on 2026-09-16, not from the documentation: spec 012 picked the
    Flash tier for latency and recorded that nobody had listened to it yet. Somebody has now."""
    from app.settings import load_settings

    config = load_settings(
        project_endpoint="https://x.services.ai.azure.com/api/projects/p",
        project_name="p",
        model="m",
        voicelive_voice=None,  # i.e. not overridden — the default is what is under test
    ).voice_session_config

    assert config["voice"] == {"name": HD_VOICE, "type": "azure-standard"}


def test_the_documented_default_voice_matches_the_code_default(monkeypatch):
    """AC6. The default voice is stated in three places — the dataclass, the environment fallback
    and `.env.example` — and a reader who changes one and not the others ships a lie. §4 says one
    source of truth; where the language cannot enforce it, a test does."""
    from app.settings import Settings, load_settings

    monkeypatch.delenv("VOICELIVE_VOICE", raising=False)
    env_example = (Path(__file__).resolve().parents[2] / ".env.example").read_text()
    documented = next(
        line.split("=", 1)[1].strip()
        for line in env_example.splitlines()
        if line.startswith("VOICELIVE_VOICE=")
    )

    assert Settings.voicelive_voice == documented
    assert load_settings(project_endpoint="e", project_name="p", model="m").voicelive_voice == (
        documented
    )


# --- spec 017: the session says what the agent cannot perceive --------------


async def test_the_session_tells_the_agent_it_is_being_listened_to():
    """AC3's mechanism. Observed 2026-09-16: the model, asked with real audio in and audio out,
    answers *"Estou trocando texto escrito com você."* — it has no idea it is speaking. So the
    session says so, once, when it opens, and the spoken answer stops reading URLs aloud.

    Sent as its own frame after the offer rather than inside it: the `session` object has no field
    for this (`instructions` is unsupported with a custom agent), and the conversation does.
    """
    socket = FakeSocket(RECORDED)
    session = VoiceSession("s-spoken", socket)

    await session.negotiate(SDP_OFFER)
    await session.close()

    item = next(f for f in socket.sent if f["type"] == "conversation.item.create")
    assert item["item"]["role"] == "system"
    assert "spoken" in item["item"]["content"][0]["text"].lower()
    # Order matters: the agent must know before it answers anything.
    assert socket.sent.index(item) > 0
    assert socket.sent[0]["type"] == "rtc.call.sdp.create"


async def test_the_context_item_is_the_only_thing_the_bff_puts_in_the_conversation():
    """§8, asserted. The BFF may state a fact about the transport; it may not hold a conversation.
    Anything else this session writes into the conversation is a tool output Foundry asked for."""
    socket = FakeSocket(RECORDED)
    session = VoiceSession("s-quiet", socket)

    await session.negotiate(SDP_OFFER)
    await asyncio.sleep(0)
    await session.close()

    items = [f for f in socket.sent if f["type"] == "conversation.item.create"]
    roles = [f["item"].get("role") or f["item"]["type"] for f in items]

    assert roles.count("system") == 1
    assert set(roles) <= {"system", "function_call_output"}


# --- voice follows the selected harness (spec 018, AC9) -------------------


def test_the_voice_session_attaches_to_the_harness_agent_not_the_env_var():
    """Verified live 2026-09-16: Voice Live attaches to a hosted agent exactly as to a prompt
    agent — same `agent_name` + `agent_project_name` query, only the agent named changes.

    Until spec 018 the router read `settings.agent_name` directly, which was harmless while one
    harness existed and wrong the moment a second one named a different agent: a voice session on
    `AGENT_HARNESS=langgraph` would have silently driven the PROMPT agent, and the comparison this
    repository exists to show would have been a lie told by the microphone.

    The adapter already answers this question — `voice_attachment_params()` is part of the §9
    Protocol for precisely this reason — so the router asks it.
    """
    from app.main import create_app

    app = create_app(
        harness="langgraph",
        stream_factory=lambda *_: iter(()),
        project_endpoint="https://example.services.ai.azure.com/api/projects/proj",
        project_name="proj",
        model="gpt-5.5",
    )

    params = app.state.harness.voice_attachment_params()

    assert params["agent_name"] == "foundry-live-agent-hosted"
    assert params["project_name"] == "proj"


# --- spec 019 AC8: the session attaches to the SELECTED agent --------------


def selectable(name: str, kind: str, **overrides):
    from app.agents import AgentSummary

    values = {
        "name": name,
        "kind": kind,
        "version": "2",
        "version_status": "active",
        "model": "gpt-5.5",
        "harness": "prompt-agent",
        "selectable": True,
        "reason": "",
    }
    return AgentSummary(**{**values, **overrides})


ROWS = [
    selectable("foundry-live-agent", "prompt"),
    selectable("foundry-live-agent-hosted", "hosted"),
    selectable("DatabricksGenie", "workflow", selectable=False, reason="no_harness"),
]


def app_with_listing(socket: FakeSocket):
    """`app_with`, plus an injected project listing and the queries the session attached with."""
    queries: list[dict] = []

    async def connect(query: dict) -> FakeSocket:
        queries.append(query)
        return socket

    app = create_app(
        voice_connect=connect,
        agent_lister=lambda: list(ROWS),
        project_endpoint="https://example.services.ai.azure.com/api/projects/p",
        project_name="p",
        agent_name="foundry-live-agent",
        model="gpt-5.5",
    )
    return app, queries


def test_a_voice_session_attaches_to_the_selected_agent():
    """AC8. Voice Live attaching to a *hosted* agent was verified live on 2026-09-16 (spec 018
    AC9), so the selection is honoured for both kinds rather than only the configured one."""
    app, queries = app_with_listing(FakeSocket(RECORDED))

    with TestClient(app) as client:
        response = client.post(
            "/voice/session", json={"sdp": SDP_OFFER, "agent": "foundry-live-agent-hosted"}
        )

    assert response.status_code == 200, response.text
    assert queries[0]["agent_name"] == "foundry-live-agent-hosted"


def test_a_voice_session_with_no_selection_attaches_to_the_configured_agent():
    app, queries = app_with_listing(FakeSocket(RECORDED))

    with TestClient(app) as client:
        open_session(client)

    assert queries[0]["agent_name"] == "foundry-live-agent"


def test_a_voice_session_naming_an_agent_this_build_cannot_drive_is_refused():
    app, queries = app_with_listing(FakeSocket(RECORDED))

    with TestClient(app) as client:
        response = client.post(
            "/voice/session", json={"sdp": SDP_OFFER, "agent": "DatabricksGenie"}
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "no_harness"
    assert queries == [], "nothing may be dialled for an agent we refuse"
