# Plan: A turn that says what it is doing, calls that fold, and agents as a list

## Approach

**Agents.** The star and the inspect button move into one absolutely positioned
`.agent-card__actions` flex container with a `gap` (AC1). The view is a `data-view="grid|list"`
attribute on the existing `<ul>`; List is **CSS only** — same DOM, same buttons, same `disabled` and
reason — so spec 019/022's tests hold unchanged and nothing can drift between the two layouts (§4).
The switch reuses the `aria-pressed` segmented idiom of `.voice-picker__options`. The choice lives in
`fla.ui.v1` beside the rail's collapsed flag (`useAgentsView` in `state/ui.ts`); `useCollapsed` now
merges instead of overwriting, so neither erases the other.

**Live line.** `reduceTurn` records `last?: 'text' | 'reasoning' | 'tool'` — the kind of the last
rendered event, so still nothing the stream did not put there (§8). `turnStatus` priority: settled →
running call → `last` (`text` → `writing`, `reasoning` → `thinking`, `tool` → `idle`) → for a turn
without `last` (restored, or built in a test) the old content-based fallback. `answering` is renamed
`writing` and is no longer silent. `LiveLine` moves below the answer and error, and its elapsed span is
`aria-hidden` so the polite region announces the phase, not every second (spec 040).

**Folded calls.** `ActivityPanel` renders, for `activities.length >= 3`, a `.tool-group` with a toggle
in the `ReasoningCard` idiom (chevron, `aria-expanded`), named by its own content whose label is the count plus the distinct
names in order of first use. Local state, default folded; nothing auto-collapses at settle.

## Affected files

- `frontend/src/panes/AgentsScreen.tsx` — actions container, view switch, `data-view`.
- `frontend/src/state/ui.ts` — `useAgentsView`; `useCollapsed` merges.
- `frontend/src/state/turn.ts` — `last`, `writing`, new priority.
- `frontend/src/panes/Conversation.tsx` — `LiveLine` position, phase, `aria-hidden` clock.
- `frontend/src/panes/ActivityPanel.tsx` — the fold.
- `frontend/src/styles/app.css` — actions cluster, list variant, switch, fold.
- `frontend/src/i18n/strings.ts` — new strings.

## Contract / data model changes (constitution §4)

None on the wire. `Turn.last` is optional (old stored turns). `fla.ui.v1` gains `agentsView`.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `agents.view` | Layout | Visualização |
| `agents.view.grid` | Cards | Cartões |
| `agents.view.list` | List | Lista |
| `turn.writing` | Writing | Escrevendo |
| `tools.group` | {n} tool calls | {n} chamadas de ferramentas |

## Test strategy (constitution §2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | both controls share `.agent-card__actions`; CSS block declares `gap` | `AgentsScreen.test.tsx`, `layout.test.ts` |
| AC2 | switch present, one pressed, List sets `data-view="list"` | `AgentsScreen.test.tsx` |
| AC3 | remount keeps List; throwing storage renders Cards | `AgentsScreen.test.tsx` |
| AC4 | in List, rows keep name/choose/star/inspect/reason/disabled | `AgentsScreen.test.tsx` |
| AC5 | reduce text → `writing`; line follows the answer in the DOM | `turn.test.ts`, `Conversation.test.tsx` |
| AC6 | text then running call → `calling` | `turn.test.ts` |
| AC7 | tool result last → `idle`; reasoning last → `thinking` | `turn.test.ts` |
| AC8 | elapsed span is `aria-hidden` | `Conversation.test.tsx` |
| AC9 | settled → no line | `turn.test.ts`, `Conversation.test.tsx` |
| AC10–12 | fold threshold, label, toggle | `ActivityPanel.test.tsx` |

## Risks / trade-offs

- Existing spec 011 tests asserting silence at the first token are rewritten, not deleted: they now
  assert *writing*. Recorded in the spec as a supersession.
- The live line persisting through writing adds one line of height under a streaming answer; it goes
  when the turn settles, at the same moment the meta line arrives, so the net move is small.
