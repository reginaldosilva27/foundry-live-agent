# Spec: The trace panel becomes an instrument

| | |
|---|---|
| **ID** | 014-trace-panel |
| **Status** | clarified |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-15 |

## Problem / motivation

The trace panel is the surface that argues this project's central claim — *the agent ran in
Foundry, and here is the evidence*. Today it does not carry its own argument.

It shows a `response_id` you cannot copy. The one thing a reader does with a response id is paste
it somewhere else, and the panel offers no way to get it out short of selecting twelve characters
of 12px monospace by hand. The link beside it goes to `https://ai.azure.com` — the site root, not
the run.

It shows no numbers. Tokens, latency and the model live in the chat's meta line; the panel a reader
opens *to look at the run* has none of them. A reader comparing two turns has to close the panel to
compare them.

It never says which turn it is showing. Opening it from the header jumps to the newest turn without
saying so, and opening it from an older turn's meta line looks identical. There is no way to move
between turns once inside.

It holds a "Spans" heading over a paragraph explaining that spans are not here yet — a permanent
section whose only content is its own absence, taking the visual weight of a real one.

And it discards data it already parses. `otel_trace_id` and `gateway_request_id` arrive in the
`trace_ids` event, are read into `Turn.trace`, and are rendered nowhere. They are not dead code —
they are **reserved for spec 005** (`docs/how-it-works/tracing-and-gateway.md` is a stub that names
them) — but a field that is silently dropped and a field that is deliberately pending look exactly
the same from the screen, and §5 is the principle that says they should not.

Visually, the calls in the panel and in the chat are laid out as flex rows, so the executor tags and
the durations ragged-edge down the list: `foundry`, `microsoft_learn` and `bff` each start at a
different x, and the eye cannot scan the column that matters most — *who ran this*.

## Goals

- Every identifier the panel shows can be copied in one press.
- The panel carries the run's numbers — tokens, latency, model — so a run can be read without
  leaving it.
- The panel says which turn it is showing, and a reader can move between turns without closing it.
- Tool calls align on a fixed grid, in the chat and in the panel alike, so the executor column
  scans vertically.
- Duration is visible as magnitude, not only as a number — drawn **only** from `duration_ms` that
  the events actually carried (§5).
- Identifiers reserved for spec 005 are named as pending rather than dropped in silence.
- Nothing in the panel is drawn from a number nobody queried.

## Non-goals

- **No new event type and no new field.** The contract in §9 does not change; everything here is
  already in `Turn` (§9 would otherwise require its own spec).
- **No span waterfall.** Real spans arrive with spec 005, from Application Insights. A bar whose
  x-axis is invented is exactly what §5 forbids; this spec draws bar *lengths* from real durations
  and gives them no shared time axis.
- No querying of Application Insights, no Log Analytics, no new Azure dependency.
- No change to the voice overlay, which has no trace panel beside it.
- No persistence. A reload still loses the session, as it does everywhere else in this release.

## Clarified decisions (2026-09-15)

- **The reserved ids get a line, not a section.** `otel_trace_id` and `gateway_request_id` are
  listed with the other ids and marked as arriving with spec 005, in the same voice the panel
  already uses for spans. If a future harness emits them, they render as ordinary copyable ids with
  no code change — the rendering keys off presence, not off a flag.
- **"Spans" loses its heading.** The section becomes one footer line, so the panel stops spending a
  heading's worth of weight on something absent.
- **Duration bars are relative to the widest call in the same turn**, and only to it. They compare
  the calls of one run to each other, which is a claim the numbers support; they are not a timeline
  and carry no start offsets, which the numbers do not support. An MCP call, which carries no
  duration, gets no bar and says why on hover.
- **Turn navigation is previous/next, not a list.** A session is short and a list would be a second
  sidebar; two arrows and a position ("2 / 5") answer the question with no new surface.
- **The copy feedback is text, not an icon swap.** The panel is monospace and dense; a label that
  changes to *copied* for a moment reads without adding a second icon language.

## User-facing behavior

The panel keeps its column and its dark ground, and gains four things.

**A head that names the run.** The title line carries which turn is shown and the arrows to move
between them. Below it, a compact row of the run's numbers — model, total tokens (with reasoning
tokens when present), latency — in the same monospace as everything else.

**Identifiers you can take with you.** Each id is a row: label, value, and a copy control that
covers the whole row. Pressing it copies the value and the label says *copied* for a moment. The
two ids reserved for spec 005 appear in the same list, greyed, with the note that tracing lands
with that spec — they are never silently absent.

**Calls on a grid.** Status, name, executor tag and duration occupy fixed columns, so the tags line
up down the list. Under a call that carried a duration, a thin bar shows its length relative to the
longest call in the same turn. A call with no duration shows no bar.

**A footer instead of an empty section.** One line where the "Spans" heading used to be, saying
where real spans will come from.

All new prose ships `en` + `pt` (§7).

## Acceptance criteria

1. **AC1** — Given a turn whose trace carries a `response_id`, when the reader presses that id's
   row, then the value is written to the clipboard and the row reports that it was copied.
2. **AC2** — Given a turn with usage and a measured latency, when the panel renders, then it shows
   the model, the total token count and the latency; and given a turn whose usage carries
   `reasoning_tokens`, it shows those too.
3. **AC3** — Given a turn with no usage yet, when the panel renders, then the numbers row omits the
   missing figures rather than showing zeros.
4. **AC4** — Given a session of several agent turns, when the panel is open, then it states which
   turn it is showing and its position in the session; and pressing previous/next moves it to the
   adjacent turn without closing the panel.
5. **AC5** — Given the panel is showing the first (or last) turn, when it renders, then the
   previous (or next) control is disabled.
6. **AC6** — Given a turn whose calls have durations, when the panel renders them, then each call
   with a duration is given a bar whose length is proportional to the longest duration in that same
   turn, and the longest call's bar is full width.
7. **AC7** — Given an MCP call, which carries no duration, when the panel renders it, then no bar
   is drawn for it and the reason is available as text.
8. **AC8** — Given a trace with no `otel_trace_id` and no `gateway_request_id`, when the panel
   renders, then both are named as arriving with spec 005; and given a trace that carries either,
   it renders as an ordinary copyable id.
9. **AC9** — Given any tool call, when it renders in the chat or in the panel, then status, name,
   executor tag and duration sit in fixed columns, so that two calls with different name lengths
   align their executor tags.
10. **AC10** — Given the panel is open, when a reader tabs through it, then every control it added
    — copy rows, turn arrows — takes a visible focus ring.
11. **AC11** — Every string this spec adds exists in `en` and `pt` (§7).
12. **AC12** — The panel draws no bar, number or identifier that did not come from an `AgentEvent`
    the run produced (§5).

## Contract / data impact

**None.** Everything rendered here already exists on `Turn` — `trace`, `usage`, `activities[].
durationMs` — and the latency the chat already computes. `ai/harness/_shared/contract.py` is
untouched, so §9 is not engaged and no harness changes.

The one thing that moves with this: `docs/how-it-works/tracing-and-gateway.md` names the two
reserved ids as spec 005's, and this spec makes the panel say so. The two must agree (§4).

## Open questions (clarify before planning)

*(none — resolved above under Clarified decisions)*

## Out of scope / deferred

- Real spans, a time axis, and Application Insights queries — **spec 005**.
- Deep-linking the portal button to a specific run. The portal URL shape for a response id is not
  in `docs/REFERENCES.md` and §10 forbids guessing it; the button keeps pointing at the portal
  until a doc says otherwise.
- Exporting a run as JSON.
- Filtering the call list by executor.
