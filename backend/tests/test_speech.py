"""Spec 008 AC8, AC9 — `POST /speech`, and a BFF that was never configured for it.

The synthesiser is injected, so the request the BFF *would* make to Azure Speech is asserted
without a credential — the same pattern `stream_factory` and `voice_connect` already use.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

RESOURCE_ID = "/subscriptions/s/rg/providers/Microsoft.CognitiveServices/accounts/a"
SPEECH = {
    "speech_endpoint": "https://example-speech.cognitiveservices.azure.com",
    "speech_resource_id": RESOURCE_ID,
}

BASE = {
    "project_endpoint": "https://example.services.ai.azure.com/api/projects/proj",
    "project_name": "proj",
    "agent_name": "foundry-live-agent",
    "model": "conn/gpt-4o",
    "harness": "prompt-agent",
}


def client(**overrides):
    calls: list[dict] = []

    def synthesize(text: str, voice: str) -> bytes:
        calls.append({"text": text, "voice": voice})
        return b"ID3-audio"

    # A BFF with no speech configuration gets no synthesiser — injecting one would test a
    # server that cannot exist.
    app = create_app(
        stream_factory=lambda _i, _s: iter(()),
        synthesize=synthesize if overrides.get("speech_endpoint") else None,
        **{**BASE, **overrides},
    )
    return TestClient(app), calls


def test_speech_answers_with_audio_in_the_requested_language():
    c, calls = client(**SPEECH)

    response = c.post("/speech", json={"text": "são 13:53", "lang": "pt"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"ID3-audio"
    assert calls == [{"text": "são 13:53", "voice": "pt-BR-ThalitaMultilingualNeural"}]


def test_english_gets_the_english_voice():
    c, calls = client(**SPEECH)

    c.post("/speech", json={"text": "it is 13:53", "lang": "en"})

    assert calls[0]["voice"] == "en-US-AvaMultilingualNeural"


def test_the_voice_can_be_configured_per_language():
    c, calls = client(**SPEECH, speech_voice_pt="pt-BR-MacerioMultilingualNeural")

    c.post("/speech", json={"text": "olá", "lang": "pt"})

    assert calls[0]["voice"] == "pt-BR-MacerioMultilingualNeural"


def test_a_bff_without_speech_configuration_says_so_rather_than_failing_later():
    c, _ = client()

    assert c.get("/config").json()["speech"] == {"enabled": False}

    refused = c.post("/speech", json={"text": "olá", "lang": "pt"})
    assert refused.status_code == 503
    assert "SPEECH_ENDPOINT" in refused.json()["detail"]


def test_a_configured_bff_advertises_speech():
    c, _ = client(**SPEECH)

    assert c.get("/config").json()["speech"] == {"enabled": True}


@pytest.mark.parametrize("body", [{"text": "", "lang": "pt"}, {"text": "oi", "lang": "de"}])
def test_a_request_the_service_would_reject_is_rejected_here(body):
    """An empty string costs a round trip to be told nothing; a language we have no voice for
    would be synthesised in the wrong one."""
    c, calls = client(**SPEECH)

    assert c.post("/speech", json=body).status_code == 422
    assert calls == []
