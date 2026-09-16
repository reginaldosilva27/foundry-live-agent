# Tasks: The shell, elaborated

> Red → green → refactor, in four blocks that can each stop cleanly. Every implement task is
> preceded by the test that fails first.

## Block A — foundations (no visible change)

- [x] **T1 (test)** — `state/storage.test.ts`: `readJson` returns the fallback when the key is
      absent, when the value is malformed, and when the accessor throws; `writeJson` reports
      failure instead of raising; `available` is false in a throwing browser. *(AC20)*
- [x] **T2 (impl)** — `state/storage.ts`.
- [x] **T3 (test)** — `state/history.test.ts`: `titleFrom` trims and falls back to the untitled
      string; `upsert` replaces by id and keeps newest-first; the 26th write drops the oldest;
      `groupByAge` splits today / last 7 days / older against a fixed `now`. *(AC16, AC19, AC22)*
- [x] **T4 (impl)** — `state/history.ts` (types, key, pure ops, `useHistory`).
- [x] **T5 (test)** — `state/exportTurn.test.ts`: the Markdown contains the question, the answer,
      every tool and MCP call with its executor, and a model / tokens / latency footer. *(AC11)*
- [x] **T6 (impl)** — `state/exportTurn.ts`.
- [x] **T7 (test)** — `hooks/useAgentStream.test.tsx`: `restore()` puts messages and the
      conversation id back; the next send posts exactly `message`, `conversation_id`, `agent`.
      *(AC17, AC21)*
- [x] **T8 (impl)** — expose `conversationId`, add `restore()`.
- [x] **T9 (impl)** — lift `useCopy` out of `CopyRow`; `copy.*` strings replace `trace.copy*`;
      existing `CopyRow.test.tsx` stays green. *(§4)*

## Block B — the agents screen

- [x] **T10 (test)** — `components/Monogram.test.tsx`: two letters from a name, one letter from a
      single word, a stable tint for the same name, no emoji. *(AC24)*
- [x] **T11 (impl)** — `components/Monogram.tsx`.
- [x] **T12 (test)** — `panes/AgentsScreen.test.tsx`: move 019's `AgentPicker` tests over, then add
      card fields, dimmed + reasoned rows, search narrowing, the no-match line, the error state.
      *(AC4, AC5, AC7)*
- [x] **T13 (impl)** — `panes/AgentsScreen.tsx`; delete `AgentPicker.{tsx,test.tsx}`.
- [x] **T14 (test)** — `App.test.tsx`: nav renders both items with one current; activating Agents
      shows the grid, activating a card selects + resets + returns to chat. *(AC1, AC6)*
- [x] **T15 (impl)** — `view` state in `App`, nav in `Sidebar`.
- [x] **T16 (test)** — `panes/Sidebar.test.tsx`: collapse toggles and is read back; accessible
      names survive; the footer still reports; the answering agent shows and no list does.
      *(AC2, AC3, AC8)*
- [x] **T17 (impl)** — the rail: collapse, answering-agent card, footer.

## Block C — the turn and the composer

- [x] **T18 (test)** — `components/AnswerActions.test.tsx`: copy writes and reports then reverts;
      download hands the Markdown to a save; trace calls back. *(AC10)*
- [x] **T19 (impl)** — `components/AnswerActions.tsx`.
- [x] **T20 (test)** — `panes/Conversation.test.tsx`: no row while streaming, three when done,
      trace-only on an error turn, trace opens the panel. *(AC9, AC12, AC13)*
- [x] **T21 (impl)** — wire `AnswerActions` into the turn stack.
- [x] **T22 (test)** — `panes/AgentChip.test.tsx`: names selected → configured → nothing; the menu
      lists only selectable; choosing selects and resets; `Escape` closes and restores focus.
      *(AC14, AC15)*
- [x] **T23 (impl)** — `panes/AgentChip.tsx`, rendered by `Composer`.

## Block D — history in the shell

- [x] **T24 (test)** — `App.test.tsx`: a finished turn is written to storage; the sidebar lists it
      in the right group. *(AC16)*
- [x] **T25 (impl)** — save on `done` in `App`.
- [x] **T26 (test)** — `panes/HistoryList.test.tsx`: groups render, rename persists, delete removes,
      New session removes nothing. *(AC19)*
- [x] **T27 (impl)** — `panes/HistoryList.tsx`.
- [x] **T28 (test)** — `App.test.tsx`: reopening restores the transcript and the next send carries
      the stored `conversation_id`; a conversation whose agent is unselectable renders, blocks the
      composer and says why; with storage throwing, the app still streams and says history is
      unavailable. *(AC17, AC18, AC20)*
- [x] **T29 (impl)** — restore, the blocked-continuation rule, the unavailable note.

## Block E — styling, docs, gates

- [x] **T30 (test)** — `styles/layout.test.ts`: the first column is the collapsible custom
      property; the history region and the agents grid each declare their own scroll with
      `min-height: 0`. *(AC25)*
- [x] **T31 (impl)** — `styles/app.css`: rail, collapsed rail, cards, action row, chip, history.
      Tokens only.
- [x] **T32 (i18n)** — every key from the plan's table in `en` + `pt`; `sidebar.noHistory` retired;
      `strings.test.ts` green. *(AC23)*
- [x] **T33 (docs)** — `docs/design-system.md` (retire M9, record the new layout contract),
      `docs/architecture.md` (the render cache and the pointer), `specs/README.md` (index + map).
- [x] **T34 (verify)** — the `verify-gates` skill; screenshots at 1280×800 and 1440×900 in a real
      browser; refresh `docs/assets/screenshot-chat.png` if the shell has moved under it.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean (`npm run lint`)
- [x] Tests green (`npm test`)
- [x] Build passes (`npm run build`)
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] All new user-facing text exists in `en` **and** `pt` (§7)
- [x] `spec.md` status → `done`
