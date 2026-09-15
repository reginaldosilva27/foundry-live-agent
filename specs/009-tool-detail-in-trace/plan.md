# Plan: The tool call stays in the chat; its payload moves to the trace panel

> The HOW. Written after `spec.md` reached `clarified` on 2026-09-15.

## Approach

**One component splits into two renderings of the same `Activity`.** `ToolCard` stays exactly as it
is and keeps its tests — the voice overlay still uses it, and that is where the full detail lives
during a session. A new `ToolRow` renders the compact line the chat shows. Both read the same
`Activity` from `state/turn.ts` and share `EXECUTOR_TAG` and the executor labels, so the thing the
chat teaches cannot drift between the two (§4).

**The trace panel gains the payload.** It already receives a `Turn`; `turn.activities` is already
on it. The new section renders each call with its arguments and result — the same fields the card
showed, in the place where reading them is the point.

**Selection is two ids in `App`.** `{ turnId, callId }`: the meta line's *view trace* sets the turn,
a chat row sets both. The drawer resolves the turn from the message list and falls back to the
newest, which is what it does today. No new state shape anywhere else.

Alternatives rejected: a `variant` prop on `ToolCard` (one component with two layouts and a growing
set of conditionals); truncating the payload in the chat (§5 — a shortened result in two places is
worse than a whole one in the right place).

## Affected files

- `frontend/src/components/ToolRow.tsx` *(new)* — the compact line, as a button.
- `frontend/src/components/ToolRow.test.tsx` *(new)* — AC1, AC2, AC5.
- `frontend/src/panes/ActivityPanel.tsx` — renders rows, forwards the selection.
- `frontend/src/panes/TraceDrawer.tsx` — the activity section (AC3, AC5, AC6).
- `frontend/src/panes/TraceDrawer.test.tsx` *(new)* — AC3, AC6.
- `frontend/src/panes/Conversation.tsx` — passes the selection handler through.
- `frontend/src/App.tsx` — holds `{ turnId, callId }`, resolves which turn the drawer shows.
- `frontend/src/App.test.tsx` — AC4 end to end; the existing tool-card assertions move to rows.
- `frontend/src/i18n/strings.ts` — two keys (below).
- `frontend/src/styles/app.css` — the row, and the activity section in the panel.
- `README.md`, `README.pt-BR.md`, `docs/how-it-works/function-call-round-trip.md`, `CHANGELOG.md`,
  `specs/README.md`.

## Contract / data model changes (constitution §4)

None. No `AgentEvent`, no BFF, no harness. The documentation that describes the UI moves with it.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `trace.activityEmpty` | `This turn called no tools.` | `Este turno não chamou nenhuma ferramenta.` |
| `tool.openInTrace` | `Show this call in the trace panel` | `Mostrar esta chamada no painel de rastros` |

`turn.activityTitle` ("Agent activity" / "Atividade do agente") is reused for the panel's section
heading rather than adding a synonym.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 — no payload in the chat | the row renders neither arguments nor result | `components/ToolRow.test.tsx` |
| AC2 — name, executor, status in one row | the row's content and `data-executor` | `components/ToolRow.test.tsx` |
| AC3 — payload in the panel | the drawer shows arguments and result | `panes/TraceDrawer.test.tsx` |
| AC4 — pressing the row opens the panel there | click a row, assert the panel and the call | `App.test.tsx` |
| AC5 — a failed call | row reads failed; error text in the panel | `components/ToolRow.test.tsx`, `panes/TraceDrawer.test.tsx` |
| AC6 — a turn with no calls | the section says so | `panes/TraceDrawer.test.tsx` |
| AC7 — voice is unchanged | the existing voice tests, unedited | `App.voice.test.tsx` |

## Risks / trade-offs

- **Below the responsive breakpoint the panel is an overlay**, so pressing a row covers the chat.
  Acceptable: that is already how `Traces` behaves there.
- The chat loses at-a-glance argument values (`{"timezone":"America/Sao_Paulo"}`), which were nice
  in a demo. The row keeps the name and the executor, which is the part that carries the argument.
