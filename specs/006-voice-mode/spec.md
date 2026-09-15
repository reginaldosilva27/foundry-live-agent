# Spec: Voice mode — Voice Live attached to the same prompt agent

| | |
|---|---|
| **ID** | 006-voice-mode |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-15 |

## Problem / motivation

The repository's claim is that **the agent lives in Foundry and the app is built around it**. Text
chat demonstrates that once. Voice demonstrates it twice, and more convincingly: the *same* agent
version, the *same* two function tools, the *same* MCP server, reached through a completely
different transport — and the application does not gain a second brain to make it work.

There is a sharper version of the argument. During a voice conversation, Foundry still asks our
process to run `get_current_datetime`, and our process still looks the name up in a registry and
returns the answer. If voice needed its own tool implementations, its own agent loop, or its own
prompt, the separation this project argues for would be decorative. It does not:
`ai/harness/_shared/tools/` is imported unchanged, and that is the point the spec exists to prove.

The header has shipped a disabled **Voice** button since spec 004, with a tooltip saying voice
arrives with its own spec. This is that spec.

## Goals

- Speak to the agent and hear it answer, with audio flowing **browser ↔ Voice Live directly**.
- **No Azure credential ever reaches the browser.**
- A function tool called *during voice* is executed by the same backend code path as in text, and
  shows up in the same Agent activity panel.
- Barge-in: interrupting the agent mid-sentence stops it.
- The tool implementations, the agent definition and the activity UI are **reused, not duplicated**.

## Non-goals

- No avatar, no custom voice, no Live-Reference echo cancellation (they exist; they are not the
  lesson). **The "no custom voice" half is superseded by
  [spec 012](../012-voice-session-config/spec.md) (2026-09-15)**: the attachment was the lesson
  and it works, and an `en-US` voice reading Portuguese answers is not a demo anyone here wants
  to show.
- No voice-specific agent instructions. The agent is the agent; `instructions` is not supported
  alongside a custom agent anyway.
- No transcript persistence. Nothing in this release persists a conversation (see spec 004, M9).
- No push-to-talk mode. Server VAD is on by default and is what the demo should show.
- No trace data for voice turns — that is spec 005's surface, and it is noted there rather than
  half-built here.

## User-facing behavior

The **Voice** pill in the header becomes enabled. Pressing it asks for microphone permission and
opens a full-surface voice overlay: a dark card, animated level bars, the live transcript, an
elapsed timer, and `Mute` / `End session` controls. Speaking produces an answer in audio. Talking
over the agent stops it.

Behind the overlay, the Agent activity panel keeps working: a tool the agent calls during the
conversation appears as the same tool card the text chat renders, marked `executor: app`.

Every new string ships `{ en, pt }` (§7). A denied microphone permission, an unsupported browser and
a dropped session each say what happened and what to do, in both languages — a voice feature that
fails silently is worse than one that is absent.

## Acceptance criteria

1. **AC1** — `POST /voice/session` accepts the browser's SDP offer and returns an SDP answer plus a
   session id. The browser receives **no token, key, or Azure endpoint**.
2. **AC2** — The BFF attaches the session to the agent by **name**, using the same agent the text
   harness uses. The agent name and project are read from configuration, never hard-coded.
3. **AC3** — A `response.function_call_arguments.done` arriving on the control channel is executed
   through the **same `tool_executor`** the chat router uses, and its output is submitted back as a
   `conversation.item.create` / `function_call_output`. Proven against the recorded control-channel
   fixture, not a hand-written one.
4. **AC4** — A tool executed during voice is emitted as the **existing** `tool_call` and
   `tool_result` `AgentEvent`s, so the activity panel renders it with no voice-specific branch. The
   `AgentEvent` set does **not** change (§9).
5. **AC5** — An unanswered function call is impossible: every collected call is answered or the
   session ends with an `error` event. Same invariant as the text turn, same reason — Foundry waits.
