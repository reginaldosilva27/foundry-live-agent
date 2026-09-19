"""Choosing the voice on the screen (spec 043).

Spec 012 declared "no per-session choice in the UI" and was right to. The record of what followed is
the argument for revisiting it: the default voice changed three times in two days, each time after
somebody listened to it, and each change needed an environment variable and a restart.

This revisits that one non-goal — the voice, and nothing else. Turn detection and noise suppression
stay deployment configuration, because a reader cannot evaluate them in one session.
"""

from __future__ import annotations

from app.settings import load_settings

THALITA = "pt-BR-Thalita:DragonHDLatestNeural"
LUANA = "pt-BR-LuanaNeural"


class TestWhatIsOffered:
    def test_a_deployment_that_declared_nothing_offers_exactly_one(self):
        """AC2 — every deployment that has not opted in, which is spec 012's behaviour unchanged."""
        settings = load_settings(voicelive_voice=THALITA, voicelive_voices=[])
        assert settings.offered_voices == [THALITA]

    def test_the_configured_default_is_always_offered_and_comes_first(self):
        settings = load_settings(voicelive_voice=THALITA, voicelive_voices=[LUANA])
        assert settings.offered_voices == [THALITA, LUANA]

    def test_does_not_repeat_the_default_when_it_was_also_declared(self):
        settings = load_settings(voicelive_voice=THALITA, voicelive_voices=[THALITA, LUANA])
        assert settings.offered_voices == [THALITA, LUANA]

    def test_reads_a_comma_separated_declaration(self, monkeypatch):
        monkeypatch.setenv("VOICELIVE_VOICES", f" {LUANA} , {THALITA} ,")
        monkeypatch.setenv("VOICELIVE_VOICE", THALITA)
        assert load_settings().offered_voices == [THALITA, LUANA]


class TestTheSessionConfiguration:
    def test_speaks_in_the_chosen_voice(self):
        settings = load_settings(voicelive_voice=THALITA, voicelive_voices=[LUANA])
        assert settings.session_config_for(LUANA)["voice"]["name"] == LUANA

    def test_falls_back_to_the_default_when_none_was_chosen(self):
        settings = load_settings(voicelive_voice=THALITA, voicelive_voices=[LUANA])
        assert settings.session_config_for(None)["voice"]["name"] == THALITA

    def test_falls_back_rather_than_forwarding_something_unoffered(self):
        settings = load_settings(voicelive_voice=THALITA, voicelive_voices=[LUANA])
        assert settings.session_config_for("en-US-Nobody")["voice"]["name"] == THALITA

    def test_carries_no_instructions_and_no_extra_context(self):
        """AC7 — §8's single bounded exception (spec 017) is spent and stays spent.

        Nothing this spec adds may say anything to the model. `instructions` is unsupported with a
        custom agent anyway, and a second context item would be a second exception.
        """
        config = load_settings(voicelive_voice=THALITA).session_config_for(THALITA)

        assert "instructions" not in config
        assert "instructions" not in str(config)

    def test_turn_detection_is_not_settable_from_a_choice(self):
        """AC8 — only the voice moved to the screen."""
        settings = load_settings(voicelive_voice=THALITA, voicelive_vad="azure_semantic_vad")

        chosen = settings.session_config_for(THALITA)["turn_detection"]
        default = settings.session_config_for(None)["turn_detection"]
        assert chosen == default


class TestTheRoute:
    def test_refuses_a_voice_the_deployment_does_not_offer(self):
        """AC6 — refused at the BFF, not merely absent from the UI.

        A list the browser could step outside of would not be a list, and a free-text field would
        let the browser ask the service for anything at all.
        """
        from fastapi.testclient import TestClient

        from app.main import create_app

        app = create_app(
            stream_factory=lambda *_: iter(()),
            voice_connect=lambda *_a, **_k: None,
            agent_name="foundry-live-agent",
            harness="prompt-agent",
            voice_endpoint="https://example.services.ai.azure.com",
            voicelive_voice=THALITA,
            voicelive_voices=[LUANA],
        )
        response = TestClient(app).post(
            "/voice/session", json={"sdp": "v=0", "voice": "en-US-Nobody"}
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "voice_not_offered"

    def test_config_reports_what_may_be_chosen(self):
        from fastapi.testclient import TestClient

        from app.main import create_app

        app = create_app(
            stream_factory=lambda *_: iter(()),
            agent_name="a",
            harness="prompt-agent",
            voicelive_voice=THALITA,
            voicelive_voices=[LUANA],
        )
        voice = TestClient(app).get("/config").json()["voice"]

        assert voice["voice"] == THALITA
        assert voice["voices"] == [THALITA, LUANA]
