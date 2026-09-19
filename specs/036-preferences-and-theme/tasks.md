# Tasks: Preferences, and a second theme

## Phase 1 — one home for stored state (AC10)

- [x] **T1 — test**: no `localStorage` call and no `'fla.` literal outside `storage.ts`.
- [x] **T2 — implement**: the `KEYS` registry; move history, favourites and ui behind it.

## Phase 2 — the preference store (AC1, AC2, AC5, AC6, AC7, AC12)

- [x] **T3 — test**: defaults, persistence, `system` tracking the media query, storage failure.
- [x] **T4 — test**: the key the inline script reads is the one the module writes.
- [x] **T5 — implement**: `state/preferences.ts` and the `index.html` script.

## Phase 3 — the second palette (AC4, AC13, AC14)

- [x] **T6 — test**: every semantic token declared in base `:root`; series tokens redefined for
      dark; the hljs dark mapping names tokens.
- [x] **T7 — implement**: the dark mapping in `app.css`.
- [x] **T8 — verify**: render the app in both themes and look at it.

## Phase 4 — the panel (AC8, AC9, AC11)

- [x] **T9 — test**: it says the preferences are local, renders no deployment fact, and each
      control takes effect.
- [x] **T10 — implement**: `panes/Preferences.tsx`, the route, the rail link.

## Phase 5 — the record

- [x] **T11 — i18n**, **T12 — docs** (`docs/design-system.md`), **T13 — sync**, **T14 — refactor**.
- [x] **T15 — spec**: flip to `done`.

## Definition of done

- [ ] Every acceptance criterion maps to a passing test
- [ ] Lint clean · Tests green · `verify-gates` green
