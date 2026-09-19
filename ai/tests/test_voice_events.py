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
    spoken_context_item,
    unmapped_voice_types,
    voice_session_config,
)

FIXTURES = Path(__file__).parent / "fixtures" / "recorded"
TOOL_CALL = FIXTURES / "voice-live-tool-call-20260915.jsonl"
HANDSHAKE = FIXTURES / "voice-live-webrtc-handshake-20260915.jsonl"
PREAMBLE = FIXTURES / "voice-live-preamble-20260916.jsonl"
NO_URLS = FIXTURES / "voice-live-no-urls-20260916.jsonl"
URLS_SPOKEN = FIXTURES / "voice-live-urls-spoken-20260916.jsonl"


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


# --- spec 012: the session configuration carried on the SDP frame ----------


def test_the_voice_is_named_and_typed_azure_standard():
    """AC1. `azure-realtime-native` names belong to the `azure-realtime` model; this session
    attaches to an agent on a normal deployment, so the type is `azure-standard` — which also
    covers the HD voices (`pt-BR-Thalita:DragonHDLatestNeural`)."""
    config = voice_session_config(voice="pt-BR-ThalitaMultilingualNeural")

    assert config["voice"] == {"name": "pt-BR-ThalitaMultilingualNeural", "type": "azure-standard"}


def test_semantic_turn_detection_is_what_makes_barge_in_configurable():
    """AC2. `interrupt_response` exists only on the azure semantic detectors; on the default
    `server_vad` the barge-in spec 006 promised is whatever the service happens to do."""
    config = voice_session_config(vad="azure_semantic_vad_multilingual")

    assert config["turn_detection"]["type"] == "azure_semantic_vad_multilingual"
    assert config["turn_detection"]["interrupt_response"] is True
    assert config["turn_detection"]["remove_filler_words"] is True


def test_input_audio_gets_noise_suppression_whenever_anything_is_configured():
    """AC3."""
    assert voice_session_config(voice="x")["input_audio_noise_reduction"] == {
        "type": "azure_deep_noise_suppression"
    }


def test_the_transcription_language_is_sent_only_when_it_is_configured():
    """AC4. Pinning a language makes the other half of a bilingual app worse, so it is opt-in."""
    with_language = voice_session_config(voice="x", input_language="pt")
    assert with_language["input_audio_transcription"] == {"model": "azure-speech", "language": "pt"}

    assert "input_audio_transcription" not in voice_session_config(voice="x")


def test_instructions_are_never_sent():
    """AC5. Documented as unsupported with a custom agent — and it would override the agent this
    whole repository is about."""
    config = voice_session_config(
        voice="pt-BR-ThalitaMultilingualNeural",
        vad="azure_semantic_vad_multilingual",
        input_language="pt",
    )

    assert "instructions" not in config


def test_the_session_asks_for_audio_out_loud():
    """The one field that decides whether the agent speaks at all.

    Observed in the committed fixtures: one recorded session reports `"modalities": ["text"]` and
    another `["audio", "text"]`. The service picks a default and it is not always the one that
    talks — so a voice session says what it wants rather than hoping."""
    config = voice_session_config(voice="pt-BR-ThalitaMultilingualNeural")

    assert config["modalities"] == ["audio", "text"]


def test_a_blank_configuration_produces_nothing_at_all():
    """AC6. An operator who sets none of the variables gets the frame this app sent before."""
    assert voice_session_config() == {}
    assert voice_session_config(voice="", vad="", input_language="") == {}


# --- spec 016: the agent speaks before it goes quiet, in voice too ----------


def preamble_frames() -> list[dict]:
    return [json.loads(line) for line in PREAMBLE.read_text().splitlines() if line.strip()]


def test_the_agent_speaks_before_it_calls_a_tool_in_voice():
    """AC4, recorded 2026-09-16 against agent version 6 over the control channel.

    The text recording (`test_recorded_turn.py`) proves the Responses API side; this proves the
    modality the spec was actually written for. Same probe, in Portuguese: the session emits seven
    `response.audio_transcript.delta` frames — *"Vou verificar isso na internet agora."* — and only
    then the frame that makes the agent go quiet.
    """
    types = [frame.get("type") for frame in preamble_frames()]
    spoke = types.index("response.audio_transcript.delta")
    called = types.index("response.function_call_arguments.done")

    assert spoke < called, "the session went straight to the tool — the user hears only silence"


