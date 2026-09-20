# Tasks: The app on a narrow screen

Ordered TDD. Each implement task is preceded by the failing test that drives it.

- [x] **T1 — test**: at a narrow width a control exists for every screen in the route table, and
      driving it navigates (AC1, AC3).
- [x] **T2 — implement**: the menu control in the header, the open/closed boolean in `App`, and the
      rail rendered as an overlay.
- [x] **T3 — test**: the narrow block hides no interactive control (AC4), and declares the rules
      that stop the overflow (AC2).
- [x] **T4 — implement**: the narrow CSS block — overlay, backdrop, header budget, icon-only
      controls.
- [x] **T5 — test**: the harness badge is reachable at a narrow width (spec 004 AC9 still holds).
- [x] **T6 — implement**: the badge in the rail's footer.
- [x] **T7 — test**: the a11y walk, parameterised over widths (AC5).
- [x] **T8 — verify**: every existing suite untouched and green (AC6).
- [x] **T9 — sweep**: 320 · 390 · 760, both themes, recorded with its date in `spec.md` (AC8).
- [x] **T10 — i18n + docs**: the two strings; the breakpoint table in `docs/design-system.md`.
- [x] **T11 — spec**: status `planned → done`; index row; `CLAUDE.md` ↔ `AGENTS.md` (§6).

## Definition of done

- [x] Every acceptance criterion maps to a passing test, or is recorded as a measurement with its reason
- [x] Lint clean · Tests green · `verify-gates` green
