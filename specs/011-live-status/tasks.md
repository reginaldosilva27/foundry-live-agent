# Tasks: The turn says what is happening right now

> Red → green → refactor.

## Tasks

- [x] **T1 — test**: `turnStatus` returns idle, thinking, calling (with the name), back to thinking
      after the result, and nothing once text arrives or the turn settles (AC1-AC6).
- [x] **T2 — implement**: `turnStatus` in `state/turn.ts`.
- [x] **T3 — test**: the conversation renders the line and drops it when the answer starts (AC3, AC5).
- [x] **T4 — implement**: the line in `Conversation.tsx`, replacing the local `pending()` predicate.
- [x] **T5 — i18n**: the two keys in `en` + `pt` (§7).
- [x] **T6 — docs**: `CHANGELOG.md`, `specs/README.md`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] All new user-facing text exists in en **and** pt
- [x] `spec.md` status updated to `done`
