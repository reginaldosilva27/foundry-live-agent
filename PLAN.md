# foundry-live-agent — PLAN

> **Architecture record, reconciled with code and committed evidence.** Spec status lives only in
> [specs/README.md](specs/README.md), not a manually counted total here. Prompt and hosted agents
> are implemented; spec 020 AC16 closed historically on **2026-09-20** with six recorded turns,
> not a benchmark. Infrastructure remains manual. Local retrieval is lexical; Foundry IQ is
> provisioning-bound. [REFERENCES](docs/REFERENCES.md) owns dated API/evidence provenance.
> The [EN](docs/learning-journey.md) / [PT-BR](docs/learning-journey.pt-BR.md) learning outline
> separates implementation from historical live evidence and unverified exercises. Baseline #32 is
> integrated and README/setup reconciled; the outline records local checks and pending browser captures.
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
5. **Voice signalling** — hold the Voice Live control channel; the browser carries WebRTC audio/data.

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

This is a layer map, not a promise of generated infrastructure or an exhaustive file listing:

| Path | Current responsibility |
|---|---|
| `.specify/constitution.md`, `specs/` | Principles, gates, decision records and status index |
| `.claude/`, `.codex/prompts/`, `AGENTS.md`, `CLAUDE.md` | Synchronized agent workflows/guidance |
| `infra/README.md` | Manual provisioning/cleanup; no root `main.bicep` or modules |
| `ai/harness/_shared/` | Contract, schema loader, shared core and three function implementations |
| `ai/harness/prompt_agent/` | Prompt definition, BFF adapter and Responses normalizer |
| `ai/harness/langgraph/` | Hosted adapter/normalizer plus deployed `agent/` graph/container |
| `ai/azure.yaml`, `ai/scripts/` | Generated hosted config, apply/build/deploy and recording utilities |
| `ai/tests/fixtures/recorded/` | Recorded upstream streams, comparison summaries and spans |
| `backend/app/` | Factory, per-request harness selection, SSE, executor, traces and voice control |
| `frontend/src/` | Chat, comparison, inspector, history, preferences and WebRTC rendering |
| `docs/` | Current architecture, measured comparison, lifecycle explanations and learning journey |

**Why the tools live under `ai/harness/_shared/tools/`:** they belong to the *agent*, not the web
app. Both harnesses declare and execute the same three functions. The location makes it structurally
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

**Model:** the shared `agent_core.yaml` declares `gpt-5.5`. Prompt reasoning summaries are
configured as `detailed` in `prompt_agent/agent.yaml`, not as a per-request override. A summary
can still be absent. Read those definitions for defaults rather than treating this plan as a
second config source; the recorded experiments and rejection of request-side reasoning live in
[REFERENCES](docs/REFERENCES.md).

**On `agent.yaml` — deliberate deviation.** Foundry's own `agent.yaml` (AgentSchema) is *deprecated*,
and its replacement `azure.yaml` describes **hosted** agents, not prompt agents. So we keep
`ai/harness/<h>/agent.yaml` as **our own small, documented schema** (`schema_version:
foundry-live-agent/v1`), applied by `ai/scripts/apply_agent.py` through the Agent Service SDK. This
keeps "agent definition as code" without teaching a schema Microsoft retired;
`docs/harness-comparison.md` explains the deprecation and shows both files side by side. Since
**spec 018** the `azure.yaml` is real: `ai/azure.yaml`, generated from
`ai/harness/langgraph/agent.yaml` so the two cannot disagree (§4).

**Tools: direct integration, not a Toolbox.** Function calling *cannot* live in a Toolbox, so a
Toolbox would split our four declared tool surfaces across two mechanisms for no pedagogical gain. Toolbox is
documented as the scaling path.

### 4.2 Backend (FastAPI BFF)

| Endpoint | Purpose |
|---|---|
| `POST /chat` | Streams via the selected `HarnessAdapter`, executes function tools, re-streams SSE |
| `GET /trace/{response_id}` | Log Analytics query → span tree (agent run > model calls > tool calls) with recorded attributes; hosted response-id correlation is unavailable |
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

### 4.3 AI Gateway — historical design versus running baseline

