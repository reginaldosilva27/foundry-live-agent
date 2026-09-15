# Tasks: The trace panel becomes an instrument

> Ordered TDD checklist for [`spec.md`](spec.md) / [`plan.md`](plan.md).
> Each implementation task is preceded by the test that must fail first.

## Tasks

### Strings first — everything below renders them

- [ ] **T1 — i18n**: add the twelve keys from the plan in `en` + `pt`; add the two reserved id
      labels to `INTENTIONALLY_IDENTICAL`. `strings.test.ts` is generic and covers **AC11**; it
      must stay green from here on.

### The copy row (AC1)

- [ ] **T2 — test first**: `components/CopyRow.test.tsx` — pressing the row writes the value to the
      clipboard and the row reports it; a clipboard that rejects reports failure; a clipboard that
      is absent does not throw.
- [ ] **T3 — implement**: `components/CopyRow.tsx`.

### The numbers (AC2, AC3)

- [ ] **T4 — test first**: `components/TraceNumbers.test.tsx` — renders model, total tokens,
      reasoning tokens and latency; omits each one that is absent, and renders no `0`.
- [ ] **T5 — implement**: `components/TraceNumbers.tsx`.

### The calls become a grid, with bars (AC6, AC7, AC9, AC12)

- [ ] **T6 — test first**: extend `components/ToolRow.test.tsx` — a call whose duration is the
      longest in its turn gets a full-width bar; a shorter one gets a proportional bar; an MCP call
      gets no bar and carries the reason as text.
- [ ] **T7 — implement**: `ToolRow` takes an optional ratio and renders the bar from it;
      `ActivityPanel` and `TraceDrawer` compute the turn's longest duration once and pass it.
- [ ] **T8 — test first**: extend `styles/layout.test.ts` — the row declares fixed grid columns.
- [ ] **T9 — implement**: the grid in `styles/app.css`; verify the chat and the voice overlay still
      render correctly, since all three surfaces share this component (§4).

### The panel's head: turn identity and navigation (AC4, AC5, AC8)

- [ ] **T10 — test first**: extend `panes/TraceDrawer.test.tsx` — the panel states its position;
      the arrows call the callbacks; first/last disables the matching arrow; the two reserved ids
      render as pending when absent and as copyable ids when present; the numbers row appears.
- [ ] **T11 — implement**: `TraceDrawer` head, ids as `CopyRow`s, numbers row, `Spans` heading
      replaced by the footer line.
- [ ] **T12 — implement**: `App.tsx` derives index/count and passes `model`, `latencyMs` and the
      two navigation callbacks. Confirm a turn streaming in the background does not move a panel
      parked on an older turn.

### Focus and finish (AC10)

- [ ] **T13 — test first**: extend the focus-ring list in `styles/layout.test.ts` with the copy row
      and the turn arrows.
- [ ] **T14 — implement**: add them to the `:focus-visible` rule.
- [ ] **T15 — docs (§4)**: `docs/how-it-works/tracing-and-gateway.md` gains the line that the panel
      names the two reserved ids as pending; `CHANGELOG.md` entry; screenshot in `docs/assets/`
      refreshed, since the panel is what changed.
- [ ] **T16 — refactor**: re-read `TraceDrawer` for length; if the head has grown past what reads in
      one screen, lift it into a sibling component. Keep tests green.

## Definition of done

- [ ] Every acceptance criterion in `spec.md` maps to a passing test
- [ ] `verify-gates` green (lint, tests, build — all four layers)
- [ ] Docs updated in the same change; the tracing stub and the panel agree (§4)
- [ ] All new user-facing text exists in `en` **and** `pt` (§7)
- [ ] No `AgentEvent` change — `contract.py` untouched (§9)
- [ ] Nothing on screen that the event stream did not produce (§5)
- [ ] `spec.md` status updated to `done`
