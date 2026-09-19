# Plan: Choosing the voice on the screen

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

`VOICELIVE_VOICES` declares the list; `GET /config` carries it with the default first;
`POST /voice/session` takes an optional `voice` and **refuses** anything outside the list. The
chooser renders only when two or more are offered, which is what keeps every un-opted-in deployment
on spec 012's behaviour exactly.

The choice is stored with spec 036's preferences rather than in a key of its own (§4), and read at
**start** — a running session was negotiated with the voice it has.

**Declared, not discovered.** Reading a supported list from the service is a §10 question and no
doc has been read for it. A declared list needs no verification and cannot go stale against a
service we never asked.

## Affected files

- `backend/app/settings.py` — `voicelive_voices`, `offered_voices`, `session_config_for`.
- `backend/app/routers/voice.py` — the optional `voice`, refused when unoffered.
- `backend/app/routers/config.py` — the list and the default.
- `frontend/src/components/VoicePicker.tsx` + test; `voice/session.ts`; `hooks/useVoiceSession.ts`;
  `panes/Composer.tsx`; `state/preferences.ts`; `config.ts`; `App.tsx`.
- `.env.example`, `docs/how-it-works/voice-live-lifecycle.md`.

## Test strategy (§2 — TDD)

| AC | Test |
|---|---|
| AC1/AC4 | the chooser offers the list, default first, preselecting the stored choice |
| AC2 | one declared voice renders no chooser |
| AC3 | the chosen voice reaches the session configuration |
| AC5 | the choice is read at start, not applied to a running session |
| AC6 | the BFF refuses an unoffered voice with `voice_not_offered` |
| AC7 | no `instructions` and no extra context item in the session configuration |
| AC8 | turn detection is identical whether a voice was chosen or not |
| AC9 | the screen states the choice is local |
| AC10 | both languages; identifiers untranslated |
