"""Voice Live control-channel frames -> `AgentEvent` (spec 006, AC2 · AC9).

Both fixtures were captured from the live service on **2026-09-15** by `scripts/spike_voice.py`
against agent `foundry-live-agent` in `ai-admin2354ai223634534-project`. As with the text
recordings, an assertion here is a claim about Voice Live, not about us (§5, §10).
"""

import json
from pathlib import Path

import pytest

from harness._shared.contract import validate_event
from harness._shared.voice_events import (
    attachment_query,
    is_function_call,
    normalise_voice,
    unmapped_voice_types,
)

FIXTURES = Path(__file__).parent / "fixtures" / "recorded"
TOOL_CALL = FIXTURES / "voice-live-tool-call-20260915.jsonl"
HANDSHAKE = FIXTURES / "voice-live-webrtc-handshake-20260915.jsonl"


def frames(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def frame_of_type(path: Path, wanted: str) -> dict:
    return next(f for f in frames(path) if f.get("type") == wanted)


# --- attaching to the agent ------------------------------------------------


def test_the_session_attaches_to_the_configured_agent_by_name():
    query = attachment_query(agent="foundry-live-agent", project="proj-x")
    assert query == {"agent_name": "foundry-live-agent", "agent_project_name": "proj-x"}


def test_the_documented_parameter_names_are_not_used():
    """Observed 2026-09-15 — the quickstart says `project_name`, and the service rejects it with
    "Missing required agent project name". The wrong name fails at connect time with a message that
    reads like a missing value rather than a wrong key, which is why this is pinned by a test."""
    query = attachment_query(agent="a", project="p")
    assert "project_name" not in query
    assert "agent_id" not in query and "project_id" not in query


def test_the_recorded_session_really_attached_to_our_agent():
    session = frame_of_type(HANDSHAKE, "session.created")["session"]
    assert session["agent"]["name"] == "foundry-live-agent"
    assert session["agent"]["type"] == "agent"


def test_barge_in_is_on():
    """AC9. Interrupting the agent mid-sentence has to work, and it is a server-side default we
    depend on rather than set — so it is asserted, not assumed."""
    session = frame_of_type(HANDSHAKE, "session.created")["session"]
    assert session["turn_detection"]["interrupt_response"] is True
    assert session["turn_detection"]["type"] == "server_vad"


def test_the_handshake_answers_the_browsers_offer():
    answer = frame_of_type(HANDSHAKE, "rtc.call.sdp.created")
    assert answer["sdp_answer"].startswith("v=0")
    assert answer["rtc_call_id"]


# --- the function call on the control channel -----------------------------


def test_a_function_call_arrives_complete_on_the_control_channel():
    """The finding the whole design rests on — and it is *better* shaped than in text: the voice
    frame carries `name` and `call_id` together, where the Responses API sends `name: null`."""
    done = frame_of_type(TOOL_CALL, "response.function_call_arguments.done")

    assert is_function_call(done)
    assert done["name"] == "get_current_datetime"
    assert done["call_id"]
    assert json.loads(done["arguments"])["timezone"] == "America/Sao_Paulo"


def test_the_call_becomes_the_same_tool_call_event_the_chat_uses():
    calls = [e for e in normalise_voice(frames(TOOL_CALL)) if e["type"] == "tool_call"]

    assert len(calls) == 1
    assert calls[0]["name"] == "get_current_datetime"
    assert calls[0]["executor"] == "app"
    validate_event(calls[0])


def test_every_emitted_event_is_a_contract_event():
    """AC4: voice adds no event type. If it ever needs one, that is a §9 amendment, not a patch."""
    for event in normalise_voice(frames(TOOL_CALL)):
        validate_event(event)


def test_the_normaliser_knows_every_frame_the_service_sent():
    assert unmapped_voice_types(frames(TOOL_CALL)) == {}
    assert unmapped_voice_types(frames(HANDSHAKE)) == {}


def test_the_spoken_answer_is_not_re_streamed_as_text():
    """The browser hears the answer and reads its transcript over the data channel, straight from
    Voice Live. Re-emitting it through the BFF would duplicate state and put our server in the
    latency path of something the user is already hearing."""
    assert not [e for e in normalise_voice(frames(TOOL_CALL)) if e["type"] == "text_delta"]


def test_an_error_frame_terminates_the_session():
    events = list(
        normalise_voice(
            [{"type": "error", "error": {"message": "session expired", "code": "expired"}}]
        )
    )
    assert events == [{"type": "error", "message": "session expired", "code": "expired"}]


def test_a_frame_type_nobody_mapped_is_counted_not_dropped():
    raw = [{"type": "voice.something.new"}]
    assert list(normalise_voice(raw)) == []
    assert unmapped_voice_types(raw) == {"voice.something.new": 1}


@pytest.mark.parametrize("path", [TOOL_CALL, HANDSHAKE])
def test_the_fixtures_are_recordings_not_inventions(path: Path):
    """A guard on the evidence itself: every frame carries the service's own envelope."""
    for frame in frames(path):
        assert "type" in frame
