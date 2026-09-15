# Tasks: Spoken answers in the text chat

> Red → green → refactor.

## Tasks

- [x] **T1 — test**: `POST /speech` answers with audio built from the requested language's voice,
      and an unconfigured BFF refuses with `503` and reports `speech.enabled: false` (AC8, AC9).
- [x] **T2 — implement**: settings, `app/speech.py`, `app/routers/speech.py`, `/config`, injection.
- [x] **T3 — test**: `nextSentences` cuts a growing buffer once per sentence, in order; `flatten`
      strips markdown syntax (AC2, AC7).
- [x] **T4 — implement**: `frontend/src/state/speech.ts`.
- [x] **T5 — test**: the player synthesises and plays in order, and `stop()` clears both what is
      playing and what is queued (AC2, AC3).
- [x] **T6 — implement**: `frontend/src/speech/player.ts`.
- [x] **T7 — test**: off is silent; the choice holds across turns; an error turn is not read; the
      turn survives stopping (AC1, AC4, AC5, AC6).
- [x] **T8 — implement**: `useSpokenAnswers`, the header toggle, the wiring in `App`.
- [x] **T9 — i18n**: the three strings in `en` + `pt` (§7).
- [x] **T10 — docs**: `.env.example`, both READMEs, `docs/REFERENCES.md`, `CHANGELOG.md`,
      `specs/README.md`. `docs/architecture.md` is still the stub earlier specs left it as.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] All new user-facing text exists in en **and** pt
- [x] `spec.md` status updated to `done`
