# Tasks: A light shell, a theme switch, and one Playground

## Slice A — removals

- [x] **T1 — red**: AC3 — ⌘K opens nothing, no Commands control; `BINDINGS` has no `openPalette`.
- [x] **T2 — green**: delete palette module, pane, binding, strings, wiring.
- [x] **T3 — red**: AC4 — no History nav entry or screen; rail search/reopen still pass.
- [x] **T4 — green**: delete `HistoryScreen` and the export/import functions it orphaned.

## Slice B — Playground

- [x] **T5 — red**: AC10 — route parse/format for `playground` and legacy addresses.
- [x] **T6 — green**: `route.ts`.
- [x] **T7 — red**: AC8/AC9 — `useComparison` single-agent send; two posts when a second agent is chosen.
- [x] **T8 — green**: `useComparison.ts`.
- [x] **T9 — red**: AC6/AC7/AC9 — `PlaygroundScreen` tabs, `PlaygroundAgent` read-only definition, no ranking.
- [x] **T10 — green**: extract `AgentDefinitionBlocks`; rename `Compare` → `PlaygroundAgent`, `Playground` → `ToolRunner`; add `PlaygroundScreen`; wire `App`.
- [x] **T11 — red/green**: AC5 — rail nav is Chat, Agents, Playground.

## Slice C — light rail and the switch

- [x] **T12 — red**: AC2 — toggle in footer, names target theme, flips, persists, `system` via matchMedia; default light; pre-paint.
- [x] **T13 — green**: `ThemeSwitch` (in `Sidebar.tsx`), icons, `DEFAULTS.theme`, `index.html`.
- [x] **T14 — red**: AC1 — rail tokens per theme and rail contrast pairs.
- [x] **T15 — green**: rail tokens + `.sidebar` restyle; focus override into dark blocks.

## Slice D — greeting, polish, docs

- [x] **T16 — red**: AC11 — greeting by hour and language, chip, cards.
- [x] **T17 — green**: `EmptyState`.
- [x] **T18 — refactor**: visual pass (canvas, composer, primary pill, playground layout) keeping layout/contrast tests green.
- [x] **T19 — docs**: CLAUDE.md ↔ AGENTS.md (+ workflow mirrors) for 020/025/027/036/042 paragraphs; `specs/README.md` row.
- [x] **T20 — verify**: `verify-gates`; AC12 browser check with `just demo` at 320/390/1440 in both themes.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean · tests green · build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4, §6)
- [x] All new user-facing text exists in en **and** pt
- [x] `spec.md` status updated to `done`

## Notes from implementation (2026-10-15)

- **AC12 browser check** — against the running dev build at 1440×757 (light and dark, chat and both
  Playground tabs) and in 320px/390px iframes on `/`, `/playground`, `/playground/tools`, `/agents`:
  `scrollWidth` equal to the viewport in every case. The check ran against the owner's live dev
  server rather than `just demo`, because ports 5173/8000 were already serving this repository;
  no message was sent to the agent.
- Two layout bugs found only in the browser and fixed: the Playground's composer stretched to fill
  the empty middle row (now pinned to row 3), and the screen's classes collided with spec 042's
  `.playground*` (renamed to `.playground-screen*`).
- The History screen's **Clear the record** control left with the screen; per-conversation delete in
  the rail remains.
- `README` screenshots predate this spec and need recapturing.
