"""One Voice Live control channel, held server-side.

**This module executes; it never chooses** (§8). It relays an SDP offer, then sits on the control
socket answering the function calls Voice Live asks for — through the *same* `tool_executor` the
chat router uses, resolved by name through the registry. It contains no tool name, no tool list, and
no decision about which tool to run. Swap the harness and this code is unchanged.

Why the server holds this socket at all, when the audio is peer-to-peer: because the credential
lives here. The browser never receives a token, and Voice Live routes tool calls to the control
channel precisely so a backend can answer them.

The failure that matters is the same one as in text, with a worse symptom. Voice Live waits for a
function call's output; if it never arrives, the agent simply stops talking mid-turn and the user
assumes the app broke. So every collected call is answered — with an error payload if the tool
failed, because an error the agent can speak is better than silence (§5).
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any, Protocol

from harness._shared.contract import AgentEvent
from harness._shared.voice_events import is_function_call, normalise_voice, tool_output_frame

from app.tool_executor import execute

__all__ = ["VoiceSession", "VoiceSocket", "NegotiationError"]

_log = logging.getLogger(__name__)

NEGOTIATION_TIMEOUT = 30.0


class NegotiationError(RuntimeError):
    """Voice Live did not answer the browser's offer."""


class VoiceSocket(Protocol):
    """The control channel, narrowed to what this module needs.

    A Protocol rather than the websocket type so tests replay recorded frames through the identical
    code path — the same injection the chat router uses for Foundry streams.
    """

    async def send(self, payload: str) -> None: ...
    async def recv(self) -> str: ...
    async def close(self) -> None: ...


Executor = Callable[[str, str], Any]
Connect = Callable[[dict[str, str]], Awaitable[VoiceSocket]]


class VoiceSession:
    """A live voice conversation: the SDP handshake, then the tool round trip."""

    def __init__(
        self,
        session_id: str,
        socket: VoiceSocket,
        executor: Executor = execute,
        session_config: dict[str, Any] | None = None,
    ) -> None:
        self.id = session_id
        self._socket = socket
        self._executor = executor
        # The voice, the turn detector and the input audio options, or `{}` for a deployment that
        # configures none of them — see `voice_session_config` (spec 012).
        self._session_config = session_config or {}
        self._events: asyncio.Queue[AgentEvent | None] = asyncio.Queue()
        self._pump: asyncio.Task[None] | None = None
        self._closed = False

    async def negotiate(self, sdp_offer: str) -> str:
        """Relay the browser's offer and return Voice Live's answer.

        Frames that arrive before the answer are not discarded — the session is already live by
        then, and a tool call landing in that window would otherwise be dropped.
        """
        frame: dict[str, Any] = {"type": "rtc.call.sdp.create", "sdp_offer": sdp_offer}
        if self._session_config:
            # Carried with the offer rather than as a later `session.update`: documented shape, no
            # extra round trip, and no window in which the session runs with the wrong voice.
            frame["session"] = self._session_config
        await self._socket.send(json.dumps(frame))

        try:
            async with asyncio.timeout(NEGOTIATION_TIMEOUT):
                while True:
                    frame = json.loads(await self._socket.recv())
                    if frame.get("type") == "rtc.call.sdp.created":
                        self._pump = asyncio.create_task(self._run())
                        return frame["sdp_answer"]
                    if frame.get("type") == "rtc.call.error":
                        detail = (frame.get("error") or {}).get("message") or "call setup failed"
                        raise NegotiationError(detail)
                    await self._handle(frame)
        except TimeoutError:
            raise NegotiationError(
                f"Voice Live did not answer the offer within {NEGOTIATION_TIMEOUT:.0f}s"
            ) from None

    async def events(self) -> AsyncIterator[AgentEvent]:
        """The session's activity, as the same `AgentEvent`s the text chat emits."""
        while True:
            event = await self._events.get()
            if event is None:
                return
            yield event

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._pump is not None:
            self._pump.cancel()
        await self._socket.close()
        await self._events.put(None)

    # --- the receive loop --------------------------------------------------

    async def _run(self) -> None:
        try:
            while True:
                await self._handle(json.loads(await self._socket.recv()))
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - a terminal event is a promise (§9)
            await self._events.put(
                {
                    "type": "error",
                    "message": f"{type(exc).__name__}: {exc}",
                    "code": "voice_channel_error",
                }
            )
            await self._events.put(None)

    async def _handle(self, frame: dict[str, Any]) -> None:
        if frame.get("type") in {"session.created", "session.updated"}:
            # What the service actually agreed to — not what we asked for. A session that comes
            # back `modalities: ["text"]` produces a transcript and no sound, and the only symptom
            # is silence; a wrong voice is equally invisible. Logged so that "the agent did not
            # speak" and "the browser did not play" are one line apart (§5).
            negotiated = frame.get("session") or {}
            voice = negotiated.get("voice") or {}
            _log.info(
                "voice session negotiated: modalities=%s voice=%s turn_detection=%s",
                negotiated.get("modalities"),
                voice.get("name"),
                (negotiated.get("turn_detection") or {}).get("type"),
            )

        for event in normalise_voice([frame]):
            await self._events.put(event)

        if is_function_call(frame):
            await self._answer(frame["call_id"], frame["name"], frame.get("arguments") or "{}")

    async def _answer(self, call_id: str, name: str, arguments: str) -> None:
        """Run the tool and hand the output back. Never raises: `execute` already can't."""
        result = self._executor(name, arguments)

        event: dict[str, Any] = {
            "type": "tool_result",
            "call_id": call_id,
            "name": result.name,
            "output": result.output,
            "duration_ms": result.duration_ms,
        }
        if result.error:
            event["error"] = result.error
        await self._events.put(event)  # type: ignore[arg-type]

        await self._socket.send(json.dumps(tool_output_frame(call_id, result.output)))
        # Submitting the output is not enough — the agent resumes only when asked to.
        await self._socket.send(json.dumps({"type": "response.create"}))
