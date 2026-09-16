# Tasks: The trace panel becomes an instrument

> Ordered TDD checklist for [`spec.md`](spec.md) / [`plan.md`](plan.md).
> Each implementation task is preceded by the test that must fail first.

## Tasks

### Strings first — everything below renders them

- [x] **T1 — i18n**: add the twelve keys from the plan in `en` + `pt`; add the two reserved id
      labels to `INTENTIONALLY_IDENTICAL`. `strings.test.ts` is generic and covers **AC11**; it
      must stay green from here on.

### The copy row (AC1)

- [x] **T2 — test first**: `components/CopyRow.test.tsx` — pressing the row writes the value to the
      clipboard and the row reports it; a clipboard that rejects reports failure; a clipboard that
      is absent does not throw.
- [x] **T3 — implement**: `components/CopyRow.tsx`.

### The numbers (AC2, AC3)

- [x] **T4 — test first**: `components/TraceNumbers.test.tsx` — renders model, total tokens,
      reasoning tokens and latency; omits each one that is absent, and renders no `0`.
- [x] **T5 — implement**: `components/TraceNumbers.tsx`.

### The calls become a grid, with bars (AC6, AC7, AC9, AC12)

- [x] **T6 — test first**: extend `components/ToolRow.test.tsx` — a call whose duration is the
      longest in its turn gets a full-width bar; a shorter one gets a proportional bar; an MCP call
      gets no bar and carries the reason as text.
- [x] **T7 — implement**: `ToolRow` takes an optional ratio and renders the bar from it;
      `TraceDrawer` computes the turn's longest duration once (`longestDuration`, in `state/turn.ts`)
      and passes it. **`ActivityPanel` deliberately does not** — the bars are a panel affordance; see
      the struck-through entry in `plan.md`.
- [x] **T8 — test first**: extend `styles/layout.test.ts` — the row declares fixed grid columns.
- [x] **T9 — implement**: the grid in `styles/app.css`; verify the chat and the voice overlay still
      render correctly, since all three surfaces share this component (§4).

### The panel's head: turn identity and navigation (AC4, AC5, AC8)

- [x] **T10 — test first**: extend `panes/TraceDrawer.test.tsx` — the panel states its position;
      the arrows call the callbacks; first/last disables the matching arrow; the two reserved ids
      render as pending when absent and as copyable ids when present; the numbers row appears.
- [x] **T11 — implement**: `TraceDrawer` head, ids as `CopyRow`s, numbers row, `Spans` heading
      replaced by the footer line.
- [x] **T12 — implement**: `App.tsx` derives index/count and passes `model`, `latencyMs` and the
      two navigation callbacks. Confirm a turn streaming in the background does not move a panel
      parked on an older turn.

### Focus and finish (AC10)

- [x] **T13 — test first**: extend the focus-ring list in `styles/layout.test.ts` with the copy row
      and the turn arrows.
- [x] **T14 — implement**: add them to the `:focus-visible` rule.
- [x] **T15 — docs (§4)**: `docs/how-it-works/tracing-and-gateway.md` gains the line that the panel
      names the two reserved ids as pending; `CHANGELOG.md` entry.
- [x] **T15b — screenshot**: `docs/assets/screenshot-chat.png` retaken against a live Foundry run.
      It is also what caught AC9 being only half true — see T17.
- [x] **T16 — refactor**: re-read `TraceDrawer` for length; if the head has grown past what reads in
      one screen, lift it into a sibling component. Keep tests green. → `TurnStepper` lifted out; the
      panel body now reads as five sections without a nested control block in the header.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] `verify-gates` green (lint, tests, build — all four layers)
- [x] Docs updated in the same change; the tracing stub and the panel agree (§4)
- [x] All new user-facing text exists in `en` **and** `pt` (§7)
- [x] No `AgentEvent` change — `contract.py` untouched (§9)
- [x] Nothing on screen that the event stream did not produce (§5)
- [x] `spec.md` status updated to `done`

### Found by looking at it (added after the first screenshot)

- [x] **T17 — the grid did not actually align.** Each `.tool-row` is its own grid container, so
      `auto` tracks size to their own row and cannot agree across rows: `bff` and `microsoft_learn`
      started at different x, and an MCP call — carrying no duration — let its tag slide into the
      empty fourth column. The test written for AC9 asserted that the CSS *declared* grid columns,
      which is mechanism, not behaviour, so it passed against a broken layout. Both tracks now carry
      a floor, and the test reads the floor. Caught only by the screenshot.
- [x] **T18 — the floors then broke the 320px panel**, wrapping `lookup_knowledge` over four lines.
      The floors are custom properties; the panel lowers them and pulls the tag to the duration rail.
- [x] **T19 — `modelName` moves to `components/format.ts` (§4).** The rule that strips the
      `<connection>/` prefix lived inside `Sidebar`, so the panel rendered the raw deployment name —
      four wrapped lines of `ai-admin2354ai223634534-project/gpt-5.5` beside a sidebar saying
      `gpt-5.5`. `MetaLine` was showing the raw name too. One rule, three callers.
