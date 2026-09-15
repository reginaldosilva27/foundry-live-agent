# Tasks: The tool call stays in the chat; its payload moves to the trace panel

> Red → green → refactor.

## Tasks

- [x] **T1 — test**: the compact row shows name, executor tag and status, and shows neither the
      arguments nor the result; a failed call reads as failed (AC1, AC2, AC5).
- [x] **T2 — implement**: `components/ToolRow.tsx` + its styles.
- [x] **T3 — test**: the trace panel lists the turn's calls with arguments, result and error, and
      says so when there were none (AC3, AC5, AC6).
- [x] **T4 — implement**: the activity section in `TraceDrawer`.
- [x] **T5 — test**: pressing a row in the chat opens the panel on that call (AC4).
- [x] **T6 — implement**: the selection through `ActivityPanel` → `Conversation` → `App`.
- [x] **T7 — i18n**: the two new keys in `en` + `pt` (§7).
- [x] **T8 — docs**: both READMEs, `docs/how-it-works/function-call-round-trip.md`, `CHANGELOG.md`,
      `specs/README.md`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] All new user-facing text exists in en **and** pt
- [x] `spec.md` status updated to `done`
