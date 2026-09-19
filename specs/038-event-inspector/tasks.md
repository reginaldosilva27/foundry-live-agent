# Tasks: The event inspector

- [x] **T1 — test**: a turn retains its raw events whether or not anything is watching, keeps them
      after an error or a stop, and reports the cap (AC7, AC8, AC11, AC12).
- [x] **T2 — implement**: retention in `useAgentStream`.
- [x] **T3 — test**: summaries, and deltas collapsed into runs with accumulated text (AC1, AC2).
- [x] **T4 — implement**: `state/events.ts`.
- [x] **T5 — test**: the panel renders runs, the full JSON, the filter from config and the mapping
      report; issues no request (AC3–AC6).
- [x] **T6 — implement**: `components/EventInspector.tsx`.
- [x] **T7 — implement**: the toggle, closed by default, from the palette and the keyboard (AC9).
- [x] **T8 — i18n**, **T9 — styles**, **T10 — docs/sync**, **T11 — spec** flip to `done`.

## Definition of done

- [ ] Every acceptance criterion maps to a passing test
- [ ] Lint clean · Tests green · `verify-gates` green
