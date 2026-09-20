# foundry-live-agent — PLAN

> Status (2026-09-20): **48 of 49 specs done** (000–048), every acceptance criterion met; 045 is
> blocked by design, on a retention decision rather than on a document. **050 specs in total**: 049
> (Foundry IQ) is `draft` and awaiting its clarify step. Phases 0–3 closed and
> Phase 4 delivered its hosted agent (spec 018) — see §6. Chat, voice, tracing and the whole UI run
> against a live Foundry project. Voice findings observed 2026-09-15 — see §9 for what the docs got
> wrong. **`specs/README.md` is the live index**; this file is the architecture record behind it.
> Foundry API details verified against learn.microsoft.com on **2026-09-04** — every URL and API
> version is recorded in [docs/REFERENCES.md](docs/REFERENCES.md).
> Engineering practices inherited from
> [reginaldosilva27/agentic-coding-template](https://github.com/reginaldosilva27/agentic-coding-template).

An open-source reference project showing **Microsoft Foundry Agent Service end to end**: the agent
runs *in* Foundry, and this repository is the application built *around* it — identity, streaming,
tracing, voice and a UI — with **swappable agent harnesses** behind one contract.

Author: Reginaldo Silva (Data Engineer / AI Engineer, Microsoft MVP). License: MIT.

---

## 0. What the docs changed (read this first)

The 2026 Foundry platform differs from most tutorials and from model training data. These findings
shaped the plan; several contradict the original brief, and each is called out where it matters.

| Area | What is true today | Impact |
|---|---|---|
| Agent API | **Responses API (Agents v2)**. The Assistants API (Agents v0.5/v1) is the *previous* generation. Terminology is now **Conversations, Items, Responses, Agent Versions** — not Threads, Messages, Runs, Assistants. | All backend code targets Responses. |
| Python SDK | `azure-ai-projects>=2.3.0` (**2.x**), explicitly *incompatible with 1.x*. One `AIProjectClient` against one project endpoint. | Pin `>=2.3.0`. |
| API versioning | Moved from monthly `api-version` params to **v1 stable routes** (`/openai/v1/…`, `api-version=v1`). | No date-based api-version for agents. |
| `agent.yaml` | **Deprecated.** `agent.manifest.yaml` / `agent.yaml` (AgentSchema) are superseded by a single `azure.yaml` as of the Foundry `azd` extensions (`azure.ai.agents` 1.0.0-beta.1). | See §4.1 — changes the harness contract the brief asked for. |
| Tools | A **Toolbox** (curated tools behind one managed MCP endpoint) is now the recommended way to attach tools. But **function calling is explicitly "client-side execution" and cannot live in a Toolbox.** | Confirms the core design: Foundry emits the call, *our BFF executes it*. |
| Voice Live | **WebRTC is recommended for browser clients**, not raw WebSocket. In WebRTC mode, tool/function-call events route to the **server's** control WebSocket while audio flows peer-to-peer to the browser. | See §4.4 — better than the proxy design, and removes the token-minting problem. |
| AI Gateway | A **Foundry resource-level** feature (Manage → AI Gateway) that creates/associates an **APIM v2-tier** instance, enabled per project. | See §4.3 and Open Question O-4 (no documented IaC path). |

---

## 1. Core design principle

> **The agent runs in Foundry. This repo builds the app around it.**

The frontend and backend contain **no agent-loop logic** — no tool selection, no model
orchestration, no planning. The backend is a **BFF (Backend For Frontend)** whose entire job is:

1. **Identity** — Entra ID via `DefaultAzureCredential`; the browser never holds an Azure credential.
2. **Streaming** — normalise Foundry's Responses event stream into a typed `AgentEvent` protocol, re-emit as SSE.
3. **Tool execution** — run the *client-side function tools* Foundry asks us to run, and submit their output.
4. **Trace lookup** — query Application Insights for the spans of a run.
5. **Voice signalling** — hold the Voice Live control channel; the browser gets audio only.

This separation is the repository's main educational point and must stay visible in the folder
structure and the docs. A reader should point at any file and say *"Foundry does this"* or
*"the app does this."* It is encoded as **constitution §8**, so it is enforced, not merely intended.

---

## 2. How we build here (inherited practices)

This repo starts from `agentic-coding-template` and keeps its discipline **unchanged**:

- **Spec-first (SDD).** No feature code without a spec under `specs/NNN-name/{spec,plan,tasks}.md`.
  Flow: `specify → clarify (grilling) → plan → tasks → implement (TDD) → verify`.
- **Test-first (TDD).** Every acceptance criterion becomes a failing test before implementation.
  This suits the project unusually well: the `HarnessAdapter` contract tests are written **once**
  against recorded fixtures and later prove the LangGraph harness without modification.
- **Done means gates green.** Per-layer gates mirrored in `.github/workflows/ci.yml` and the
  `verify-gates` skill.
- **One source of truth (§4).** Docs move with the code in the same change.
- **Agent guidance in sync (§6).** `CLAUDE.md` ↔ `AGENTS.md` ↔ `.claude/` ↔ `.codex/`.
- **Bilingual (§7) — adopted.** Public UI with a Brazilian audience, so every user-facing string
  ships `{ en, pt }`, and the README is mirrored in `README.pt-BR.md`.

**Layer mapping.** The template's layers are `backend/ · ai/ · frontend/ · infra/`. The brief asked
for a top-level `harness/`. These reconcile as **`ai/harness/`** — the harnesses are the "agents,
prompts, RAG" layer, and the harness separation stays visually intact.

**Gate adjustments for this stack** (the template says to adjust per layer):

| Layer | Gate |
|---|---|
| `backend/` | `ruff check . && ruff format --check . && pytest -q` |
| `ai/` | `ruff check . && pytest -q` |
| `frontend/` | `npm run lint && npm test && npm run build` |
| `infra/` | **Bicep, not Terraform** → `az bicep build --file main.bicep && az bicep lint --file main.bicep` |

`justfile` recipes **delegate** to these exact commands rather than restating them (§4).

---

## 3. Repository layout

```
foundry-live-agent/
├── .specify/constitution.md     Principles + gates + amendment process (the law)
├── specs/                       SDD decision record — 001…006 (§6)
│   ├── README.md                Workflow + status index
│   └── _template/               spec.md · plan.md · tasks.md
├── .claude/                     skills (new-spec, grilling, verify-gates) + review subagents
├── .codex/prompts/              Twins of the above for Codex
├── infra/                       Bicep + azd (azd up / azd down)
│   ├── main.bicep               Foundry resource, project, model deployment, App Insights
│   └── modules/                 foundry.bicep · monitoring.bicep · gateway.bicep (O-4)
├── ai/                          THE AGENT LAYER — harnesses + tools
│   ├── harness/
│   │   ├── _shared/
│   │   │   ├── contract.py      HarnessAdapter Protocol + AgentEvent types  ← built first
│   │   │   ├── agent_spec.py    Loader/validator for our agent.yaml (§4.1)
│   │   │   └── tools/           The client-side function tools, implemented ONCE
│   │   │       ├── datetime_tool.py     get_current_datetime(timezone)
│   │   │       ├── knowledge_tool.py    lookup_knowledge(query) — swappable for Foundry IQ
│   │   │       ├── web_search_tool.py   search_web(query) — swappable search backend
│   │   │       ├── registry.py          name -> (schema, callable)
│   │   │       └── knowledge/           local markdown corpus
│   │   ├── prompt-agent/        ← IMPLEMENTED THIS PASS
│   │   │   ├── agent.yaml       Agent definition as code
│   │   │   ├── adapter.py       PromptAgentAdapter(HarnessAdapter)
│   │   │   ├── events.py        Responses stream -> AgentEvent normaliser
│   │   │   └── README.md        What Foundry runs vs. what the harness runs
│   │   └── langgraph/           ← SCAFFOLD ONLY (README + stubs + TODOs, no working code)
│   ├── tests/
│   │   ├── fixtures/            Recorded Foundry event streams (JSONL)
│   │   ├── test_contract.py     Parameterised over adapters — LangGraph reuses it verbatim
│   │   └── test_events.py
│   └── scripts/apply_agent.py   agent.yaml -> Agent Service SDK (azd up leaves a working agent)
├── backend/                     FastAPI BFF (Python 3.12, async)
│   ├── app/
│   │   ├── main.py              App factory, lifespan, OTel wiring
│   │   ├── routers/             chat.py · traces.py · voice.py · config.py
│   │   ├── harness_factory.py   AGENT_HARNESS env var -> adapter instance
│   │   ├── sse.py               AgentEvent -> text/event-stream
│   │   ├── tool_executor.py     Runs ai/harness/_shared/tools by name
│   │   └── telemetry.py         Azure Monitor OTel exporter
│   └── tests/                   test_tools.py · test_routers.py · test_smoke.py (env-gated)
├── frontend/                    React + TypeScript + Vite, minimal deps
│   └── src/
│       ├── panes/               Conversation · ActivityPanel · TraceDrawer
│       ├── voice/               WebRTC session, mic capture, playback, barge-in
│       ├── hooks/               useAgentStream (SSE) · useVoiceSession
│       ├── i18n/strings.ts      { en, pt } — constitution §7
│       └── components/          Markdown renderer · SettingsPanel · HarnessBadge
├── docs/
│   ├── architecture.md          What runs in Foundry vs. in this app
│   ├── harness-comparison.md    Prompt agent vs. hosted agent (LangGraph = "planned")
│   ├── development-workflow.md  SDD + TDD contributor companion
│   ├── how-it-works/            streaming-events · function-call-round-trip ·
│   │                            tracing-and-gateway · voice-live-lifecycle
│   └── REFERENCES.md            ✅ written — doc URLs + API versions actually used
├── .github/workflows/           ci.yml (4 layer jobs) · release.yml
├── CLAUDE.md  AGENTS.md         One rule set, two front doors (§6)
├── README.md  README.pt-BR.md   English + Português 🇧🇷
├── CHANGELOG.md  CONTRIBUTING.md  SECURITY.md  LICENSE (MIT)
├── justfile  .env.example  .editorconfig
└── PLAN.md                      This file — the pre-spec architecture record
```

**Why the tools live under `ai/harness/_shared/tools/`:** they belong to the *agent*, not the web
app. Both harnesses declare and execute the same two functions. The location makes it structurally
obvious that swapping the harness does not change the tools.

---

## 4. Architecture — this pass (prompt-agent harness)

### 4.1 Foundry side, as code

A **prompt agent** created via `project.agents.create_version(...)` with a
`PromptAgentDefinition(model=…, instructions=…, tools=[…])`, carrying four tools:

| Tool | Type | Who executes it |
|---|---|---|
| `microsoft_learn` | Remote MCP (`https://learn.microsoft.com/api/mcp`, no auth) | **Foundry** |
| `get_current_datetime(timezone)` | Function | **Our BFF** |
| `lookup_knowledge(query)` | Function | **Our BFF** |
| `search_web(query)` | Function (Tavily — the one API key in the project) | **Our BFF** |

The function tools are the teaching moment: **Foundry emits the call and stops. If the BFF does not
return the output, the run hangs and expires after 10 minutes.**

**Model:** default `gpt-5.4` — GA, unrestricted access, reasoning summaries, tool calling on the
Responses API, and *interleaved thinking* (visible output before and between reasoning), which makes
the Activity panel genuinely interesting. Configurable via `FOUNDRY_MODEL_DEPLOYMENT`. Reasoning
requested with `reasoning={"effort": "medium", "summary": "auto"}` (`concise` unsupported on GPT-5).

**On `agent.yaml` — deliberate deviation.** Foundry's own `agent.yaml` (AgentSchema) is *deprecated*,
and its replacement `azure.yaml` describes **hosted** agents, not prompt agents. So we keep
`ai/harness/<h>/agent.yaml` as **our own small, documented schema** (`schema_version:
foundry-live-agent/v1`), applied by `ai/scripts/apply_agent.py` through the Agent Service SDK. This
keeps "agent definition as code" without teaching a schema Microsoft retired;
`docs/harness-comparison.md` explains the deprecation and shows both files side by side. Since
**spec 018** the `azure.yaml` is real: `ai/azure.yaml`, generated from
`ai/harness/langgraph/agent.yaml` so the two cannot disagree (§4).

**Tools: direct integration, not a Toolbox.** Function calling *cannot* live in a Toolbox, so a
Toolbox would split our three tools across two mechanisms for no pedagogical gain. Toolbox is
documented as the scaling path.

### 4.2 Backend (FastAPI BFF)

| Endpoint | Purpose |
|---|---|
| `POST /chat` | Streams via the selected `HarnessAdapter`, executes function tools, re-streams SSE |
| `GET /traces/{response_id}` | Log Analytics query → span tree (agent run > model calls > tool calls) with durations, tokens, APIM correlation |
| `POST /voice/session` | Establishes the Voice Live control channel (§4.4) |
| `GET /config` | Harness, gateway route, model alias, agent version — feeds the settings panel |
| `GET /health` | Liveness |

Conversation continuity uses the **`conversation` ID** (`openai.conversations.create()`) — the
current documented mechanism for multi-turn prompt agents.

**The function-call round trip**, verbatim from the docs:

```python
# 1. Foundry returns an output item of type "function_call"
for item in response.output:
    if item.type == "function_call":
        result = REGISTRY[item.name](**json.loads(item.arguments))
        outputs.append(FunctionCallOutput(
            type="function_call_output", call_id=item.call_id, output=json.dumps(result)))

# 2. We submit it back on the same conversation
response = openai.responses.create(input=outputs, conversation=conversation.id,
    extra_body={"agent_reference": {"name": agent.name, "type": "agent_reference"}})
```

### 4.3 AI Gateway (APIM) — corrected

> **⚠ This section was wrong in the first draft and is corrected here.** The earlier claim, that all
> agent and model traffic routes through the AI Gateway, does not hold. Constitution §10 is what
> caught it. The correction is recorded in `docs/REFERENCES.md`.

There are **two different things both called "AI Gateway"**, and the difference decides our config:

| | **Project AI Gateway** (Manage → AI Gateway) | **Bring your own model (BYOM)** |
|---|---|---|
| What it governs | **Direct model calls** from clients | **The agent's own inference** |
| Does agent inference flow through it? | **No** | **Yes** |
| How it is set up | Associate an APIM v2 instance with the Foundry resource, add projects | An *Admin-connected model* connection of type **Azure API Management** |
| What the agent's model is called | `gpt-5.4` | **`<connection-name>/<model-name>`** |

This project uses **the second one**, because the whole point is that the *agent's* traffic is
governed. Concretely, against `https://ai-gateway-foundry-analytics-demo.azure-api.net`:

1. **Manage → Resource details → Admin-connected models → Add → Azure API Management.**
2. **Base URL** = the gateway **base path only**. Foundry appends the route itself — it calls
   `chat/completions` on whatever you give it. So a gateway exposing the OpenAI v1 shape takes
   `https://ai-gateway-foundry-analytics-demo.azure-api.net/<api-base-path>/openai/v1`.
3. **Auth** — either the APIM **subscription key** (portal → APIM → APIs → Subscriptions), or
   **Managed Identity**, which is the better choice here: enable a managed identity on the project,
   then validate it in APIM with a `validate-azure-ad-token` inbound policy. That keeps the "no keys
   anywhere" property the rest of the repo has.
4. **Model configuration** — add the deployment name the gateway routes to.
5. The agent is then created with `model="<connection-name>/gpt-5.4"`.

**The connection already exists** (confirmed 2026-09-04, Manage → Resource details →
Admin-connected models): name **`foundry-analytics-demo`**, type *Azure API Management*, exposing
one model — **`gpt-4o`**. So the agent's model is **`foundry-analytics-demo/gpt-4o`**, and there is
no reason to create the `apim-analytics-demo` connection I had proposed. `FOUNDRY_GATEWAY_CONNECTION_NAME`
and `FOUNDRY_MODEL_DEPLOYMENT` must agree or Foundry answers `model not found`.

> The connection name matching the Foundry resource name makes `foundry-analytics-demo/gpt-4o` read
> like *resource/model* rather than *connection/model*. It is only cosmetic and not worth churn.

**`gpt-4o` is not a reasoning model, and that costs us a feature.** Reasoning summaries and
interleaved thinking — the reason `gpt-5.4` was chosen — do not exist on GPT-4o. On the gateway path
the `reasoning_summary` event never fires and the activity panel's reasoning card stays empty. Three
ways out, in order of preference:

1. **Expose a GPT-5.x model on the same connection.** The wizard accepts several models per
   connection, so this keeps the gateway *and* the reasoning summaries. Recommended.
2. Accept `gpt-4o`, and have the harness README say plainly that this path has no reasoning
   summaries — rather than shipping a panel that is empty for reasons nobody can see (§5).
3. Run the agent on a plain `gpt-5.4` deployment, which bypasses the gateway entirely. Defeats the
   point of the exercise.

This also partly settles **O-9**: on this connection the question is moot, because the model cannot
produce reasoning summaries in the first place. Whether they survive the `chat/completions` hop stays
open until a GPT-5.x model sits behind the gateway.

**Constraints this imposes** (all from the BYOM page, all worth knowing before writing code):

- **The gateway must speak OpenAI-compatible `chat/completions`.** That is the protocol between
  *Foundry and your APIM* — our BFF still calls the *Responses API* against the project endpoint.
  Two different hops; don't confuse them.
- The page states: *"Only prompt agents in the Agent SDK support this feature. The Response API isn't
  supported at present."* Read in context, that constrains the Foundry→gateway hop, not our
  BFF→Foundry hop — the page's own walkthrough uses `responses.create()` with an `agent_reference`.
  **This reading is an assumption and is Open Question O-8.**
- Supported tools through BYOM include **Functions** and **MCP** — both of ours. Good.
- **Reasoning summaries are a Responses-API feature.** Whether they survive a `chat/completions` hop
  to a BYOM model is **not documented**. This is a direct risk to the Agent activity panel — see O-9.

**Unchanged and still true:** the gateway does **not** log tool traces (those come only from Foundry
tracing), and **Voice Live never passes through any gateway**.

### 4.4 Voice Live — revised design (deliberate deviation)

The brief proposed `POST /voice/token` minting a browser credential, with a WebSocket proxy fallback.
The docs point to a better third option: **Voice Live over WebRTC**, with three channels —

1. **WebSocket control channel** — *server-side*: SDP exchange, `session.update`, **and all
   tool/function-call events**, which the docs say are routed here "so they can reach your backend
   for processing."
2. **WebRTC media track (RTP)** — browser ↔ Voice Live, peer-to-peer audio, lower latency than TCP.
3. **WebRTC data channel** (`voice-live-events`) — VAD, transcripts, response lifecycle → the browser.

Strictly better for us: **no Azure credential ever reaches the browser**, audio does not transit our
server, and function tool calls arrive on the same backend path the text chat already uses — so
`tool_executor.py` is shared between text and voice, and the Activity panel keeps working in voice.

Voice Live attaches to the **same prompt agent** via `agent_name` + `project_name` (+ optional
`agent_version`, `conversation_id`), **Entra-only — key auth is unsupported in agent mode**. One
definition, one tool set, one trace store, two modalities.

### 4.5 Frontend

Three panes: **Conversation** (streaming markdown + code blocks) · **Agent activity** (live reasoning
summaries, tool/MCP calls with arguments and results, token usage) · **Trace drawer** (span tree with
durations). Plus voice mode (push-to-talk / continuous, barge-in, dual transcript, visual state) and
a settings panel with a **harness badge** so the swap is visible to viewers. All strings `{ en, pt }`.

### 4.6 Stack decisions

Backend is Python, as specified. The frontend stack was left to me; these are the picks and why.

| Choice | Pick | Why |
|---|---|---|
| Frontend framework | **React 19 + TypeScript + Vite** | Specified; Vite for fast dev and a plain build |
| Styling | **Plain CSS with custom-property design tokens** | The Dataside design system arrives as `colors_and_type.css` from Claude Design. Tokens drop straight in. Tailwind or a component library would fight it. |
| State | **React state + a small typed store** | The only real state is an append-only event log. Redux would be ceremony. |
| Streaming transport | **`fetch` + `ReadableStream`**, not `EventSource` | `EventSource` is GET-only; `/chat` is a POST |
| Markdown | **`react-markdown` + `remark-gfm`** | Minimal deps, streaming-friendly |
| Syntax highlighting | **`highlight.js`** | Smaller than Shiki for a chat surface |
| Tests | **Vitest + React Testing Library** | Vite-native; RTL asserts behaviour, not internals (§2) |
| Voice | **Native `RTCPeerConnection` + `getUserMedia`** | No SDK; the WebRTC flow is ~40 lines and the point is to *show* it |

Backend: **FastAPI + `uvicorn`**, `azure-ai-projects>=2.3.0`, `azure-identity`,
`azure-monitor-opentelemetry`, `httpx`. Tests with `pytest` + `pytest-asyncio`. Lint/format `ruff`.

---

## 5. The harness contract (built first — it shapes everything)

```python
class AgentEvent(TypedDict):     # discriminated on "type"
    type: Literal["reasoning_summary", "text_delta", "tool_call", "tool_result",
                  "mcp_call", "usage", "trace_ids", "error", "done"]

class HarnessAdapter(Protocol):
    async def stream_response(self, messages, conversation_state) -> AsyncIterator[AgentEvent]: ...
    async def submit_tool_output(self, call_id: str, output: str, conversation_state) -> None: ...
    def voice_attachment_params(self) -> VoiceAttachment: ...
```

Selected by `AGENT_HARNESS=prompt-agent|langgraph`. The `AgentEvent` protocol is **constitution §9**:
one source of truth, changed only through a spec.

**Event mapping** (Responses stream → `AgentEvent`; ⚠ = verified against a live stream, see O-1):

| Foundry event | `AgentEvent` |
|---|---|
| `response.output_text.delta` | `text_delta` |
| `response.reasoning_summary_text.delta` ⚠ | `reasoning_summary` |
| `response.output_item.added` (`function_call`) + `response.function_call_arguments.delta/.done` | `tool_call` |
| our executor's return value | `tool_result` |
| `response.mcp_call.*` ⚠ | `mcp_call` |
| `response.completed` | `usage`, then `done` |
| `response.failed` / `error` | `error` |

**Tests target the contract, not the implementation.** `ai/tests/test_contract.py` is parameterised
over adapters and driven by recorded JSONL fixtures, so the LangGraph adapter is later developed
against the identical suite. This is the clearest payoff of TDD here, and why the contract is spec 001.

### 5.1 `ai/harness/langgraph/` — scaffold only, documented not implemented

To be written in its README with no working code: LangGraph graph packaged as a Foundry **hosted
agent** container exposing the **Responses** protocol; model calls via the Responses API through the
AI Gateway; Foundry-side tools (MCP, later Foundry IQ) declared in the Responses call or a Toolbox;
**Postgres checkpointer** for graph state (noting hosted agents also persist `$HOME` + `/files` per
session with a 5–60 min idle timeout, so document which state lives where); registered/versioned via
`azure.yaml` + `azd`; Voice Live attached to the hosted agent, with a fallback of a thin prompt agent
invoking the hosted agent as a tool (**chat-supervisor pattern**). Plus a note that
`ai/harness/agent-framework/` may be added later as a third comparison point.

---

## 6. Phases → specs

Each phase is independently demoable and becomes one or more numbered specs. **Spec 000 is the only
one that does not need approval of the architecture**, since it is the inherited template itself.

| Spec | Phase | Deliverable | Demo |
|---|---|---|---|
| **000** ✅ | 0 | Scaffold `agentic-coding-template` into the repo: constitution, `specs/`, `CLAUDE.md`/`AGENTS.md`, `.claude`/`.codex`, CI (Bicep-adjusted), CHANGELOG/CONTRIBUTING/SECURITY, `README` + `README.pt-BR` | **Done** — gates green by clean skip on the empty repo |
| **001** ✅ | 1 | `HarnessAdapter` + `AgentEvent` contract + fixture-driven contract tests | Tests pass against a stub adapter |
| **002** ✅ | 1 | Prompt-agent harness: `agent.yaml`, `apply_agent.py`, the 3 tools | `just agent` leaves a working agent in Foundry |
| **003** ✅ | 1 | BFF `/chat` streaming + SSE + function-call round trip + `/config` | Question forcing a Learn MCP lookup *and* a function call |
| **004** ✅ | 1 | Frontend: three panes, streaming markdown, activity panel, harness badge — built on the **Dataside design system** imported from Claude Design | **Done** — the shell runs against the BFF; the full Phase 1 demo waits on a model deployment (spec 002, pass 2) |
| **005** ✅ | 2 | Trace drawer + gateway correlation + usage/cost display | Open the drawer, see the span tree with durations and tokens |
| **006** ✅ | 3 | Voice mode via Voice Live on the same prompt agent | Speak, interrupt mid-sentence, watch a tool call fire during voice |
| **018** ✅ | 4 | **Hosted agent harness** — the second harness behind the same contract, a LangGraph graph run by Foundry as a container | **Done** — `docs/harness-comparison.md`, measured |
| **007–017, 019–048** ✅ | 3–4 | Everything the table above does not name: voice transcript and spoken answers, the trace panel, the agent picker, the whole UI backlog, the comparison screen | See [`specs/README.md`](specs/README.md) — the live index, one row per spec |
| **049** 📝 | 4 | **Foundry IQ as a knowledge source** — specced 2026-09-20, `draft`. The doc read moved the goalposts: Foundry IQ attaches as an **MCP** tool, so "replacing `lookup_knowledge`" would delete one of only two app-executed round trips | — |
| — | 4 | **Still not implemented.** More MCP tools (Databricks Genie, Azure DevOps), publish to M365 Copilot / Teams | — |

**This table is the original phase plan, kept as the record of it.** It stops naming specs
individually at 006 because after that the work stopped being phase-shaped — the numbered index in
[`specs/README.md`](specs/README.md) is where execution order and status actually live (§4).

Per the template, each spec goes through **grilling (clarify)** before its plan — which is where the
open questions below get resolved, one at a time.

---

## 7. Open questions

**Eight of the nine are answered.** Each was closed by a spike or a doc read and the *answer* lives
in [`docs/REFERENCES.md`](docs/REFERENCES.md), with its date and its evidence — this table says
which, and does not restate them (§4). Only **O-4** is still open.

| # | Question | Where it landed |
|---|---|---|
| **O-1** | Exact streaming event names for **reasoning summary** and **MCP call** deltas aren't in the docs I read. | ✅ **Answered in full** — 21 distinct event types, mapped and tested. `REFERENCES.md`, spike 2026-09-15. |
| **O-2** | Does Voice Live **agent mode** work over the **WebRTC** `/calls` endpoint, or is agent mode WebSocket-only? Docs cover each separately. | ✅ **Answered: yes**, agent mode works over WebRTC — the full handshake completed. `REFERENCES.md`, 2026-09-15. The endpoint exists only on `api-version=2026-01-01-preview`. |
| **O-3** | `require_approval` for the Learn MCP tool — docs consistently show `"always"`, which adds an approval round trip. Is `"never"` accepted? | ✅ **Answered: `never` is accepted.** Zero approval events across 441 recorded ones. `ai/harness/_shared/agent_core.yaml` declares it. |
| **O-4** | **AI Gateway has no documented Bicep/azd path** — it is a portal flow that creates/associates an APIM v2 instance. | ⛔ **Still open** — the only one. No Bicep/azd path is documented for the AI Gateway; it remains a portal flow, and §5 forbids shipping IaC nobody could verify. `REFERENCES.md`. |
| **O-5** | Region. Voice Live, hosted agents, HD voices and gateway tiers have **different** region lists. | ✅ **Settled: `eastus2`**, which serves Voice Live for this resource. `REFERENCES.md`, 2026-09-15. |
| **O-8** | The BYOM page says *"The Response API isn't supported at present."* I read that as constraining the **Foundry→gateway** hop (which must be `chat/completions`), not our **BFF→Foundry** hop — the page's own sample uses `responses.create()`. If that reading is wrong, the prompt agent cannot be driven by the Responses API while on a BYOM model, and the whole streaming design changes. | ✅ **Answered: yes.** `responses.create(stream=True)` with an `agent_reference` drives a prompt agent end to end. *Caveat:* it ran on a plain deployment; the `<connection>/<model>` BYOM hop is still unverified. `REFERENCES.md`. |
| **O-9** | **Do reasoning summaries survive the BYOM hop?** | ✅ **Answered: yes, but only from the agent definition** — and `summary: auto` is not enough, so it says `detailed`. `REFERENCES.md`. |
| **O-7** ✅ | **Frontend design source.** | **Settled.** Design read via `DesignSync` on 2026-09-04 and recorded in [`docs/design-system.md`](docs/design-system.md), together with nine points where the mock and the implementation disagree. Spec 004 unblocked. |
| **O-6** | Voice Live **api-version is genuinely ambiguous**: `2026-04-10` (WS how-to), `2026-01-01-preview` (WebRTC + agent samples), `2026-06-01-preview` (a reference page), `2026-07-15` (gates Live-Reference AEC). Docs don't say which is current. | ✅ **Settled by pinning both.** `2026-01-01-preview` for the WebRTC `/calls` endpoint — the only one that serves it — and `2026-04-10` for plain WebSocket. Both in `.env.example`. |

---

## 8. Deliberate deviations from the brief

Each is a considered choice with a documented reason. Say the word and I'll revert any of them.

| # | Brief said | Plan does | Why |
|---|---|---|---|
| **D-1** | `agent.yaml` per harness | Our own schema, clearly labelled as ours | Foundry's `agent.yaml` is **deprecated** (§4.1) |
| **D-2** | `POST /voice/token` minting a browser credential | **WebRTC**, BFF holds the control channel | No credential reaches the browser; lower latency; tool calls land on the existing backend path (§4.4) |
| **D-3** | Tools on the agent | Direct declaration, **not** a Toolbox | Function tools **cannot** live in a Toolbox (§4.1) |
| **D-4** | README with a PT-BR section at the end | Separate **`README.pt-BR.md`** | Matches the template's own convention and language switcher |
| **D-5** | Top-level `harness/` | **`ai/harness/`** | Reconciles the brief's separation with the template's layer model (§2) |
| **D-6** | — | **Adopt constitution §7** (bilingual UI strings) | Public UI, Brazilian audience |

---

## 9. Ground rules honoured

- **Zero secrets.** `.env.example` placeholders only; `DefaultAzureCredential` everywhere; the browser never holds an Azure credential (§4.4).
- **One documented command per service** via `justfile`, delegating to the canonical gate commands.
- **Code and comments in English.** README in English + `README.pt-BR.md`. MIT license.
- **Every doc URL and API version recorded** in [`docs/REFERENCES.md`](docs/REFERENCES.md) ✅ written.
- **No Foundry API written from memory** — encoded as constitution §10.

---

## What this document is now

It asked, at the bottom, for three confirmations before any feature code was written: the six
deviations in §8, anything to redirect in the open questions, and a `DesignSync` login for spec 004.
All three were given, and forty-eight specs followed.

So this is **the architecture record**, not a live plan: §0, §4 and §5 are why the code looks the
way it does, and §8 is the list of places it deliberately departs from the original brief. Two
things it is *not* the source of truth for (§4):

- **What is done, and in what order** — [`specs/README.md`](specs/README.md), one row per spec.
- **Any Foundry API fact** — [`docs/REFERENCES.md`](docs/REFERENCES.md), with the doc URL and the
  date it was read. §10 means this file must never become a second place to learn an `api-version`.

Its §6 table and §7 questions are kept as the record of what was planned and what was unknown, each
row now saying where it actually landed.
