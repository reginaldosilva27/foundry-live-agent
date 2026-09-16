"""Voice Live control-channel frames -> `AgentEvent`, and how a session attaches to an agent.

Shared rather than harness-specific on purpose: a Voice Live session attaches to an agent **by
name**, so this maps just as well to a hosted agent as to the prompt agent. What is harness-specific
— which agent, which project — arrives through `HarnessAdapter.voice_attachment_params()`.

Everything here was observed on **2026-09-15** against the live service and recorded in
`tests/fixtures/recorded/voice-live-*.jsonl` (§10). Three observations shaped it:

1. **The documented attachment parameters are wrong.** The quickstart says `agent_name` +
   `project_name`; the service answers *"Missing required agent project name"* and wants
   `agent_name` + **`agent_project_name`**. The older `agent_id` + `project_id` pair is rejected:
   *"Classic foundry agent is not supported in API version 2026-04-10 and above."*
2. **A function call arrives complete.** `response.function_call_arguments.done` carries `name`,
   `call_id` and `arguments` together — unlike the Responses API, where `name` is `null` and the
   completed output item is the only full record.
3. **The spoken answer does not come through here.** Audio and its transcript go straight to the
   browser over WebRTC. Re-emitting them would duplicate state and put the BFF in the latency path
   of something the user is already hearing, so `response.text.*` and `response.audio_transcript.*`
   are deliberately mapped to nothing.

The contract does not grow for voice. Everything a voice session produces that the app needs to show
is already one of the nine events (§9).
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator, Mapping
from typing import Any

from harness._shared.contract import AgentEvent

__all__ = [
    "FUNCTION_CALL_FRAME",
    "attachment_query",
    "is_function_call",
    "normalise_voice",
    "spoken_context_item",
    "tool_output_frame",
    "unmapped_voice_types",
    "voice_session_config",
]

FUNCTION_CALL_FRAME = "response.function_call_arguments.done"

# Frames that are real and carry nothing the contract needs. Listed rather than ignored by default,
# so a frame type the service *starts* sending shows up in `unmapped_voice_types` instead of
# vanishing.
_IGNORED: frozenset[str] = frozenset(
    {
        "session.created",
        "session.updated",
        "rtc.call.sdp.created",
        "conversation.item.created",
        "response.created",
        "response.output_item.added",
        "response.output_item.done",
        "response.content_part.added",
        "response.content_part.done",
        "response.function_call_arguments.delta",
        # The answer itself: heard, not re-streamed. See the module docstring.
        "response.text.delta",
        "response.text.done",
        "response.audio_transcript.delta",
        "response.audio_transcript.done",
        "response.audio.delta",
        "response.audio.done",
        # Turn detection: the browser gets these on the data channel.
        "input_audio_buffer.speech_started",
        "input_audio_buffer.speech_stopped",
        "input_audio_buffer.committed",
        "conversation.item.input_audio_transcription.completed",
    }
)

_MCP_LIFECYCLE: frozenset[str] = frozenset(
    {"mcp_list_tools.in_progress", "mcp_list_tools.completed"}
)


def attachment_query(*, agent: str, project: str, version: str | None = None) -> dict[str, str]:
    """The query parameters that attach a Voice Live session to a Foundry agent.

    A function rather than a format string because the parameter names are the part that is easy to
    get wrong — they disagree with the published quickstart, and the failure message
    (*"Missing required agent project name"*) points at a missing value rather than a wrong key.
    """
    query = {"agent_name": agent, "agent_project_name": project}
    if version:
        query["agent_version"] = version
    return query


def voice_session_config(
    *, voice: str = "", vad: str = "", input_language: str = ""
) -> dict[str, Any]:
    """The `session` object that configures a Voice Live session.

    It travels **inside** `rtc.call.sdp.create`, alongside `sdp_offer` — the WebRTC doc shows it
    there, and sending it with the offer costs no round trip and leaves no window in which the
    session runs with the wrong voice. (The control channel stays open afterwards, so a later
    `session.update` is how a voice would be changed mid-call.)

    Two rules, both deliberate:

    - **Everything blank produces `{}`**, and the caller then sends the frame exactly as this app
      sent it before this existed. Configuration that cannot be turned off is a trap.
    - **`instructions` is never included.** The documentation is explicit that it is unsupported
      with a custom agent, and it is the one field whose accidental presence would quietly replace
      the agent this repository exists to demonstrate.

    Shapes from the two docs recorded in `docs/REFERENCES.md`, read 2026-09-15.
    """
    config: dict[str, Any] = {}

    if voice:
        # `azure-standard` covers both the neural voices and the HD ones
        # (`pt-BR-Thalita:DragonHDLatestNeural`). `azure-realtime-native` names belong to the
        # `azure-realtime` model, which is not what an agent attachment runs on.
        config["voice"] = {"name": voice, "type": "azure-standard"}

    if vad:
        # `interrupt_response` — barge-in — exists only on the azure semantic detectors. On the
        # default `server_vad` there is nothing to set, which is why spec 006's barge-in goal was
        # never actually configured.
        config["turn_detection"] = {
            "type": vad,
            "interrupt_response": True,
            "remove_filler_words": True,
        }

    if config:
        # **The field that decides whether the agent speaks at all.** Observed in the committed
        # fixtures: one recorded session reports `"modalities": ["text"]` and another
        # `["audio", "text"]`. The service picks, and a text-only session produces a transcript and
        # no sound — with nothing on screen to explain the silence. So it is stated, not hoped for.
        config["modalities"] = ["audio", "text"]
        config["input_audio_noise_reduction"] = {"type": "azure_deep_noise_suppression"}

    if input_language:
        config["input_audio_transcription"] = {"model": "azure-speech", "language": input_language}

    return config


SPOKEN_CONTEXT = (
    "This conversation is spoken: the person is listening to you, not reading. "
    "Never say a URL, a web address or a list of sources out loud — give the answer and stop. "
    "If they ask where it came from, name the source in a few words, without the address."
)


def spoken_context_item() -> dict[str, Any]:
    """The one thing a Voice Live session must tell the agent, because the agent cannot see it.

    **The model does not know it is being spoken to.** Observed 2026-09-16 with real audio in and
    real audio out, asked in as many words: *"Estou trocando texto escrito com você."* Voice Live
    transcribes before the model and synthesizes after it, so nothing in the model's input says
    "you are being listened to" — and an instruction conditioned on the modality is therefore
    conditioned on nothing. The agent definition cannot fix this; only the session can say it.

    Why this does not put an agent loop in the BFF (constitution §8, amended 2026-09-16): it is one
    static sentence about the **transport**, sent once when the session opens. It names no tool,
    makes no plan, reads nothing the model said, and would be equally true of any harness attached
    to Voice Live — which is §8's own "would this still be true if the harness were swapped?" test.
    `instructions`, the documented field for this, is unsupported with a custom agent.

    Verified accepted on the live service the same day: with it, the spoken answer to a
    `search_web` question ends at the answer; without it, it reads the URL slash by slash.
    """
    return {
        "type": "conversation.item.create",
        "item": {
            "type": "message",
            "role": "system",
            "content": [{"type": "input_text", "text": SPOKEN_CONTEXT}],
        },
    }


def is_function_call(frame: Mapping[str, Any]) -> bool:
    """Is this the frame that asks us to run a tool and then waits?"""
    return frame.get("type") == FUNCTION_CALL_FRAME


def tool_output_frame(call_id: str, output: str) -> dict[str, Any]:
    """The frame that answers a function call.

    Not answering is the failure that matters: Voice Live, like the Responses API, waits. In a
    spoken conversation the symptom is worse — the agent simply stops talking mid-turn.
    """
    return {
        "type": "conversation.item.create",
        "item": {"type": "function_call_output", "call_id": call_id, "output": output},
    }


def normalise_voice(frames: Iterable[Mapping[str, Any]]) -> Iterator[AgentEvent]:
    """Convert control-channel frames into contract events."""
    for frame in frames:
        yield from _convert(frame)


def _convert(frame: Mapping[str, Any]) -> Iterator[AgentEvent]:
    ftype = frame.get("type", "")

    if ftype == FUNCTION_CALL_FRAME:
        # executor="app": the agent asked, and this process answers. Identical to the text path,
        # which is the whole argument — one tool implementation, two modalities.
        yield {
            "type": "tool_call",
            "call_id": frame["call_id"],
            "name": frame["name"],
            "arguments": frame.get("arguments") or "{}",
            "executor": "app",
        }
        return

    if ftype == "response.mcp_call.completed":
        item = frame.get("item") or {}
        event: dict[str, Any] = {
            "type": "mcp_call",
            "server_label": item.get("server_label") or "unknown",
            "name": item.get("name") or "unknown",
            "arguments": item.get("arguments") or "{}",
        }
        if (output := item.get("output")) is not None:
            event["output"] = output
        yield event  # type: ignore[misc]
        return

    if ftype == "error":
        detail = frame.get("error") or {}
        error: dict[str, Any] = {
            "type": "error",
            "message": str(detail.get("message") or "the voice session failed"),
        }
        if code := detail.get("code"):
            error["code"] = str(code)
        yield error  # type: ignore[misc]
        return

    if ftype == "response.done":
        response = frame.get("response") or {}
        if (usage := response.get("usage")) is not None:
            yield {
                "type": "usage",
                "input_tokens": int(usage.get("input_tokens", 0)),
                "output_tokens": int(usage.get("output_tokens", 0)),
            }
        return


def unmapped_voice_types(frames: Iterable[Mapping[str, Any]]) -> dict[str, int]:
    """Count control-channel frame types this module knows nothing about."""
    known = _IGNORED | _MCP_LIFECYCLE | {FUNCTION_CALL_FRAME, "response.mcp_call.completed"}
    known = known | {"error", "response.done"}

    counts: dict[str, int] = {}
    for frame in frames:
        ftype = frame.get("type", "")
        if ftype not in known:
            counts[ftype] = counts.get(ftype, 0) + 1
    return counts
