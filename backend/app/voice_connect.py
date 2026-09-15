"""Opening the real Voice Live control channel.

Separated from `voice_session.py` so the session logic — the part with the invariants — is testable
without a network, a credential, or a websocket library. This module is the part that cannot be
tested in CI, and it is small on purpose.

Entra ID only: **key authentication is unsupported in agent mode**, which suits this repository's
"no secrets anywhere" rule rather than fighting it.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any
from urllib.parse import urlencode

from app.settings import Settings
from app.voice_session import VoiceSocket

__all__ = ["build_connect"]

SCOPE = "https://ai.azure.com/.default"


class _Socket:
    """Adapts a `websockets` connection to the narrow `VoiceSocket` Protocol."""

    def __init__(self, connection: Any) -> None:
        self._connection = connection

    async def send(self, payload: str) -> None:
        await self._connection.send(payload)

    async def recv(self) -> str:
        return await self._connection.recv()

    async def close(self) -> None:
        await self._connection.close()


def build_connect(settings: Settings) -> Callable[[dict[str, str]], Any] | None:
    """Return a connector for this configuration, or `None` when voice is not configured.

    Returning `None` rather than raising is what lets `GET /config` tell the browser to leave the
    Voice button disabled, instead of offering a feature that fails on click.
    """
    if not settings.voice_enabled:
        return None

    async def connect(attachment: dict[str, str]) -> VoiceSocket:
        import websockets

        # The synchronous credential on a worker thread, rather than `azure.identity.aio`: the
        # async one needs `aiohttp`, and a whole extra HTTP stack to fetch one token per session
        # is a poor trade. This is also the same credential the chat path already uses.
        token = await asyncio.to_thread(_token)

        query = urlencode({"api-version": settings.voice_webrtc_api_version, **attachment})
        connection = await websockets.connect(
            f"{settings.voice_calls_url}?{query}",
            additional_headers={"Authorization": f"Bearer {token}"},
            max_size=8 * 1024 * 1024,
        )
        return _Socket(connection)

    return connect


def _token() -> str:
    from azure.identity import DefaultAzureCredential

    with DefaultAzureCredential() as credential:
        return credential.get_token(SCOPE).token
