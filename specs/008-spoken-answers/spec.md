# Spec: Spoken answers in the text chat

| | |
|---|---|
| **ID** | 008-spoken-answers |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-15 |

## Problem / motivation

Today the app has two modalities and no way between them: you either type and read, or you talk and
listen. Reading is what you want for code, identifiers and long answers; hearing is what you want
when your hands or eyes are busy. A user who types a question has no way to ask for the answer out
loud without abandoning the chat and opening a full voice session — which starts a *different*
conversation, on a different transport.

The gap is narrow and the payoff is concrete: an option that speaks the agent's answer while the
chat keeps rendering it as text.

## Goals

- An option in the chat that makes agent answers spoken as well as written.
- The option is remembered for the session and is obviously on or off.
- Nothing about the text turn changes when it is off — same stream, same rendering, same latency.
- Speech never becomes a second source of truth: what is spoken is what is written.

## Non-goals

- No dictation (speaking a question into the composer). That is a separate ask and a separate spec.
- No voice selection, no speed control, no SSML.
- No change to voice mode: this does not open a Voice Live session, and voice mode is unaffected.
- No audio persistence and no download.

## User-facing behavior

A control in the chat toggles spoken answers. With it on, each agent answer is read aloud as it
settles, and the turn shows that it is speaking with a way to stop. With it off, nothing is spoken
and nothing sounds. All new prose ships `en` + `pt` (§7), and the spoken language follows the
reader's language setting.

## Clarified decisions (2026-09-15)

- **Azure Speech through the BFF**, not the browser's `speechSynthesis`: the same neural voice on
  every machine, and no Azure credential in the browser. The cost is accepted — an endpoint, a
  credential path, a configuration value, and the §10 obligation to cite the doc.
- **Sentence by sentence, while the answer streams.** Speech starts as soon as the first sentence
  closes rather than after the whole turn, and the sentences queue so they are heard in order.
- **The toggle lives in the header**, beside Voice: it is a modality choice, and that is where the
  other one is.
- **The answer is spoken; the activity is not.** No narration of tool calls — the voice reads what
  a reader would read.
- **Markdown is flattened before synthesis.** Code fences, emphasis markers and link syntax are
  reading instructions, not words, and a voice that pronounces them is worse than no voice.
- **The voice follows the reader's language**, using the two voices recorded in the plan.

## Acceptance criteria

1. **AC1** — Given spoken answers are off, when a turn streams and completes, then nothing is
   synthesised and nothing is played.
2. **AC2** — Given spoken answers are on, when an answer streams in, then each of its sentences is
   synthesised exactly once, and they are played in the order they were written.
3. **AC3** — Given an answer is still being spoken, when the user sends another message, then what
   is playing stops and what is queued is discarded before the new turn begins.
4. **AC4** — Given an answer is being spoken, when the user stops it, then playback ends, the queue
   empties, and the turn stays on screen unchanged.
5. **AC5** — Given the toggle is changed, when further turns happen in the same session, then the
   choice still holds.
6. **AC6** — Given a turn that ended in an error, when spoken answers are on, then the error is not
   read aloud as if it were an answer.
7. **AC7** — Given an answer containing markdown, when it is synthesised, then the syntax is not
   sent to the voice — a fenced code block is not read out as backticks.
8. **AC8** — Given the BFF is configured for speech, when it is asked to synthesise a piece of text
   in a language, then it answers with audio produced with that language's voice.
9. **AC9** — Given the BFF has **no** speech configuration, when the app loads, then the toggle is
   not offered, and a direct request to synthesise is refused with a reason rather than with
   broken audio.

## Contract / data impact

No change to `ai/harness/_shared/contract.py`: speech is a property of the app, not of the agent,
and no `AgentEvent` grows for it.

A new BFF endpoint and new configuration values. Their single source of truth is
`backend/app/settings.py`, and these must move with it in the same change: `.env.example`,
`GET /config` (so the frontend can tell whether to offer the toggle), the frontend's `BffConfig`
type, `docs/REFERENCES.md` (the Speech endpoint, its auth shape and the voice names, each with the
URL it was read from — §10), and both READMEs' environment tables.

## Open questions (clarify before planning)

None — all resolved above on 2026-09-15. One thing is **verified-by-configuration rather than
assumed**: whether the reference project's Foundry resource answers text-to-speech on its own host.
The endpoint is a configuration value, not a derivation, and the plan says why (§5, §10).

## Out of scope / deferred

- Dictation into the composer.
- Per-turn "speak this one" without a global toggle.
- Word-level highlighting of what is being read.
- Caching synthesised audio. Every sentence is synthesised on demand, once.
