# Spec: The voice session is configured — voice, turn detection, input audio

| | |
|---|---|
| **ID** | 012-voice-session-config |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-15 |

## Problem / motivation

A voice session today is negotiated and then left entirely to service defaults. The app sends the
SDP offer, answers function calls, and asks for responses — and never configures the session. The
consequences are audible:

- The agent **answers** in the user's language, because the agent's instructions say so — but an
  `en-US` voice reads the Portuguese words. For a project whose audience is Brazilian, the single
  most noticeable thing about voice mode is wrong.
- Turn detection runs on the default `server_vad`. The documented barge-in control,
  `interrupt_response`, exists **only** with `azure_semantic_vad` — so spec 006 listed barge-in as
  a goal while the setting that governs it was never selected.
- Noise suppression is off, and the input transcription gets no language hint.

Spec 006 declared a custom voice a non-goal, on the grounds that the lesson was the *attachment*,
not the audio. That was right then and is wrong now: the attachment works, and what is left is a
demo nobody in Brazil wants to show.

## Goals

- The agent speaks with a configured voice, in an accent that matches the language it answers in.
- Turn detection uses the semantic detector, so barge-in is the documented behaviour rather than an
  accident of the default.
- Input audio gets noise suppression, and optionally a language hint for transcription.
- All of it is **configuration**, with defaults that suit this project and a documented way to
  change them.

## Non-goals

- No avatar, no viseme output, no audio timestamps, no Live-Reference AEC — they exist, they are
  not the lesson, and each needs a newer api-version or a different client.
- No custom (trained) voice — `azure-custom` is out of scope; `azure-standard` covers this.
- No per-session choice in the UI. One configured voice per deployment.
- No `instructions`: the doc is explicit that it is **not supported with a custom agent**, and
  sending it would be asking the service to override the agent this project exists to showcase.

## Clarified decisions (2026-09-15)

- **The configuration travels on the SDP frame, not as a separate `session.update`.** The WebRTC
  doc shows the `session` object carried inside `rtc.call.sdp.create`. That costs no extra round
  trip and leaves no window in which the session runs with the wrong voice. (`session.update` stays
  available after negotiation and is what a future "change the voice mid-call" would use.)
- **A multilingual voice by default** (`pt-BR-ThalitaMultilingualNeural`) rather than a locale-locked
  one: this app ships in two languages (§7), and a multilingual voice reads both.
  **Revised 2026-09-15 after listening to it**: that is the *standard* neural tier and it sounds
  robotic in Portuguese. The default is now `pt-BR-Luana:MAI-Voice-2-Flash`, which the
  documentation calls optimized for real-time responsiveness in Voice Live. The trade is real and
  recorded: the multilingual voice is the one documented to read both languages natively, and it is
  one environment variable away.
- **`azure-standard` is the voice type.** `azure-realtime-native` names are for the `azure-realtime`
  model; this session attaches to an agent on a normal deployment.
- **No input language by default.** Pinning `pt` would make the English half of the app worse;
  the variable exists for a deployment that wants one language only.

## User-facing behavior

Nothing changes on screen. Spoken answers come back in the configured voice; interrupting the agent
mid-sentence works because the semantic detector is selected; background noise is suppressed. Three
new environment variables, documented in `.env.example`, with defaults that work unset.

## Acceptance criteria

1. **AC1** — Given a configured voice, when a session is negotiated, then the SDP frame carries a
   `session.voice` naming it, with type `azure-standard`.
2. **AC2** — Given the default configuration, when a session is negotiated, then the frame's
   `turn_detection.type` is the semantic detector, not `server_vad`.
3. **AC3** — Given the default configuration, when a session is negotiated, then the frame requests
   noise suppression.
4. **AC4** — Given an input language is configured, when a session is negotiated, then the frame
   carries it on the transcription options; given none, then no language field is sent at all.
5. **AC5** — Given any configuration, when a session is negotiated, then the frame carries **no**
   `instructions` field.
6. **AC6** — Given every voice variable is blank, when a session is negotiated, then the frame is
   exactly what it is today — `type` and `sdp_offer` and nothing else — so an operator can opt out.
7. **AC7** — Given the recorded control-channel frames, when they are replayed, then the session
   still negotiates, answers its function call and reports usage, unchanged.

## Contract / data impact

No `AgentEvent` change. The single source of truth for the new settings is
`backend/app/settings.py`, and `.env.example` and both READMEs' environment notes move with it (§4).
The frame shape is recorded in `docs/REFERENCES.md` with the doc it came from (§10).

**This supersedes one non-goal of [spec 006](../006-voice-mode/spec.md)** — "no custom voice" — and
that spec is annotated to say so.

## Open questions (clarify before planning)

None — resolved above on 2026-09-15.

## Out of scope / deferred

- Changing the voice during a session (`session.update` after negotiation).
- Exposing the voice in `GET /config` so the UI can name it.
- Verifying on a live session which of the two Portuguese voice families sounds better; that is a
  listening test, not a code change.
