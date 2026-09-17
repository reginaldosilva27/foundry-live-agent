# Tasks: The keyboard — shortcuts and a command palette

> Red → green → refactor. Each implementation task is preceded by the test that fails first.

## The binding table

- [x] **T1 — test**: the table names a command for each binding, and none uses a browser-reserved
      chord (plan)
- [x] **T2 — test**: the focus predicate reports `input`, `textarea` and `contenteditable` as fields
      and a `button` as not (AC2)
- [x] **T3 — implement**: `state/keys.ts`
- [x] **T4 — test**: no key literal lives outside `state/keys.ts` (plan, source scan)
- [x] **T5 — implement**: whatever T4 shows is needed

## The handler

- [x] **T6 — test**: each binding runs its command when the app has focus (AC1)
- [x] **T7 — implement**: `hooks/useKeys.ts`
- [x] **T8 — test**: no binding except the field-scoped ones fires while a field is focused (AC2)
- [x] **T9 — implement**: the guard

## The palette's contents

- [x] **T10 — test**: entries are built from agents, conversations and actions, grouped (AC5)
- [x] **T11 — test**: filtering folds case and accents (plan)
- [x] **T12 — test**: an unselectable agent keeps its reason and is not runnable (AC8)
- [x] **T13 — implement**: `state/palette.ts`

## The palette

- [x] **T14 — test**: opens by key and by control; Escape closes and restores focus (AC4, AC9)
- [x] **T15 — implement**: `panes/CommandPalette.tsx` using `useModalFocus`
- [x] **T16 — test**: arrows move over runnable entries only; Enter runs (AC5, AC8)
- [x] **T17 — implement**: the keyboard navigation
- [x] **T18 — test**: voice renders unavailable when the deployment has none (AC8)
- [x] **T19 — implement**: whatever T18 shows is needed

## Wiring

- [x] **T20 — test**: choosing an agent selects it and starts a new conversation, from either view (AC6)
- [x] **T21 — test**: choosing a conversation restores it exactly as the rail does (AC7)
- [x] **T22 — test**: every command is also reachable by an on-screen control (AC3)
- [x] **T23 — implement**: `App` wiring, the composer ref, the rail's palette control

## Cross-cutting

- [x] **T24 — i18n**: the strings in `en` + `pt` (AC10)
- [x] **T25 — styles**: the palette
- [x] **T26 — docs**: `docs/design-system.md` — the bindings and the focus behaviour

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean · tests green · build passes
- [x] Docs updated in the same change (§4)
- [x] All new user-facing text exists in `en` **and** `pt` (§7)
- [x] `spec.md` status updated to `done`
