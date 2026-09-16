# Plan: The turn shows its steps when the model shows no reasoning

> The HOW. Written after `spec.md` is `clarified`. Decisions here must respect every
> principle in `.specify/constitution.md`; if one must bend, amend the constitution
> first and note it.

## Approach

Three small changes, none of which crosses the harness boundary. The whole feature is frontend:
every value it draws already arrives in the events the BFF streams today.

1. **The ordinal is assigned in the turn state, once.** `reduceTurn` already builds each activity
   when its `tool_call` / `mcp_call` arrives, and it knows how many came before. So `step` is set
   there — `turn.activities.length + 1` — and every surface reads the same number off the activity.
   That satisfies AC12 by construction: the voice overlay reverses a *copy* of the array for
   display, and the number travels with the item rather than with its position on screen.
2. **The row gains two cells**: the ordinal at the front, and the call's subject next to the name.
   The subject is computed by a pure function over the raw `arguments` string — parse, take the
   first string value, give up quietly on anything else.
3. **The empty reasoning card collapses into one line**, and the live line gains an ordinal and a
   clock.

The clock is the one thing that is **not** event-derived, and it is isolated on purpose. Events
carry no timestamps, so "how long has this been going on" is a fact about *our observation*, not
about the run. It lives in a component hook keyed on the status, so `state/turn.ts` stays pure and
AC13 keeps its meaning: ordinals and subjects are functions of the log; the clock is a stopwatch we
started, and nothing it displays is attributed to the agent.

