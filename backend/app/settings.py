"""Configuration, read once and validated eagerly.

Misconfiguration fails fast with a typed error (constitution §5). A BFF that starts with a missing
endpoint and only fails on the first user message wastes the operator's time and looks like a bug in
the agent rather than in the environment.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

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
    # How the voice session sounds and listens (spec 012, voice revised by spec 016). The HD tier,
    # chosen by listening on 2026-09-16 — spec 012 picked MAI-Voice-2-Flash from the documentation,
    # for latency, and recorded that nobody had listened to it. HD is slower to first audio, which
    # is the trade; `VOICELIVE_VOICE` is the way back and `.env.example` lists the alternatives.
    # The semantic detector is what makes barge-in configurable. Blank any of them to fall back to
    # the service.
    voicelive_voice: str = "pt-BR-Thalita:DragonHDLatestNeural"
    # The voices this deployment offers (spec 043). Empty means "only the configured one", which is
    # every deployment that has not opted in — so the default experience is exactly spec 012's.
    #
    # DECLARED, not read from the service: which identifiers are valid on this api-version is a §10
    # question and no doc has been read for it. A declared list needs no verification and cannot go
    # stale against a service we never asked.
    voicelive_voices: list[str] = field(default_factory=list)
    voicelive_vad: str = "azure_semantic_vad_multilingual"
    # Pinning a language would make the other half of a bilingual app worse, so it is opt-in.
    voicelive_input_language: str = ""
    # Text to speech for the chat's spoken answers (spec 008). The endpoint is the Speech
    # resource's **custom subdomain** host, and the resource id is not optional decoration: Entra
    # auth for this API carries it inside the Authorization header. Both are read from the
    # resource, never derived from the project endpoint — see app/speech.py (§10).
    speech_endpoint: str = ""
    speech_resource_id: str = ""
    speech_voice_en: str = "en-US-AvaMultilingualNeural"
    speech_voice_pt: str = "pt-BR-ThalitaMultilingualNeural"
    # Where the agent's spans land (spec 005). The ARM resource id, not the connection string:
    # `LogsQueryClient.query_resource` addresses a resource, while the connection string carries an
    # `ApplicationId` for a different API. It cannot be derived from anything else we hold, so it is
    # its own variable — and unset simply means the trace panel says tracing is not configured.
    appinsights_resource_id: str = ""
    # Whether this deployment may change which version the project serves (spec 031).
    #
    # **Off by default, and the first boolean capability flag here.** Every other one is derived
    # from the presence of configuration — `pricing_enabled` from a rate table, `voice_enabled`
    # from an endpoint — because those capabilities need an address. This one needs a *permission*,
    # and there is no address to key off: the project endpoint is already configured for reads.
    #
    # It reveals a control; it cannot grant anything. RBAC on the deployment identity is the actual
    # enforcement, and a deployment that turns this on without the role gets the permission failure
    # the screen renders as a configuration fact. Off is the default because anyone who can reach
    # this BFF can otherwise change what every caller of the project gets. See SECURITY.md.
    allow_version_promote: bool = False
    # Whether this deployment offers the definition editor (spec 041).
    #
    # Off by default like the promote flag, and for a smaller reason: nothing here writes anything,
    # so the risk is not damage but noise — a deployed demo does not need an editor on it. What it
    # gates is a surface, not a permission.
    allow_proposals: bool = False
    # Whether this deployment exposes the tool playground (spec 042).
    #
    # Its OWN flag, not shared with any other developer surface. Spec 038's event inspector reads
    # what already happened and costs nothing; this spends a metered third-party key and makes the
    # BFF fetch arbitrary queries. Different risk, different switch. See SECURITY.md.
    allow_playground: bool = False
    # What a turn costs (spec 028). **This repository ships no prices.** A rate compiled in here
    # would be a fact with no owner: prices vary by region and by agreement and change without
    # telling us, and a number rendered with a currency symbol reads as measured (§5). So the
    # operator declares the table, the currency and the DATE they read it, and an unconfigured
    # deployment renders tokens exactly as before and no money at all.
    #
    # Rates are per million tokens, which is how every price page reads them.
    model_rates: dict[str, dict[str, float]] = field(default_factory=dict)
    rates_currency: str = ""
    rates_recorded_at: str = ""

    @property
    def pricing_enabled(self) -> bool:
        return bool(self.model_rates)

    @property
    def voice_enabled(self) -> bool:
        return bool(self.voice_endpoint)

    @property
    def voice_calls_url(self) -> str:
        """The control-channel endpoint. Voice Live never goes through the AI Gateway."""
        host = self.voice_endpoint.split("://", 1)[-1].split("/", 1)[0]
        return f"wss://{host}/voice-live/realtime/calls"

    @property
    def voice_session_config(self) -> dict:
        """What to send with the SDP offer. Built here so the router stays a router."""
        from harness._shared.voice_events import voice_session_config

        return voice_session_config(
            voice=self.voicelive_voice,
            vad=self.voicelive_vad,
            input_language=self.voicelive_input_language,
        )

    @property
    def offered_voices(self) -> list[str]:
        """What the browser may choose from, with the configured default first.

        A deployment that declared nothing offers exactly one voice, and the screen shows no
        chooser — spec 012's behaviour, unchanged.
        """
        # The default first, always: it is what a session uses when nobody chooses, so a chooser
        # that listed it third would be describing a different default from the one in force.
        rest = [v for v in self.voicelive_voices if v and v != self.voicelive_voice]
        return [self.voicelive_voice, *rest]

    def session_config_for(self, voice: str | None) -> dict:
        """The session configuration, with a chosen voice if the deployment offers it.

        `None` and an unoffered value both fall back to the configured default; the ROUTE refuses
        an unoffered value outright, so this is belt and braces rather than the check itself.
        """
        from harness._shared.voice_events import voice_session_config

        return voice_session_config(
            voice=voice if voice in self.offered_voices else self.voicelive_voice,
            vad=self.voicelive_vad,
            input_language=self.voicelive_input_language,
        )

    @property
    def speech_enabled(self) -> bool:
        """Both halves or neither: the resource id alone cannot address a host, and the host alone
        cannot build the `aad#` token."""
        return bool(self.speech_endpoint and self.speech_resource_id)

    def voice_for(self, lang: str) -> str:
        """The voice that reads in the reader's language."""
        return self.speech_voice_pt if lang == "pt" else self.speech_voice_en

    @property
    def tracing_enabled(self) -> bool:
        return bool(self.appinsights_resource_id)

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
        "voicelive_voice": os.environ.get("VOICELIVE_VOICE", "pt-BR-Thalita:DragonHDLatestNeural"),
        "voicelive_voices": _voices(os.environ.get("VOICELIVE_VOICES", "")),
        "voicelive_vad": os.environ.get("VOICELIVE_VAD", "azure_semantic_vad_multilingual"),
        "voicelive_input_language": os.environ.get("VOICELIVE_INPUT_LANGUAGE", ""),
        "speech_endpoint": os.environ.get("SPEECH_ENDPOINT", ""),
        "speech_resource_id": os.environ.get("SPEECH_RESOURCE_ID", ""),
        "speech_voice_en": os.environ.get("SPEECH_VOICE_EN", "en-US-AvaMultilingualNeural"),
        "speech_voice_pt": os.environ.get("SPEECH_VOICE_PT", "pt-BR-ThalitaMultilingualNeural"),
        "appinsights_resource_id": os.environ.get("APPLICATIONINSIGHTS_RESOURCE_ID", ""),
        "allow_version_promote": _flag(os.environ.get("FOUNDRY_ALLOW_VERSION_PROMOTE")),
        "allow_proposals": _flag(os.environ.get("FOUNDRY_ALLOW_PROPOSALS")),
        "allow_playground": _flag(os.environ.get("FOUNDRY_ALLOW_PLAYGROUND")),
        "model_rates": _model_rates(os.environ.get("MODEL_RATES", "")),
        "rates_currency": os.environ.get("MODEL_RATES_CURRENCY", "USD"),
        "rates_recorded_at": os.environ.get("MODEL_RATES_RECORDED_AT", ""),
    }
    if values["model_rates"] and not values["rates_recorded_at"]:
        raise SettingsError(
            "MODEL_RATES_RECORDED_AT is required alongside MODEL_RATES: a rate with no date is a "
            "number nobody can judge the staleness of"
        )
    values.update({k: v for k, v in overrides.items() if v is not None})
    return Settings(**values)  # type: ignore[arg-type]


