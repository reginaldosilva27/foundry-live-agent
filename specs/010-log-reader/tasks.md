# Tasks: The trace panel groups its calls, and opens one in a reader

> Red → green → refactor.

## Tasks

- [x] **T1 — test**: `formatPayload` indents JSON and leaves everything else exactly as it was
      (AC3, AC4).
- [x] **T2 — implement**: `state/payload.ts`.
- [x] **T3 — test**: the reader shows the call's arguments and result, shows the error instead of a
      result when it failed, and closes on `Escape` (AC2, AC5, AC6).
- [x] **T4 — implement**: `components/LogViewer.tsx` + styles.
- [x] **T5 — test**: the trace panel renders one row per call and no payload text (AC1).
- [x] **T6 — implement**: `TraceDrawer` renders rows and opens the reader; `App` wires it (AC7).
- [x] **T7 — i18n**: the three keys in `en` + `pt` (§7).
- [x] **T8 — docs**: `docs/how-it-works/function-call-round-trip.md`, `CHANGELOG.md`,
      `specs/README.md`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] All new user-facing text exists in en **and** pt
- [x] `spec.md` status updated to `done`
