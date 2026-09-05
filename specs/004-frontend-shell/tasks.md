# Tasks: Frontend shell

> Done. Spec 003 provided the stream it consumes.

- [x] **T1**: Vite + React + TS scaffold, oxlint, Vitest; vendor `colors_and_type.css` and the three
      Poppins cuts into `public/ds/`
- [x] **T2 — RED**: reducer and frame-parser tests over `AgentEvent` sequences (AC2, AC3)
- [x] **T3 — GREEN**: `types/events.ts`, `state/sse.ts`, `state/turn.ts`, `hooks/useAgentStream.ts`
- [x] **T4 — RED**: `ToolCard` renders `executor: app` differently from `foundry` (AC4)
- [x] **T5 — GREEN**: `ToolCard`, `ReasoningCard`, `ErrorCard`, `MessageBubble`, `MetaLine`
- [x] **T6 — GREEN**: the three panes and the layout (AC1, AC12)
- [x] **T7 — RED/GREEN**: `strings.ts` en+pt, plus the no-bare-prose and no-emoji tests (AC10, AC11)
- [x] **T8 — GREEN**: `HarnessBadge` from `/config` (AC9)
- [x] **T9 — GREEN**: markdown + code blocks, streaming without full re-parse (AC8)
- [x] **T10 — gates**: lint, test, build
- [x] **T11 — docs**: screenshots into `docs/assets/`, replacing the README placeholders

## Acceptance criteria to tests

| AC | Test |
|---|---|
| AC1 | `styles/layout.test.ts` · `App.test.tsx` "lays out the sidebar, the main column and the trace panel" |
| AC2 | `state/sse.test.ts` (4) · `App.test.tsx` "streams a turn" — real frames through a real `ReadableStream` |
| AC3 | `state/turn.test.ts` "ignores an event type it does not know, and counts it" · `types/contract-parity.test.ts` |
| AC4 | `components/cards.test.tsx` "marks an app-executed tool and a Foundry-executed one differently", "attributes an MCP call to the server that ran it" · `App.test.tsx` |
| AC5 | `components/cards.test.tsx` "shows the arguments while the call is still running", "shows the result and how long it took" |
| AC6 | `components/cards.test.tsx` "streams its text and collapses on demand", "says why it is empty" |
| AC7 | `components/cards.test.tsx` "renders a terminal error as an error" · `App.test.tsx` |
| AC8 | `state/markdown.test.ts` (5) — settled blocks stay byte-identical as text streams in |
| AC9 | `App.test.tsx` "shows which harness the BFF is running", "says so when the BFF is not answering" |
| AC10 | `i18n/strings.test.ts` "has every key in every language", "translates every key…", "has no prose written directly into a component" · `App.test.tsx` "renders every string in Portuguese" |
| AC11 | `i18n/strings.test.ts` "ships no emoji or decorative glyph icons" |
| AC12 | `styles/layout.test.ts` "turns the trace panel into an overlay below the breakpoint" |
| AC13 | The gate itself |

## Definition of done

- [x] Every acceptance criterion maps to a passing test — 48 tests, 8 files
- [x] Lint clean · tests green · build passes
- [x] Tokens imported, not hand-edited (§4) — `public/ds/colors_and_type.css` is verbatim, and
      `layout.test.ts` asserts our own CSS writes no colour of its own
- [x] Every new string in en **and** pt (§7)
- [x] `spec.md` status updated to `done`

## Known limitation

AC12 is asserted as a **CSS rule**, not as a rendered measurement: jsdom applies no stylesheet. The
breakpoint was not verified in a browser during implementation — the resize did not take effect in
the automation session, and this is recorded rather than glossed over (§5).
