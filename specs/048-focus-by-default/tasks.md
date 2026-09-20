# Tasks: A focus ring by default

- [x] **T1 — test**: a universal `:focus-visible` rule draws an outline, and only the named
      exceptions remove one (AC1, AC2).
- [x] **T2 — implement**: `--fg-focus`, the universal rule, the exception list.
- [x] **T3 — test**: the deep surfaces redeclare the token; no per-selector colour list survives (AC3).
- [x] **T4 — implement**: the two surface rules; delete the sixteen-selector list.
- [x] **T5 — test**: the ring meets 3:1 on every surface, both themes (AC5).
- [x] **T6 — verify**: the existing suites untouched (AC4, AC6).
- [x] **T7 — sweep**: tab through in a browser, both themes; record with its date (AC7).
- [x] **T8 — docs**: the focus rule in `docs/design-system.md`; index; `CLAUDE.md` ↔ `AGENTS.md` (§6).

## Definition of done

- [x] Every acceptance criterion maps to a passing test, or is recorded as a measurement with its reason
- [x] Lint clean · Tests green · `verify-gates` green
