# `frontend/` — the UI

React 19 + TypeScript + Vite, plain CSS, minimal dependencies. Built by
[spec 004](../specs/004-frontend-shell/spec.md).

## What lives here

| Column | Shows |
|---|---|
| **Sidebar** | Brand, the current session (nothing is persisted — see M9), the language toggle, and a mono footer naming the project, the model, and whether the AI Gateway is in the path |
| **Main** | Header (agent, harness badge, Voice and Traces toggles) · the conversation · the composer |
| **Trace panel** | The identifiers the run produced. Span bars arrive with spec 005 |

Inside a turn, `ActivityPanel` renders the reasoning card and every tool and MCP call in the order
the agent produced them — that is where the design puts the activity, not in a fourth column.

## The one thing to look at

**A tool the BFF executed and a tool Foundry executed do not look the same.** The mock this design
comes from drew them identically; `ToolCard` carries the difference three ways — a mono tag with
different text (`bff` / the MCP `server_label`), a left border in a different token, and a
`data-executor` attribute. Colour alone would fail a reader who cannot separate the two hues.

That distinction is constitution §8 made visible, and it is what this repository exists to show.

## Rules specific to this layer

- **No agent-loop logic** (§8) — the UI renders `AgentEvent`s. `state/turn.ts` is a pure reducer over
  an append-only event log; there is no state here that Foundry also holds.
- **`src/types/events.ts` is a mirror**, not a second contract (§9). `types/contract-parity.test.ts`
  reads `ai/harness/_shared/contract.py` and fails if the two drift.
- **Every user-facing string ships `{ en, pt }`** in `src/i18n/strings.ts` (§7). Two tests enforce it:
  one that both languages exist for every key, one that no component contains prose.
- **No emoji, no glyph icons.** Dataside brand rule, enforced by a test. Icons are SVG.
- **No colour is written here.** Every value is a token from the design system.
- The browser **never holds an Azure credential**. It talks to the BFF and to nothing else.

## The design system

`public/ds/colors_and_type.css` is a **verbatim copy** of the Dataside Design System's token file,
read through the `DesignSync` MCP on 2026-09-04. It is never hand-edited — when the design changes,
re-import it (§4). It lives under `public/` so Vite copies it byte-for-byte instead of rewriting its
`url()` references. See [`public/ds/README.md`](public/ds/README.md) and
[`../docs/design-system.md`](../docs/design-system.md).

## Running it

```bash
npm install
npm run dev          # http://localhost:5173, expects the BFF on :8000
```

`VITE_BFF_URL` overrides where the BFF is. The two are separate origins in development, which is why
`backend/app/main.py` names this one in its CORS allow-list.

## Gate

```bash
npm run lint && npm test && npm run build
```