def test_the_recorded_session_negotiated_the_hd_voice_and_real_audio():
    """AC7. `azure-standard` accepts the HD name, this project's own resource serves it, and the
    session produced **audio frames** with it — not merely an echo of the name in `session.updated`.

    That distinction is the whole reason this is a recording and not a settings assertion: spec 012
    could only say the name came back, and a voice that is accepted but mute sounds exactly like a
    voice that is working (§5).
    """
    frames = preamble_frames()
    negotiated = next(f for f in frames if f.get("type") == "session.updated")["session"]

    assert negotiated["voice"]["name"] == "pt-BR-Thalita:DragonHDLatestNeural"
    assert negotiated["voice"]["type"] == "azure-standard"
    assert negotiated["modalities"] == ["audio", "text"]
    assert sum(1 for f in frames if f.get("type") == "response.audio.delta") > 0


def test_the_preamble_recording_adds_no_unmapped_frame_types():
    """A newer session than either 2026-09-15 fixture: if Voice Live started sending something the
    normaliser does not know, this is where it surfaces (§9)."""
    assert unmapped_voice_types(preamble_frames()) == {}


# --- spec 017: telling the agent what it cannot perceive --------------------


def test_the_spoken_context_item_says_the_conversation_is_heard_not_read():
    """The agent cannot tell. Observed 2026-09-16 with real audio in and audio out, asked directly:
    *"Estou trocando texto escrito com você."* The Voice Live cascade transcribes before the model
    and synthesizes after it, so there is no modality signal in the model's input at all.

    So the session states it. One item, at session open, about the **transport** — not about which
    tool to call and not derived from anything the model said (constitution §8, amended).
    """
    frame = spoken_context_item()

    assert frame["type"] == "conversation.item.create"
    assert frame["item"]["role"] == "system"
    text = frame["item"]["content"][0]["text"].lower()
    assert "spoken" in text, "the item exists to state the one fact the agent cannot observe"
    assert "url" in text, "and the one consequence that fact has for the answer"


def test_the_spoken_context_item_carries_no_tool_and_no_state():
    """§8's line, asserted rather than trusted: this item states a property of the channel. If it
    ever grows a tool name, a plan, or conversation state Foundry owns, that is the violation."""
    text = frame_text = spoken_context_item()["item"]["content"][0]["text"]

    for identifier in ("search_web", "lookup_knowledge", "get_current_datetime", "microsoft_learn"):
        assert identifier not in text
    assert len(frame_text) < 400, "session context, not a second agent definition"


# --- spec 017, proved by a controlled pair ---------------------------------


def spoken(path) -> str:
    """Everything the agent actually said in a recording."""
    frames = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    return " ".join(
        f.get("transcript", "") for f in frames if f.get("type") == "response.audio_transcript.done"
    )


def test_the_spoken_answer_carries_no_url():
    """AC3, recorded 2026-09-16 on agent version 8, driven by **real audio** — macOS `say` into
    `input_audio_buffer.append`, so the user item is speech and gets transcribed, not a text item
    dressed up as one. The agent answers the question and stops."""
    said = spoken(NO_URLS)

    assert "http" not in said
    assert "www." not in said


def test_without_the_context_item_the_same_agent_reads_the_url_out_loud():
    """The control. Same agent version, same probe, same audio — only the session item removed, and
    the URL comes back. That is what makes AC3 a claim about **this change** rather than about the
    weather: a fixture where the fix is absent and the failure reappears."""
    assert "http" in spoken(URLS_SPOKEN)


def test_the_spoken_answer_still_answers():
    """AC5. Suppressing the sources must not suppress the answer — a rule that produced silence
    would pass the assertion above and fail the user."""
    said = spoken(NO_URLS)

    assert len(said) > 80
    assert "Corinthians" in said


def test_the_preamble_survived_the_new_rule():
    """AC6. Each behavioural rule competes for the model's attention with the ones before it, so
    spec 016's ordering is re-asserted on the newest recording rather than assumed to have held."""
    types = [
        json.loads(line).get("type") for line in NO_URLS.read_text().splitlines() if line.strip()
    ]

    assert types.index("response.audio_transcript.delta") < types.index(
        "response.function_call_arguments.done"
    )


# --- spec 028 AC5: the cache, over the control channel ----------------------


def test_voice_usage_carries_the_cache_under_its_own_spelling():
    """Voice Live says `input_token_details`; the Responses API says `input_tokens_details`.

    One letter, two APIs, and a copied reader would find `None` every time and price every cached
    token at the full rate without ever failing. That is why each emitter reads its own spelling and
    each has its own recording behind it — here, a real session that served 1024 of its input tokens
    from cache (spec 028).
    """
    events = [e for e in normalise_voice(frames(PREAMBLE)) if e["type"] == "usage"]
    assert events, "the recorded session reported usage"

    cached = [e["cached_input_tokens"] for e in events]
    assert 1024 in cached

    for event in events:
        assert event["cached_input_tokens"] <= event["input_tokens"], "cache is part of the input"


def test_voice_usage_stays_a_contract_event_with_the_new_field():
    for event in normalise_voice(frames(PREAMBLE)):
        validate_event(event)
