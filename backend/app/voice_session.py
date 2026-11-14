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
import contextlib
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any, Protocol

from harness._shared.contract import AgentEvent
from harness._shared.current_moment import DEFAULT_TIMEZONE
from harness._shared.errors import client_message
from harness._shared.voice_events import (
    current_moment_frame,
    is_function_call,
    normalise_voice,
    spoken_context_item,
    tool_output_frame,
)

from app.tool_executor import execute

__all__ = ["VoiceSession", "VoiceSocket", "NegotiationError"]

_log = logging.getLogger(__name__)

NEGOTIATION_TIMEOUT = 30.0

#: How long a negotiated session waits for someone to read its activity stream. The browser opens
#: `GET /voice/session/{id}/events` right after the answer, and that stream ending is what releases
#: the session — so a tab that closed in between would otherwise hold a slot and a socket that
#: bills per second for as long as the process lives.
UNCLAIMED_TIMEOUT = 30.0


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
        timezone: str = DEFAULT_TIMEZONE,
    ) -> None:
        self.id = session_id
        self._socket = socket
        self._executor = executor
        # The voice, the turn detector and the input audio options, or `{}` for a deployment that
        # configures none of them — see `voice_session_config` (spec 012).
        self._session_config = session_config or {}
        # Whose "today" the session states when it opens (spec 067) — the deployment's.
        self._timezone = timezone
        self._events: asyncio.Queue[AgentEvent | None] = asyncio.Queue()
        self._pump: asyncio.Task[None] | None = None
        self._closed = False
        self._claimed = False
        self._watchdog: asyncio.Task[None] | None = None
        # When to ask the agent to continue — see `_continue_if_ready`. Per response id: the calls
        # it made that are not answered yet, and the responses that have reached `response.done`.
        self._unanswered: dict[str, set[str]] = {}
        self._ended: dict[str, str] = {}
        self._tools: set[asyncio.Task[None]] = set()
        #: Voice Live's SDP answer, once `negotiate` has it.
        self.answer: str | None = None

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

        # The agent cannot tell that it is speaking — Voice Live transcribes before the model and
        # synthesizes after it, and asked directly the model says it is exchanging written text
        # (observed 2026-09-16). So the session states the one fact only it knows. This is session
        # context about the transport, not instructions and not an agent loop: see
        # `spoken_context_item` and constitution §8, amended for exactly this case.
        await self._socket.send(json.dumps(spoken_context_item()))
        # And the one fact the model cannot see on any channel: what day it is (spec 067). Once,
        # here — constitution §8's second bounded exception, beside the first.
        await self._socket.send(json.dumps(current_moment_frame(self._timezone)))

        try:
            async with asyncio.timeout(NEGOTIATION_TIMEOUT):
                while True:
                    frame = json.loads(await self._socket.recv())
                    if frame.get("type") == "rtc.call.sdp.created":
                        self._pump = asyncio.create_task(self._run())
                        self._watchdog = asyncio.create_task(self._close_if_unclaimed())
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
        self._claimed = True
        while True:
            event = await self._events.get()
            if event is None:
                return
            yield event

    @property
    def closed(self) -> bool:
        """Whether this session is over.

        Public because the router has to tell a session that is merely *idle* from one that is
        *finished*: a finished one must not keep a slot under `MAX_SESSIONS`, and nothing else can
        see the difference.
        """
        return self._closed

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._pump is not None:
            self._pump.cancel()
        if self._watchdog is not None and self._watchdog is not asyncio.current_task():
            self._watchdog.cancel()
        for tool in self._tools:
            tool.cancel()
        await self._socket.close()
        await self._events.put(None)

    async def _close_if_unclaimed(self) -> None:
        await asyncio.sleep(UNCLAIMED_TIMEOUT)
        if not self._claimed:
            _log.info("voice session %s: nobody opened its activity stream; closing", self.id)
            await self.close()

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
                    "message": client_message(exc, _log, "voice control channel failed"),
                    "code": "voice_channel_error",
                }
            )
            # The session is over: say so, or the sweep that frees dead sessions cannot see it and
            # this one keeps a slot — and the socket — until the process restarts.
            self._closed = True
            with contextlib.suppress(Exception):
                await self._socket.close()
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

        if frame.get("type") == "error":
            # The service refusing something we sent — a `response.create` it would not take, a
            # malformed item. Forwarded as an event below, but without this line the process log
            # is silent about exactly the failure that makes the agent stop talking.
            _log.warning("voice session %s: service error %s", self.id, frame.get("error"))

        for event in normalise_voice([frame]):
            await self._events.put(event)

        if is_function_call(frame):
            response_id = frame.get("response_id") or ""
            self._unanswered.setdefault(response_id, set()).add(frame["call_id"])
            # A task, so this loop keeps reading while the tool runs — the `response.done` that
            # decides when to continue arrives during it.
            tool = asyncio.create_task(
                self._answer(
                    frame["call_id"], frame["name"], frame.get("arguments") or "{}", response_id
                )
            )
            self._tools.add(tool)
            tool.add_done_callback(self._tools.discard)
        elif frame.get("type") == "response.done":
            response = frame.get("response") or {}
            response_id = response.get("id") or ""
            if response_id in self._unanswered:
                self._ended[response_id] = response.get("status") or ""
                await self._continue_if_ready(response_id)

    async def _continue_if_ready(self, response_id: str) -> None:
        """Ask for the next response, once: this one is over and every call it made is answered.

        `response.function_call_arguments.done` arrives before the `response.done` of the response
        that emitted it; in the preamble recording, before that response's audio is finished. A
        tool that returns in that window used to send `response.create` while the response was
        still active, and one per call when a response made two. Waiting for both conditions is
        the protocol's own boundary, not a decision (§8).

        A response that ended `cancelled` is not resumed: barge-in cancelled it, and the response
        the person's speech opens already sees the outputs — resuming would talk over them.
        """
        if response_id not in self._ended or self._unanswered.get(response_id):
            return
        status = self._ended.pop(response_id)
        del self._unanswered[response_id]
        if status != "cancelled":
            await self._socket.send(json.dumps({"type": "response.create"}))

    async def _answer(self, call_id: str, name: str, arguments: str, response_id: str = "") -> None:
        """Run the tool and hand the output back. Never raises: `execute` already can't.

        **In a worker thread.** `execute` is synchronous and `search_web` is an HTTP round trip to a
        third party; run inline it would hold this loop — which is also the one reading this socket
        — for the length of the call, silencing every other session in the process as well as this
        one. Asserted in `tests/test_concurrency.py`.
        """
        result = await asyncio.to_thread(self._executor, name, arguments)

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
        # Submitting the output is not enough — the agent resumes only when asked to, and only
        # once its response is over.
        self._unanswered.get(response_id, set()).discard(call_id)
        await self._continue_if_ready(response_id)