The initial plan considered an admin-connected APIM model (`<connection>/<model>`) and recorded
portal findings on 2026-09-04. Those findings are design history, not proof of current routing.
The later recorded baseline uses a plain deployment and **bypasses the gateway**; nothing here
certifies reasoning summaries through BYOM. [REFERENCES](docs/REFERENCES.md) retains the dated
reads/findings, and [tracing-and-gateway](docs/how-it-works/tracing-and-gateway.md) explains the
separate inference, tracing and APIM surfaces.

Gateway integration/provisioning remains a manual, separately verified exercise. Tool spans do
not come from gateway logs, and Voice Live media never goes through that gateway. Do not teach
an absent IaC layer or old model connection as an automatic setup/cleanup path.

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

Voice Live attaches to the **same prompt agent** via `agent_name` + `agent_project_name` (+ optional
`agent_version`, `conversation_id`), **Entra-only — key auth is unsupported in agent mode**. One
definition and tool set, two modalities. Hosted attachment was recorded, but its one-frame
voice fixture is not proof of a complete spoken turn or shared trace correlation.

### 4.5 Frontend

Three panes: **Conversation** (streaming markdown + code blocks) · **Agent activity** (live reasoning
summaries, tool/MCP calls with arguments and results, token usage) · **Trace drawer** (span tree with
durations). Plus voice mode (dual transcript, elapsed session state; interruption visualization remains
deferred for lack of a recorded event) and
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

The authoritative protocol and event vocabulary live in
[`contract.py`](ai/harness/_shared/contract.py); do not copy a partial signature here.
`AGENT_HARNESS` configures the default, while person-selected agents use the per-request mapping
in [`harness_factory.py`](backend/app/harness_factory.py). No singleton is swapped.

[Streaming events](docs/how-it-works/streaming-events.md) explains each normalizer's mapping and
recorded coverage. The prompt adapter performs **bounded protocol rounds**, not an agent decision
loop; the hosted adapter reads one stream from a container that already executed its tools.
Tests target the shared contract using recordings, with adapter-specific tests for those differences.
Usage is accumulated across prompt legs and terminal `done` held back; hosted usage/reasoning/MCP
absences in the current corpus are rendered honestly rather than inferred.

### 5.1 `ai/harness/langgraph/` — implemented hosted agent

Spec 018 delivered the [graph](ai/harness/langgraph/agent/graph.py), container and BFF adapter.
The graph owns the model/tool cycle on Foundry; it shares definitions and tool implementations with
the prompt harness. It compiles **without a checkpointer**: a Postgres checkpoint, a gateway route,
Foundry IQ or a supervisor fallback from the original outline is not a delivered component.

The [hosted README](ai/harness/langgraph/README.md) owns deployment and identity/Key Vault steps;
`ai/azure.yaml` is generated from our schema, not full root IaC. The
[comparison](docs/harness-comparison.md) records usage/reasoning/trace gaps and attachment-only voice
evidence. Hosted multi-turn continuity must be measured before teaching it as verified. A third
harness or Copilot publication remains a separate decision; no API is chosen from memory.

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
| **006** ✅ | 3 | Voice mode via Voice Live on the same prompt agent | Speak and watch requested tools; interruption visualization has no recorded evidence |
| **018** ✅ | 4 | **Hosted agent harness** — the second harness behind the same contract, a LangGraph graph run by Foundry as a container | **Done** — `docs/harness-comparison.md`, measured |
| **Later numbered specs** | 3–4 | Subsequent UI/voice/history/comparison work; consult the index for individual done/blocked/deferred criteria | See [`specs/README.md`](specs/README.md) — the live index, one row per spec |
| **049** 📐 | 4 | **Foundry IQ as a knowledge source** — `planned` 2026-09-20; blocked on one manual setup step (T0). Reading the docs found a **second** route: the GA `/retrieve` REST call, which swaps the `KnowledgeSource` behind `lookup_knowledge` and keeps the round trip, instead of the MCP tool that would have deleted it | — |
| **050–051** | 4 | Separate local replay entrypoint, visibly labelled and based on recorded fixtures; external search isolated | Baseline #32 integrated; local readiness/shutdown and gates checked; browser captures pending |
| — | 4 | **Still not implemented.** More MCP tools (Databricks Genie, Azure DevOps), publish to M365 Copilot / Teams | — |

**This table preserves the original phase plan with selected later milestones.** After 006 the
work stopped being phase-shaped — the numbered index in
[`specs/README.md`](specs/README.md) is where execution order and status actually live (§4).

