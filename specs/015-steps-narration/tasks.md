# Tasks: The turn shows its steps when the model shows no reasoning

> The work, ordered, as a TDD checklist. Each implementation task is preceded by the
> test that should fail first (red → green → refactor). Check boxes as you go.

## Tasks

### The subject of a call (AC1–AC3)

- [x] **T1 — test first**: `components/format.test.ts` — `callSubject` returns the query for
      `{"query": "x"}`, the timezone for `{"timezone": "x"}`, the url for `{"url": "x"}`, and `''`
      for `''`, `'{}'`, `'not json'`, `'[]'` and `{"n": 1}`.
- [x] **T2 — implement**: `callSubject` in `components/format.ts`.

### The ordinal, in the turn state (AC5, AC7, AC13)

- [x] **T3 — test first**: `state/turn.test.ts` — replaying three `tool_call`s assigns `step` 1, 2,
      3; a `tool_call` / `mcp_call` / `tool_call` log assigns 1, 2, 3 unbroken; nothing in the turn
      state carries a timestamp.
- [x] **T4 — implement**: `step` on `ToolActivity` and `McpActivity`, set in `reduceTurn`.

### The row (AC1–AC4, AC6)

- [x] **T5 — test first**: `components/ToolRow.test.tsx` — the subject renders; two same-tool calls
      with different arguments render differently; a one-call turn renders no ordinal; a multi-call
      turn renders each ordinal; unparseable arguments render a row with no subject and no throw.
- [x] **T6 — implement**: `ToolRow` renders the ordinal and the subject.
- [x] **T7 — test first**: `styles/layout.test.ts` — a long subject is truncated and the executor
      column keeps its position (spec 014 AC9 still holds with the fifth track).
- [x] **T8 — implement**: the grid track and truncation in `styles/app.css`.

### The absent-reasoning line (AC8, AC9)

- [x] **T9 — test first**: `components/cards.test.tsx` — a settled turn with no reasoning shows a
      line scoped to *this turn* and asserting nothing about the model or the deployment; a turn
      with reasoning renders the card exactly as before.
- [x] **T10 — implement**: the `--absent` branch of `ReasoningCard`, and delete the false copy.

### The clock and the live line (AC10, AC11)

- [x] **T11 — test first**: `hooks/useElapsed.test.ts` — counts seconds with fake timers, restarts
      when the key changes, clears its interval on unmount.
- [x] **T12 — implement**: `hooks/useElapsed.ts`.
- [x] **T13 — test first**: `panes/Conversation.test.tsx` — a streaming turn with a call in flight
      shows the ordinal, the tool name and the elapsed time; the elapsed time restarts when the
      status changes from calling to thinking.
- [x] **T14 — implement**: `LiveLine` in `panes/Conversation.tsx`.

### Every surface (AC12)

- [x] **T15 — test first**: `panes/VoiceOverlay.test.tsx` — the overlay, which lists newest-first,
      shows the same ordinal for a call as the activity panel does.
- [x] **T16 — implement**: `showStep` passed from `ActivityPanel`, `TraceDrawer` and `VoiceOverlay`.
      T15 failed first after all — the expectation that it would pass was wrong, because the ordinal
      travels on the activity but the decision to *draw* it belongs to whoever can see the turn.

### Closing

- [x] **T17 — i18n**: every new string in `en` + `pt` (§7); the false `reasoning.absentBody` gone.
- [x] **T18 — docs**: `docs/how-it-works/streaming-events.md` (where the row's argument comes from,
      and why `auto` is not enough), `docs/REFERENCES.md` (the 2026-09-16 observation, §10),
      `CLAUDE.md` ↔ `AGENTS.md` (the same fact, in sync, §6), `CHANGELOG.md`.
- [x] **T19 — refactor**: keep tests green; run the `verify-gates` skill.
- [x] **T20 — status**: `spec.md` → `done`, `specs/README.md` index row → ✅.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] All new user-facing text exists in `en` **and** `pt`
- [x] `spec.md` status updated to `done`

## What the work changed about the plan

- **Specs 009 and 010 had to be narrowed, not just extended.** Three of their tests asserted that a
  call's *arguments* never appear in the chat or in the trace panel's list. The subject cell
  contradicts that by design, so those assertions were rewritten to guard what they were really
  protecting — the *result*, a page of JSON between the question and the answer — and each says so
  where it was changed. Recorded here because a silently edited assertion is how a guarantee
  disappears.
- **The ordinal needed explicit grid placement.** With the ordinal drawn only for multi-call turns,
  a row without one flowed its tag a track to the left and undid spec 014 AC9. The tag and duration
  cells are now placed, not flowed.
- **T16 was expected to be green on the first run and was not** — see above.

## What a browser showed that the tests did not

Reported from the running app and fixed the same day. `styles/layout.test.ts` reads CSS *rules*;
jsdom lays nothing out, so none of this could fail there — the rows were rendered against the real
stylesheet in a headless browser at 900px and 320px, and measured.

- **The tool name was being shredded.** `lookup_knowledge` came out as `lookup_kn` / `owledge` in
  the chat and one character per line in the trace panel: the name kept `overflow-wrap: anywhere`
  from before, and now shared a flex track with a subject that grew. The name is an identifier and
  is never broken — it has its own element, never wraps, and ellipsises only when even the whole
  cell is too narrow.
- **Then it overflowed instead.** A nowrapped name that cannot shrink painted itself straight across
  the `bff` badge at 320px. Fixed by letting it shrink with an ellipsis, while the subject — basis
  zero — takes only what is left rather than squeezing it.
- **`grid-column: 1 / -1` on the subject did nothing**, and the layout test happily passed it: the
  subject is a child of the name's *cell*, not of the row's grid. The panel stacks them with a flex
  wrap instead.
- **The ordinal column cost the panel 26px it did not have**, which is what ellipsised
  `lookup_knowledge` there. Its floor is 0 in the panel and the name is set one step down: 116px
  wanted against 122px of track, measured.

The lesson worth keeping: a layout rule that a test can only read is a rule a browser still has to
confirm. Three of these four were wrong in a way the suite called green.
