# Plan: Frontend shell

| | |
|---|---|
| **Spec** | [spec.md](spec.md) |
| **Status** | implemented |

## Approach

React 19 + TypeScript + Vite. Plain CSS with the Dataside tokens imported from the design project.
Minimal dependencies: `react-markdown`, `remark-gfm`, `highlight.js`. Vitest + React Testing Library.

```
frontend/
  public/ds/             IMPORTED from the design system — never hand-edited
    colors_and_type.css    the tokens, verbatim; linked from index.html
    fonts/                 the three latin Poppins cuts the CSS references
  src/
    styles/app.css       our styles; every value is a token, no hex anywhere
    types/events.ts      mirror of the §9 contract
    state/sse.ts         frame parser (buffers partial chunks)
    state/turn.ts        the reducer: event log -> renderable turn
    state/markdown.ts    settled blocks vs. the live tail (AC8)
    hooks/useAgentStream.ts  fetch + ReadableStream -> AgentEvent[]
    hooks/useConfig.ts   GET /config
    panes/               Sidebar · Header · Conversation · ActivityPanel · Composer · TraceDrawer
    components/          ToolCard · ReasoningCard · ErrorCard · MessageBubble · HarnessBadge ·
                         MetaLine · Markdown · Icon
    i18n/strings.ts      { en, pt }
```

`ActivityPanel` renders inside a turn rather than as a fourth column — that is where the design puts
it. The three *columns* are sidebar, main and trace panel (AC1).

### The stream hook

`EventSource` is GET-only and `/chat` is a POST, so the hook reads the response body:

```
fetch -> body.getReader() -> TextDecoder -> split on \n\n -> parse frame -> reduce
```

State is an **append-only event log** plus a derived view. That mirrors the backend exactly, keeps
"what happened" separable from "how it looks", and makes the reducer trivially testable without a
DOM.

### Rendering the distinction that matters (M6)

```
┌──────────────────────────────────────────────────────────┐
│ ⟳  get_current_datetime   {"timezone":"America/…"}   bff │   executor: app
├──────────────────────────────────────────────────────────┤
│ ✓  microsoft_learn        search: hosted agents  foundry  │   mcp_call
└──────────────────────────────────────────────────────────┘
```

A small mono tag, plus a left border in a different token. Not a colour alone — that would fail for
anyone who cannot distinguish them.

### Corrections applied from `docs/design-system.md`

M1 SSE not WSS in the footer copy · M2 model label carries the connection prefix · M3 `eastus` ·
M4 drop `temperature` from the trace panel · M5 our real tool names · M6 executor distinction ·
M7 MCP attributed to `server_label` · M8 voice labelled by agent, not raw model · M9 no faked
session history.

Plus the three gaps the mock does not cover: the harness badge, `error` rendering, and responsive
behaviour below ~1100px.

## Contract / data impact

`types/events.ts` mirrors §9. `types/contract-parity.test.ts` compares it against the `_SCHEMA`
table in `ai/harness/_shared/contract.py` — the source of truth itself, read off disk — so drift
fails CI rather than surfacing as a blank card, and does so without standing a server up.

## i18n impact

Central to this spec (§7). `strings.ts` holds `{ en, pt }`; a lint rule plus a test forbid literal
prose inside components.

## Test strategy

| AC | Test |
|---|---|
| AC2, AC3 | Reducer tests over recorded event sequences — no DOM needed |
| AC4 | `renders app-executed and foundry-executed tools differently` |
| AC5, AC6, AC7 | Component tests per card state |
| AC9 | Badge reflects `/config` |
| AC10 | Every key in `en` exists in `pt`; no bare string literals in `panes/` or `components/` |
| AC11 | Emoji regex over `src/` |
| AC13 | Gates |

## Risks

- **Token drift.** `tokens.css` is imported; a hand-edit forks the design system (§4). A header
  comment says re-import, don't edit.
- **The reasoning card being empty for an invisible reason.** With `gpt-4o` behind the gateway there
  are no reasoning summaries at all, so AC6 requires the card to *explain itself* rather than render
  an empty box (§5).