_RATE_KEYS = ("input", "cached_input", "output")


def _model_rates(raw: str) -> dict[str, dict[str, float]]:
    """Parse the declared rate table, or refuse it.

    Validated eagerly for the reason the module docstring gives: a table that only fails when
    somebody opens the trace panel looks like a bug in the agent rather than in the environment.
    Empty is the DEFAULT and is not a failure — it is how most deployments of this repo will run.
    """
    if not raw.strip():
        return {}

    try:
        parsed = json.loads(raw)
    except ValueError as exc:
        raise SettingsError(f"MODEL_RATES is not valid JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise SettingsError("MODEL_RATES must be an object of model -> rates")

    table: dict[str, dict[str, float]] = {}
    for model, rates in parsed.items():
        if not isinstance(rates, dict):
            raise SettingsError(f"MODEL_RATES[{model!r}] must be an object")
        clean: dict[str, float] = {}
        for key, value in rates.items():
            if key not in _RATE_KEYS:
                raise SettingsError(f"MODEL_RATES[{model!r}] has unknown rate {key!r}")
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise SettingsError(f"MODEL_RATES[{model!r}][{key!r}] must be a number")
            clean[key] = float(value)
        table[model] = clean

    return table


def _voices(value: str) -> list[str]:
    """The declared voice list, comma-separated. Blank means none were declared."""
    return [voice.strip() for voice in value.split(",") if voice.strip()]


def _flag(value: str | None) -> bool:
    """An env var read as a deliberate yes, and anything else as no (spec 031).

    Only an explicit affirmative turns a write surface on. A typo, a blank, or a shell that passed
    the literal string "false" all mean off — which is the safe direction for the one setting in
    this app that changes what other people's turns get.
    """
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


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
