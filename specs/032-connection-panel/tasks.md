# Tasks: What this build is talking to

> The work, ordered, as a TDD checklist. Each implementation task is preceded by the
> test that should fail first (red → green → refactor). Check boxes as you go.

## Phase 1 — the address (AC10)

- [x] **T1 — test**: `/about` round-trips through `parseRoute` and `buildPath`, and is in `ROUTES`.
- [x] **T2 — implement**: the route.

## Phase 2 — the panel's states (AC5 · AC6)

- [x] **T3 — test**: loading and failed render differently, and neither renders as a configured
      deployment with everything off.
- [x] **T4 — implement**: `About.tsx` skeleton with the three states.
- [x] **T5 — test**: an optional field the config omits renders "not reported"; the same field sent
      as `false` renders "no". Compared **exactly** — "not reported" contains "no".
- [x] **T6 — implement**: the reported-vs-absent helper, and a test id per row so AC5 can name one.

## Phase 3 — the sections (AC1 · AC8)

- [x] **T7 — test**: every section renders with a deployment that has voice off, tracing off and no
      gateway — each line stated, none omitted.
- [x] **T8 — implement**: the five sections plus "what this build may change".
- [x] **T9 — test (drift)**: every key `backend/app/routers/config.py` sends is covered by the
      panel, failing by name on one that is not (AC1).
- [x] **T10 — implement**: `aboutFields.ts` and its declared coverage set.

## Phase 4 — the event contract (AC3 · AC4 · AC12)

- [x] **T11 — test**: the verified count, the total, and each unverified name rendered individually.
- [x] **T12 — test**: nothing unverified renders the "all verified" sentence and no empty list.
- [x] **T13 — test**: the note that says what unverified means renders, and the panel has no link.
- [x] **T14 — implement**: the event-contract section.

## Phase 5 — read-only, asserted (AC2 · AC11)

- [x] **T15 — test**: the panel renders no `button`/`input`/`select`/`textarea` and issues no
      `fetch` of its own.
- [x] **T16 — implement**: a guard — it passed on first run, which is the point of writing it.

## Phase 6 — the way in (AC7)

- [x] **T17 — test**: the rail's footer still renders model and gateway, and offers the link.
- [x] **T18 — implement**: the footer link; the two lines stay.
- [x] **T19 — test**: the app renders the panel at `/about` on load.
- [x] **T20 — implement**: the `App.tsx` branch.

## Phase 7 — the record

- [x] **T21 — i18n**: every key in `plan.md`, `en` + `pt` (AC9 is `strings.test.ts`).
- [x] **T22 — styles**: the panel.
- [x] **T23 — docs**: `docs/architecture.md` — the panel is the screen version of that page, and
      its address table, which had drifted since specs 027 and 030, is corrected.
- [x] **T24 — sync**: `CLAUDE.md` ↔ `AGENTS.md` (§6) — adding a `/config` field now has a rule.
- [x] **T25 — refactor**: `COVERED_CONFIG_KEYS` moved out of the component module.
- [x] **T26 — spec**: flip `spec.md` status to `done`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] `verify-gates` skill run and green
