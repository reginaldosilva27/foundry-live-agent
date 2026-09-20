# Tasks: The contrast nobody guarded

Ordered TDD. Each implement task is preceded by the failing test that drives it.

- [x] **T1 — test**: white on `--bg-accent-strong` meets 4.5:1 in both themes (AC2). Fails: the
      token does not exist.
- [x] **T2 — implement**: declare `--bg-accent-strong` on `:root` in `app.css`.
- [x] **T3 — test**: every selector wearing `var(--fg-4)` names a disabled or placeholder state
      (AC3). Fails with 59 offenders, which is the spec in one assertion.
- [x] **T4 — implement**: move those 59 to `--fg-3`.
- [x] **T5 — test**: `--fg-3` ≠ `--fg-4`, and `--fg-1`/`--fg-2`/`--fg-3` are distinct on every
      surface in both themes (AC5, AC6).
- [x] **T6 — implement**: the ~9 text-bearing accent fills take `--bg-accent-strong`.
- [x] **T7 — verify**: the full `PAIRS` suite still green, both themes (AC4); the no-literal rule
      still green (AC7).
- [x] **T8 — sweep**: walk the rendered page in a browser, both themes, and record the result with
      its date in `spec.md` (AC8). Not a CI test — clarify Q4.
- [x] **T9 — docs**: `docs/design-system.md` gains what this repo adds on top of what it imported.
- [x] **T10 — spec**: status `planned → done`; index row in `specs/README.md`.

## Definition of done

- [x] Every acceptance criterion maps to a passing test, or is recorded as a measurement with its reason
- [x] Lint clean · Tests green · `verify-gates` green
