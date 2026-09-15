"""Configuration, read once and validated eagerly.

Misconfiguration fails fast with a typed error (constitution §5). A BFF that starts with a missing
endpoint and only fails on the first user message wastes the operator's time and looks like a bug in
the agent rather than in the environment.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

__all__ = ["Settings", "SettingsError", "load_settings"]


class SettingsError(RuntimeError):
    """The environment is not usable."""


@dataclass(frozen=True)
class Settings:
    project_endpoint: str
    project_name: str
    agent_name: str
    model: str
    harness: str
    agent_version: str | None = None
    voice_endpoint: str = ""
    # Observed 2026-09-15: the two Voice Live endpoints need DIFFERENT api-versions. The WebRTC
    # control route `/voice-live/realtime/calls` exists only on 2026-01-01-preview (404 on
    # 2026-04-10 and 2026-07-15, 401 on 2026-06-01-preview); the plain WebSocket route works on all
    # four. One shared value would silently break whichever path it was not chosen for.
    voice_webrtc_api_version: str = "2026-01-01-preview"
    voice_ws_api_version: str = "2026-04-10"
    # Text to speech for the chat's spoken answers (spec 008). The endpoint is the Speech
    # resource's **custom subdomain** host, and the resource id is not optional decoration: Entra
    # auth for this API carries it inside the Authorization header. Both are read from the
    # resource, never derived from the project endpoint — see app/speech.py (§10).
    speech_endpoint: str = ""
    speech_resource_id: str = ""
    speech_voice_en: str = "en-US-AvaMultilingualNeural"
    speech_voice_pt: str = "pt-BR-ThalitaMultilingualNeural"

    @property
    def voice_enabled(self) -> bool:
        return bool(self.voice_endpoint)

    @property
    def voice_calls_url(self) -> str:
        """The control-channel endpoint. Voice Live never goes through the AI Gateway."""
        host = self.voice_endpoint.split("://", 1)[-1].split("/", 1)[0]
        return f"wss://{host}/voice-live/realtime/calls"

    @property
    def speech_enabled(self) -> bool:
        """Both halves or neither: the resource id alone cannot address a host, and the host alone
        cannot build the `aad#` token."""
        return bool(self.speech_endpoint and self.speech_resource_id)

    def voice_for(self, lang: str) -> str:
        """The voice that reads in the reader's language."""
        return self.speech_voice_pt if lang == "pt" else self.speech_voice_en

    @property
    def uses_gateway(self) -> bool:
        """A `<connection>/<model>` name routes through the bring-your-own-model gateway.

        A plain name silently bypasses it, which is easy to do by accident — hence surfacing this
        in ``GET /config`` rather than leaving it to be discovered from a billing report.
        """
        return "/" in self.model


def load_settings(**overrides: object) -> Settings:
    """Build settings from the environment, with test overrides."""
    values = {
        "project_endpoint": os.environ.get("FOUNDRY_PROJECT_ENDPOINT", ""),
        "project_name": os.environ.get("FOUNDRY_PROJECT_NAME", ""),
        "agent_name": os.environ.get("AGENT_NAME", "foundry-live-agent"),
        "model": os.environ.get("FOUNDRY_MODEL_DEPLOYMENT", ""),
        "harness": os.environ.get("AGENT_HARNESS", "prompt-agent"),
        "agent_version": os.environ.get("AGENT_VERSION") or None,
        "voice_endpoint": os.environ.get("VOICELIVE_ENDPOINT")
        or _resource_endpoint(os.environ.get("FOUNDRY_PROJECT_ENDPOINT", "")),
        "voice_webrtc_api_version": os.environ.get(
            "VOICELIVE_WEBRTC_API_VERSION", "2026-01-01-preview"
        ),
        "voice_ws_api_version": os.environ.get("VOICELIVE_WS_API_VERSION", "2026-04-10"),
        "speech_endpoint": os.environ.get("SPEECH_ENDPOINT", ""),
        "speech_resource_id": os.environ.get("SPEECH_RESOURCE_ID", ""),
        "speech_voice_en": os.environ.get("SPEECH_VOICE_EN", "en-US-AvaMultilingualNeural"),
        "speech_voice_pt": os.environ.get("SPEECH_VOICE_PT", "pt-BR-ThalitaMultilingualNeural"),
    }
    values.update({k: v for k, v in overrides.items() if v is not None})
    return Settings(**values)  # type: ignore[arg-type]


def _resource_endpoint(project_endpoint: str) -> str:
    """Voice Live lives on the *resource*, not the project path.

    Deriving it saves one more variable to get wrong, and the derivation is the whole difference:
    `https://<resource>.services.ai.azure.com/api/projects/<project>` -> `https://<resource>…`.
    """
    if not project_endpoint:
        return ""
    scheme, _, rest = project_endpoint.partition("://")
    return f"{scheme}://{rest.split('/', 1)[0]}"


def require_live_settings(settings: Settings) -> None:
    """Check the settings needed to actually reach Foundry. Not called when a stream is injected."""
    missing = [
        name
        for name, value in (
            ("FOUNDRY_PROJECT_ENDPOINT", settings.project_endpoint),
            ("FOUNDRY_MODEL_DEPLOYMENT", settings.model),
        )
        if not value
    ]
    if missing:
        raise SettingsError(
            f"missing required environment variable(s): {', '.join(missing)}. "
            "Copy .env.example to .env and fill it in."
        )