**Alternative rejected:** grouping rows by response leg. It matches what the model actually decided
(the fixture's leg 1 made two calls in one breath) but needs a container the panel does not have,
and nothing in the observed complaint is about grouping — it is about seven lines that read alike.
Recorded in the spec as a known inaccuracy rather than hidden here.

**Already done, outside this spec:** `agent.yaml` moved from `reasoning.summary: auto` to
`detailed` and was applied as agent version 5, verified by reading the definition back from the live
service (a config adjustment, not a behavior spec; the observation is in `docs/REFERENCES.md`). This
feature is what happens when that still yields no summary — another model, another harness, or a
model that declines.

## Affected files

- `frontend/src/state/turn.ts` — `ToolActivity` and `McpActivity` gain `step: number`, set in
  `reduceTurn` where the activity is created. Single source of truth for the ordinal (§4).
- `frontend/src/components/format.ts` — new `callSubject(args: string): string`: first string value
  of a JSON object, `''` for absent / empty / unparseable / no-string-value. Lives beside
  `formatMs` because it is the same kind of thing: a pure "event value → what the row shows".
- `frontend/src/components/ToolRow.tsx` — renders `activity.step` (when the turn has more than one
  call) and `callSubject(activity.arguments)`. No change to the existing four columns' order.
- `frontend/src/styles/app.css` — a leading ordinal track on `.tool-row`'s grid with its own floor,
  so spec 014 AC9's alignment survives; truncation for the subject; the collapsed absent-reasoning
  line.
- `frontend/src/components/ReasoningCard.tsx` — the `--absent` branch becomes one quiet line, not a
  bordered card with a heading.
- `frontend/src/hooks/useElapsed.ts` — **new.** Seconds since the value of its key last changed;
  ticks on a 1 s interval, clears on unmount, and stops once the turn settles.
- `frontend/src/panes/Conversation.tsx` — `LiveLine` shows the running call's ordinal and the
  elapsed time of the current state.
- `frontend/src/i18n/strings.ts` — new + corrected keys, `en` + `pt` (§7).
- `frontend/src/panes/ActivityPanel.tsx`, `panes/TraceDrawer.tsx`, `panes/VoiceOverlay.tsx` — each
  passes `showStep`, because only a caller can see whether its turn made more than one call.
- `docs/how-it-works/streaming-events.md`, `docs/REFERENCES.md`, `CLAUDE.md` ↔ `AGENTS.md` — the
  `auto` finding, recorded once and mirrored where §6 requires it.
- `specs/README.md` — status to `done` at the end.

**Deliberately untouched:** `ai/`, `backend/`, the contract, the trace panel's payload rendering,
and `ToolCard`.

## Contract / data model changes (constitution §4)

**None crosses the boundary.** `ai/harness/_shared/contract.py` is unchanged: no new event type, no
new field, no change to what a harness must emit. §9 holds, and the "would this still be true if the
harness were swapped?" test passes — a different harness emitting the same nine events gets the same
numbered rows for free.

`step` is added to the frontend's *derived* `Activity`, which is a view over the log and not a
contract (`state/turn.ts` is its own source of truth). It must not be read as something the harness
sends: the type comment says so.

One interaction to handle, from the spec's "Related" section: spec 016 asks the model, in
`agent.yaml`, for a preamble sentence before slow tools. That text arrives as `text_delta`, and `turnStatus` returns
`answering` the moment any text exists — so the live line, clock and all, disappears as soon as the
preamble lands. **This plan does not change that.** The preamble is a better status line than ours
(the model wrote it and it is specific), and two status displays at once is noise. Noted here so the
next reader knows it is a decision rather than an oversight.

## i18n strings (constitution §7)

| key / location | en | pt |
|---|---|---|
| `reasoning.absentBody` *(replaces the false copy)* | No reasoning summary this turn. | Sem resumo de raciocínio neste turno. |
| `turn.step` *(label for the ordinal, and its `aria-label`)* | Step | Passo |

Two keys considered and not added: the subject cell's tooltip, which is the subject itself and
needs no prose, and the elapsed-time suffix, which is `s` in both languages — a number's unit, like
`formatMs`, not a translated string. `reasoning.absentTitle` goes with the card's heading. The
replaced `absentBody` — *"This model emits none. Point the deployment at a reasoning model to see
this card fill in."* — is deleted, not softened: it asserted something the live service contradicts.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | a row whose arguments are `{"query": …}` shows the query text | `components/ToolRow.test.tsx` |
| AC2 | two calls, same tool, different arguments → different rendered rows | `components/ToolRow.test.tsx` |
| AC3 | `''`, `'{}'`, `'not json'`, `{"n": 1}` → renders, no subject, no throw | `components/format.test.ts` + `ToolRow.test.tsx` |
| AC4 | a long subject is truncated and the executor cell keeps its x | `styles/layout.test.ts` |
| AC5 | replaying 3 calls assigns steps 1, 2, 3 in event order | `state/turn.test.ts` |
| AC6 | a turn with one call renders no ordinal | `components/ToolRow.test.tsx` |
| AC7 | `tool_call`, `mcp_call`, `tool_call` → steps 1, 2, 3 unbroken | `state/turn.test.ts` |
| AC8 | settled turn, no reasoning → the line states "this turn" and claims nothing about the model | `components/cards.test.tsx` |
| AC9 | a turn with reasoning renders the card unchanged | `components/cards.test.tsx` |
| AC10 | streaming turn, call in flight → live line has ordinal, name and elapsed | `panes/Conversation.test.tsx` |
| AC11 | elapsed restarts when the status changes (fake timers) | `hooks/useElapsed.test.ts` + `Conversation.test.tsx` |
| AC12 | same turn in panel and overlay → same ordinal for the same call | `panes/VoiceOverlay.test.tsx` |
| AC13 | ordinals and subjects come from `reduceEvents` alone, no clock in turn state | `state/turn.test.ts` |

Every one of these is a behavior assertion — what a reader sees given a log — not a check that a
particular function was called. `src/test/fixtures.ts` gains a repeated-call log shaped after the
observed turn; like everything in that file it is a hand-built *contract* log, and it says so and
names the recording it is modelled on — the frontend's fixtures have never pretended to be
recordings, and §5 is why the distinction is written down rather than blurred.

## Risks / trade-offs

- **The preamble may retire the live line before the clock is ever seen.** Accepted above, and it is
  the good outcome: the model's own sentence beats ours. If the model ignores the instruction, the
  clock is there.
- **A ticking clock re-renders the streaming turn once a second.** Confined to `LiveLine`, which
  renders no answer text, and it stops when the turn settles.
- **The ordinal adds a fifth grid track** to a row whose alignment spec 014 fixed deliberately. The
  track gets its own floor for the same reason the others have one; `styles/layout.test.ts` is where
  that is proven, and it is the reason AC4 is a layout test rather than a visual judgement.
- **"First string value" will eventually pick the wrong field** for a tool whose first parameter is
  not the interesting one. When that tool exists, the fix is a per-tool rule — and the argument for
  it will be concrete rather than hypothetical.
