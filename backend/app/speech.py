"""Text to speech, through Azure AI Speech, for the chat's spoken answers (spec 008).

**Everything here about the wire comes from the docs, not from memory** (constitution §10) — both
are recorded in `docs/REFERENCES.md` and in the spec's plan:

- `POST {endpoint}/cognitiveservices/v1`, body **SSML**, with `Content-Type: application/ssml+xml`,
  an `X-Microsoft-OutputFormat` and a `User-Agent`. All four headers are documented as required.
- Entra authentication does **not** send a plain bearer token. The value is
  `Bearer aad#{resourceId}#{token}`, the token acquired for the scope
  `https://cognitiveservices.azure.com/.default`, against the resource's custom-subdomain host. The
  caller needs the *Cognitive Services Speech User* role.

The endpoint is configuration rather than a derivation of the project endpoint: whether a given
Foundry resource answers text to speech on its own host is a property of that resource, and
guessing it would be exactly the §10 mistake. The REST API is used instead of the Speech SDK
because the SDK ships native binaries and this is one POST.
"""

from __future__ import annotations

from typing import Any
from xml.sax.saxutils import escape

from app.settings import Settings

__all__ = ["build_ssml", "build_synthesizer", "MP3_FORMAT"]

# A streaming format, so playback can start before the whole body arrives, and MP3 because every
# browser plays it from an <audio> element without a codec question.
MP3_FORMAT = "audio-24khz-48kbitrate-mono-mp3"

_SCOPE = "https://cognitiveservices.azure.com/.default"
_USER_AGENT = "foundry-live-agent"


def build_ssml(text: str, voice: str) -> str:
    """One utterance, in one voice. The locale comes from the voice's own name."""
    locale = "-".join(voice.split("-")[:2])
    return (
        f"<speak version='1.0' xml:lang='{locale}'>"
        f"<voice name='{voice}'>{escape(text)}</voice>"
        "</speak>"
    )


def build_synthesizer(settings: Settings):
    """Return `(text, voice) -> mp3 bytes`, or `None` when the BFF has no speech configuration.

    Built lazily and cached, for the same reason the Foundry client is: each credential is a token
    acquisition, and paying it per sentence would be audible.
    """
    if not settings.speech_enabled:
        return None

    cached: dict[str, Any] = {}

    def synthesize(text: str, voice: str) -> bytes:
        import httpx
        from azure.identity import DefaultAzureCredential

        credential = cached.get("credential")
        if credential is None:
            credential = cached["credential"] = DefaultAzureCredential()

        token = credential.get_token(_SCOPE).token
        response = httpx.post(
            f"{settings.speech_endpoint.rstrip('/')}/cognitiveservices/v1",
            content=build_ssml(text, voice).encode("utf-8"),
            headers={
                # Not a plain bearer token: the resource id travels inside the header value.
                "Authorization": f"Bearer aad#{settings.speech_resource_id}#{token}",
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": MP3_FORMAT,
                "User-Agent": _USER_AGENT,
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.content

    return synthesize