Per the template, each spec goes through **grilling (clarify)** before its plan — which is where the
open questions below get resolved, one at a time.

---

## 7. Open questions

These original questions record their evidence status, not a count of closed platform questions.
The dated *answer* lives
in [`docs/REFERENCES.md`](docs/REFERENCES.md), with its date and its evidence — this table says
which, and does not restate them (§4). Gateway/BYOM behavior not exercised by the plain-deployment recordings remains unverified.

| # | Question | Where it landed |
|---|---|---|
| **O-1** | Exact streaming event names for **reasoning summary** and **MCP call** deltas aren't in the docs I read. | ✅ **Answered in full** — 21 distinct event types, mapped and tested. `REFERENCES.md`, spike 2026-09-15. |
| **O-2** | Does Voice Live **agent mode** work over the **WebRTC** `/calls` endpoint, or is agent mode WebSocket-only? Docs cover each separately. | ✅ **Answered: yes**, agent mode works over WebRTC — the full handshake completed. `REFERENCES.md`, 2026-09-15. The endpoint exists only on `api-version=2026-01-01-preview`. |
| **O-3** | `require_approval` for the Learn MCP tool — docs consistently show `"always"`, which adds an approval round trip. Is `"never"` accepted? | ✅ **Answered: `never` is accepted.** Zero approval events across 441 recorded ones. `ai/harness/_shared/agent_core.yaml` declares it. |
| **O-4** | **AI Gateway has no documented Bicep/azd path** — it is a portal flow that creates/associates an APIM v2 instance. | ⛔ **Still open**. No Bicep/azd path is documented for the AI Gateway; it remains a portal flow, and §5 forbids shipping IaC nobody could verify. `REFERENCES.md`. |
| **O-5** | Region. Voice Live, hosted agents, HD voices and gateway tiers have **different** region lists. | ✅ **Settled: `eastus2`**, which serves Voice Live for this resource. `REFERENCES.md`, 2026-09-15. |
| **O-8** | The BYOM page says *"The Response API isn't supported at present."* I read that as constraining the **Foundry→gateway** hop (which must be `chat/completions`), not our **BFF→Foundry** hop — the page's own sample uses `responses.create()`. If that reading is wrong, the prompt agent cannot be driven by the Responses API while on a BYOM model, and the whole streaming design changes. | ✅ **Answered: yes.** `responses.create(stream=True)` with an `agent_reference` drives a prompt agent end to end. *Caveat:* it ran on a plain deployment; the `<connection>/<model>` BYOM hop is still unverified. `REFERENCES.md`. |
| **O-9** | **Do reasoning summaries survive the BYOM hop?** | **Partly answered:** summaries work from the agent definition on the plain deployment (`detailed`). Survival through BYOM is not established by that run. `REFERENCES.md`. |
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

- **No Azure keys.** `.env.example` placeholders only; Entra via `DefaultAzureCredential`.
  `TAVILY_API_KEY` is the documented third-party exception; the browser holds neither it nor an
  Azure credential. Hosted retrieval of that secret uses Key Vault with the agent identity.
- **One documented command per service** via `justfile`, delegating to the canonical gate commands.
- **Code and comments in English.** README in English + `README.pt-BR.md`. MIT license.
- **Every doc URL and API version recorded** in [`docs/REFERENCES.md`](docs/REFERENCES.md) ✅ written.
- **No Foundry API written from memory** — encoded as constitution §10.

---

## What this document is now

It asked, at the bottom, for three confirmations before any feature code was written: the six
deviations in §8, anything to redirect in the open questions, and a `DesignSync` login for spec 004.
All three were given, and the numbered specs record the subsequent work.

So this is **the architecture record**, not a live plan: §0, §4 and §5 are why the code looks the
way it does, and §8 is the list of places it deliberately departs from the original brief. Two
things it is *not* the source of truth for (§4):

- **What is done, and in what order** — [`specs/README.md`](specs/README.md), one row per spec.
- **Any Foundry API fact** — [`docs/REFERENCES.md`](docs/REFERENCES.md), with the doc URL and the
  date it was read. §10 means this file must never become a second place to learn an `api-version`.

Its §6 table and §7 questions are kept as the record of what was planned and what was unknown, each
row now saying where it actually landed.