6. **AC6** — `DELETE /voice/session/{id}` closes the control channel and releases the session;
   closing the browser tab does not leave a session open indefinitely.
7. **AC7** — The frontend opens the microphone, negotiates WebRTC, plays remote audio, and exposes
   mute. Asserted at the boundary (`getUserMedia`, `RTCPeerConnection` and the fetch are faked), not
   by needing a real microphone in CI.
8. **AC8** — Denied microphone permission, a browser without `RTCPeerConnection`, and a failed
   negotiation each render a distinct, translated message and leave the app usable.
9. **AC9** — Barge-in is **on**: the session is created with `turn_detection.interrupt_response`
   true, and the setting is asserted rather than assumed.
10. **AC10** — Every new user-facing string exists in `en` and `pt` (§7), and no prose is written
    directly into a component.
11. **AC11** — **No agent loop is added** (§8). No module under `backend/` or `frontend/` names a
    tool, chooses a tool, or re-prompts the model on the voice path. Enforced by the same import
    test that guards the chat path.
12. **AC12** — `backend/`, `ai/` and `frontend/` gates green.

## Contract / data impact

- **The `AgentEvent` set does not change.** This was the design question, and the answer is the
  reason the design works: the browser gets transcripts and voice-activity events *directly* from
  Voice Live over the WebRTC data channel, while **tool activity** comes to it over the existing
  `AgentEvent` stream. Neither needs a new event type. Had transcripts been routed through the BFF,
  §9 would have needed an amendment and this spec would have had to justify one.
- `backend/app/settings.py` gains the Voice Live endpoint and api-version. `.env.example` moves with
  it (§4).
- `docs/how-it-works/voice-live-lifecycle.md` stops being a stub.
- `docs/architecture.md` gains the voice path.
- New recorded fixtures under `ai/tests/fixtures/recorded/`.

## Open questions

All four were answered by observation on **2026-09-15** (`ai/scripts/spike_voice.py`), before this
spec was planned. Full findings in [`docs/REFERENCES.md`](../../docs/REFERENCES.md); the captures are
committed. They are recorded here because three of them **contradict the documentation**, and a
reader who trusts the docs over this file will build the wrong thing.

- [x] **O-2 — Does agent mode work over WebRTC?** → **Yes.** The control endpoint
      `/voice-live/realtime/calls` accepts an agent attachment, answers an SDP offer, and routes
      function calls to the control channel. The PLAN's §4.4 design stands; the WebSocket-relay
      fallback is not needed.
- [x] **O-6 — Which api-version?** → **Two different ones, one per endpoint.** The WebRTC control
      endpoint exists **only** on `2026-01-01-preview` (404 on `2026-04-10` and `2026-07-15`, 401 on
      `2026-06-01-preview`). The plain WebSocket endpoint works on all four. Pinning one version for
      "Voice Live" would have broken one of the two paths.
- [x] **O-5 — Region?** → eastus2 serves Voice Live for this resource.
- [x] **Agent attachment parameters** → **The documented names are wrong.** The quickstart says
      `agent_name` + `project_name`; the service answers *"Missing required agent project name"* and
      requires `agent_name` + **`agent_project_name`**. The older `agent_id` + `project_id` pair is
      rejected outright: *"Classic foundry agent is not supported in API version 2026-04-10 and
      above."*
- [x] **Does a function call really reach the control channel?** → **Yes, and in better shape than
      in text.** `response.function_call_arguments.done` carries **both `name` and `call_id`** in a
      voice session, where the Responses API sends `name: null` and forces a read of the completed
      output item. The round trip was completed end to end against the live service using the
      project's own registry.
- [x] **Does the contract need a new event?** → **No.** See *Contract / data impact*.

## Out of scope / deferred

- Traces for voice turns → spec 005.
- Avatar, custom voices, Live-Reference AEC → Phase 4. Named in the docs as available, not built.
- Voice against the LangGraph harness → the `voice_attachment_params()` seam already exists on the
  Protocol; the scaffold still raises.
