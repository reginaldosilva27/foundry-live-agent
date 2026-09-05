# Spec: Frontend shell — three panes, streaming, and the two kinds of tool

| | |
|---|---|
| **ID** | 004-frontend-shell |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-04 |

## Problem / motivation

The BFF emits a typed event stream that nobody can see. This spec builds the surface that makes the
agent's behaviour legible — which is the entire pedagogical payload of the repository.

The design already exists: a Claude Design project built on the Dataside design system, recorded in
[`../../docs/design-system.md`](../../docs/design-system.md) together with nine points (M1–M9) where
the mock and the implementation disagree. This spec builds the design's structure and visual
language, and applies those nine corrections.

The one that matters most is **M6**. The mock renders every tool call identically. But a tool the BFF
executed and a tool Foundry executed are not the same event, and a viewer who cannot tell them apart
has missed the point of the project.

## Goals

- Three panes: conversation, agent activity, trace drawer — per the design.
- Streaming that reads as streaming: reasoning appearing as it is summarised, tool cards resolving
  from spinner to result, text arriving with a caret.
- **App-executed and Foundry-executed tools visibly different.**
- The Dataside tokens imported, not retyped.
- Every user-facing string in `{ en, pt }` (§7).

## Non-goals

- No voice UI (spec 006) beyond a disabled affordance that says what it will be.
- No trace *data* (spec 005) — the drawer renders its empty state.
- No session persistence (M9): the mock's session list is dropped rather than faked (§5).
- No auth screen.

## User-facing behavior

A visitor opens the app, sees the empty state with three suggestions, sends one, and watches a turn
unfold: reasoning summary (when the model supports it), a `microsoft_learn` card marked as running
**in Foundry**, a `get_current_datetime` card marked as running **here**, then the answer streaming
in, then a meta line with model, tokens and latency.

The settings surface shows which harness is live, so swapping `AGENT_HARNESS` is visible rather than
theoretical.

## Acceptance criteria

1. **AC1** — The app renders the three-column layout: sidebar, main column, trace panel, per the
   design's proportions, using imported Dataside tokens (no hand-copied hex values).
2. **AC2** — `POST /chat` is consumed with `fetch` + `ReadableStream` (not `EventSource`) and each
   SSE frame updates the view as it arrives.
3. **AC3** — Each of the nine `AgentEvent` types has a defined rendering; an unknown type is ignored
   without breaking the stream.
4. **AC4** — **A `tool_call` with `executor: "app"` is visually distinct from one with
   `executor: "foundry"`**, and an `mcp_call` is attributed to its `server_label` (M6, M7).
5. **AC5** — A tool card moves spinner → result, showing arguments while running and the result and
   duration when done.
6. **AC6** — The reasoning card is collapsible and streams. When the model produces no reasoning
   summaries, it shows why rather than sitting empty (§5).
7. **AC7** — A terminal `error` event renders as an error, not a stream that stops (M-gap).
8. **AC8** — Markdown renders with code blocks; the answer streams without re-parsing from scratch
   on every token.
9. **AC9** — A harness badge shows the value from `GET /config`.
10. **AC10** — Every user-facing string exists in `en` and `pt` (§7); no hardcoded prose in components.
11. **AC11** — No emoji anywhere in the UI (Dataside brand rule).
12. **AC12** — Below ~1100px the trace panel becomes an overlay drawer; the page never scrolls
    horizontally.
13. **AC13** — `frontend/` gates green: `npm run lint`, `npm test`, `npm run build`.

## Contract / data impact

The frontend's event types are a **mirror** of `ai/harness/_shared/contract.py` (§9). They move
together; a mismatch is a contract violation, not a frontend bug. `types/contract-parity.test.ts`
asserts the TypeScript union covers exactly the types `contract.py`'s `_SCHEMA` defines, and that
the `executor` values match.

## Open questions (resolved before implementation)

- [x] Do we ship the Poppins font files, or load from a CDN? → **Ship them**, and **three** cuts
      rather than two: the brand's trademark headline move needs 300 *and* 600, and body text needs
      400. `public/ds/fonts/` carries the three latin `.woff2` subsets under the filenames the
      vendored CSS already references. The `.ttf` italic faces are not shipped and the reason is
      recorded in `public/ds/README.md` — this UI renders no italic of its own, and a `.ttf` cut is
      roughly twenty times the weight of the subset.
- [x] The mock's session sidebar (M9) has nowhere to persist to. → **Keep the shell, one entry,
      honest label.** The entry reads "Current session" and the note under it says nothing is
      stored (§5).
- [x] Tailwind or plain CSS? → **Plain CSS with the imported tokens.** Tailwind would fight a design
      system that already defines its own scale.
- [x] Which markdown renderer? → `react-markdown` + `remark-gfm`, `highlight.js` for code.

## Decisions taken during implementation

- **The vendored tokens live in `public/ds/`, not `src/`.** Vite copies `public/` byte-for-byte
  instead of rewriting its `url()` references, so the design system's file needs no local edit to
  build — which is the only way "imported, never hand-edited" (§4) survives contact with a bundler.
  `index.html` links it.
- **The contract-parity test reads `contract.py`, not `GET /config`.** Same fact, same source of
  truth, and it fails on the commit that introduces the drift rather than needing a server.
- **A language toggle ships.** §7 requires both languages to exist; without a way to switch, the
  Portuguese half would be untestable by a reader and unreachable outside a `pt-BR` browser.
- **AC12 is covered by a rule test, not a rendered measurement.** jsdom applies no stylesheet, so
  `styles/layout.test.ts` asserts the grid and the breakpoint are declared. That is weaker than
  measuring, and is labelled as such in the test.

## Out of scope / deferred

- Voice overlay (spec 006) — the design exists and is not built here.
- Trace span bars with real data (spec 005).
