# Plan: The agent, inspected

> The HOW. Written after `spec.md` is `clarified`.

## Approach

**No new upstream call.** The recorded listing already carries every field this screen wants, for
all ten agents — spec 019 discovered that about `kind` and it holds for the whole definition. So
`GET /agents/{name}` is answered by fetching the same listing and projecting one row further. The
BFF gains a projection, not a data source.

Four decisions:

1. **`AgentDetail` is a second projection beside `AgentSummary`, not a replacement.** The listing
   screen wants ten cheap rows; the detail wants one rich one, including two thousand characters of
   instructions. Widening `AgentSummary` would put that on every row of the listing.
2. **Tool classification and executor attribution happen in the BFF, once.** A function tool carries
   *no* `type` field and an MCP tool carries `type: "mcp"` — classification by absence, which is
   exactly the kind of rule that must not be re-derived in TypeScript (§4). The executor uses the
   contract's existing vocabulary, `app` | `foundry`, rather than inventing a third word.
3. **Environment variables are dropped in the projection, not hidden in the view.** A field the
   browser never receives cannot leak from it. The recorded listing holds `KEY_VAULT_URI`.
4. **"Not reported" is a value, not an absence.** The projection distinguishes *the service said
   nothing* from *the service said empty*, so §5's rule is a property of the data and the view
   cannot quietly paper over it.

**Alternative rejected:** a per-agent upstream route (`GET /agents/{name}?api-version=v1`). It exists,
but it would be a second request answering a question the first already answered, and a second shape
to keep true.

## Affected files

**`backend/`**
- `app/agents.py` (+ tests) — `AgentDetail`, `ToolInfo`, `ContainerInfo`, `detail_of`, `find_detail`.
- `app/routers/agents.py` (+ tests) — `GET /agents/{name}`.

**`frontend/`**
- `src/types/agents.ts` — `AgentDetail`, `AgentTool`, mirroring the dataclasses (parity test).
- `src/state/route.ts` (+ test) — `{ name: 'agent'; agentName: string }` ↔ `/agents/{name}`.
- `src/state/agents.ts` (+ test) — `useAgentDetail(name)`, a read with the four states the listing
  already models: loading · ok · failed-with-code · absent.
- `src/panes/AgentDetail.tsx` (+ test) — the screen.
- `src/panes/AgentsScreen.tsx` — the card opens the detail.
- `src/App.tsx` — route → view.
- `src/i18n/strings.ts`, `src/styles/app.css`.

**Docs** — `docs/REFERENCES.md` (what the listing returns per kind), `docs/harness-comparison.md`.

## Contract / data model changes (§4)

| Contract | Source of truth | Moves with it |
|---|---|---|
| `GET /agents/{name}` | `AgentDetail` in `app/agents.py` | `frontend/src/types/agents.ts` + the existing parity test |
| Tool kind & executor | `app/agents.py` | nothing in TypeScript may re-derive it |
| Address scheme | `state/route.ts` | `App.tsx`, `AgentsScreen.tsx` |

```
GET /agents/foundry-live-agent
{ "name": …, "kind": "prompt", "version": "8", "version_status": "active",
  "model": "gpt-5.5", "harness": "prompt-agent", "selectable": true, "reason": "",
  "instructions": "…",                      // null = the service did not report it
  "tools": [ { "kind": "function", "name": "get_current_datetime",
               "description": "…", "parameters": "{…}", "executor": "app" },
             { "kind": "mcp", "name": "microsoft_learn", "server_label": "microsoft_learn",
               "server_url": "https://learn.microsoft.com/api/mcp",
               "require_approval": "never", "executor": "foundry" } ],
  "reasoning": { "summary": "detailed" },   // null when not reported
  "container": null }                       // hosted only: image · cpu · memory · protocols
```

## i18n strings (§7)

| key | en | pt |
|---|---|---|
| `agent.back` | All agents | Todos os agentes |
| `agent.instructions` | Instructions | Instruções |
| `agent.tools` | Tools | Ferramentas |
| `agent.reasoning` | Reasoning | Reasoning |
| `agent.reasoningSummary` | summary | resumo |
| `agent.container` | Container | Container |
| `agent.image` | image | imagem |
| `agent.cpu` | cpu | cpu |
| `agent.memory` | memory | memória |
| `agent.protocols` | protocols | protocolos |
| `agent.notReported` | not reported by the service | não reportado pelo serviço |
| `agent.executedByApp` | executed by this app | executada por este app |
| `agent.executedByFoundry` | executed by Foundry | executada pelo Foundry |
| `agent.schema` | parameters | parâmetros |
| `agent.approval` | approval | aprovação |
| `agent.notFound` | This project has no agent by that name. | Este projeto não tem um agente com esse nome. |

`agent.reasoning`, `agent.cpu` and `agent.container` are identical in both and join
`INTENTIONALLY_IDENTICAL` — they are the service's own vocabulary, and a reader matching the screen
against the portal wants the same word.

## Test strategy (§2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | `/agents/{name}` round-trips; the address renders the detail | `state/route.test.ts` · `App` test |
| AC2 | the projection carries every field from the **recorded** listing | `backend/tests/test_agents.py` |
| AC3 | a function tool projects name/description/schema; an MCP tool server label, URL, approval | `backend/tests/test_agents.py` · `panes/AgentDetail.test.tsx` |
| AC4 | executor is `app` for a function tool, `foundry` for MCP, and no TypeScript derives it | `backend/tests/test_agents.py` · source scan |
| AC5 | `testagentdemo` (no `tools` in the recording) projects `null`, and the screen says not reported | `backend` · `frontend` |
| AC6 | `reasoning` present for two recorded agents, `null` for the rest | `backend/tests/test_agents.py` |
| AC7 | instructions and each schema have a copy control | `panes/AgentDetail.test.tsx` |
| AC8 | a failure renders the translated code, never an empty detail | `panes/AgentDetail.test.tsx` |
| AC9 | choosing from the detail selects and returns to the chat, as the card does | `App` test |
| AC10 | rendering the detail issues no non-GET request | `App` test |
| AC11 | the hosted agent projects image/cpu/memory/protocols and **no env var**; `KEY_VAULT_URI` appears nowhere in the response | `backend/tests/test_agents.py` |
| AC12 | every key in `en` + `pt` | `i18n/strings.test.ts` (exists) |

## Risks / trade-offs

- **Instructions are untrusted text from a project we do not own.** They are rendered as text, never
  as Markdown or HTML — eight of these agents were written by somebody else.
- **The detail re-fetches the listing.** Ten agents is a small payload and the listing is already on
  the path of every turn that names an agent; a cache would be a second copy of the service's state
  to keep true (§8).
- **An agent name in a path needs encoding.** `route.ts` already encodes and the existing
  round-trip test covers a value that needs it.
