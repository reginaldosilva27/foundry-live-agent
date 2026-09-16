# Spec: The second harness — a LangGraph graph running as a Foundry hosted agent

| | |
|---|---|
| **ID** | 018-hosted-agent-harness |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

The repository's one-line pitch is *"swappable agent harnesses behind one contract"*. Seventeen
specs in, there is one harness.

`ai/harness/langgraph/` is a scaffold that raises `NotImplementedError` from every method, including
its constructor — honest (§5), and useless as evidence. The claim that earns the contract its keep
is written down in `specs/README.md` and has never been tested:

> The `HarnessAdapter` contract tests are written once, parameterised over adapters, and replay
> recorded fixtures. When the LangGraph harness is built later, it proves itself against that same
> suite **without editing it**.

Until a second harness exists, §9 is a design someone asserted, not a boundary someone crossed. Spec
002's closing pass already showed what happens when a Foundry shape is inferred rather than observed:
three inferences the real stream contradicted. The same risk applies to the contract itself — an
abstraction with one implementation is shaped like that implementation, and nobody can tell.

A hosted agent is also the half of Foundry this project currently only describes.
`docs/harness-comparison.md` has a full column marked **planned**; `PLAN.md` Phase 4 parks it as a
docs stub. For a reference implementation aimed at teaching, the interesting question — *what do you
actually give up by letting Foundry run the loop?* — is answered by a table nobody can run.

## Goals

- A **second harness that really runs**: a LangGraph graph, packaged as a container, deployed as a
  Foundry **hosted agent** in the same project, driving real conversations in this app.
- **Behavioral parity with the prompt agent.** Same model, same instructions, same four tools, same
  answers. The point is that only the *harness* changed — and, with it, where the tools execute.
- It proves itself against **`ai/tests/conformance.py` unedited**. If the suite has to move, either
  the contract was wrong or the adapter is — and that is a conversation to have out loud, in this
  spec, not a diff to slip through.
- Every event it emits is already in the §9 vocabulary. No new event type.
- Fixtures **recorded from real runs** against the deployed container, dated, committed (§5).
- The hosted column in `docs/harness-comparison.md` stops saying *planned* and starts reporting
  measured facts — including the ones that are worse than the prompt agent.

## Non-goals

- **Not a better agent.** Any behavioral difference from the prompt agent is a *finding to record*,
  not a feature to build. A graph with more nodes than the prompt agent has instructions would make
  the comparison meaningless.
- **No change to the `AgentEvent` set (§9).** If this harness needs an event the contract lacks,
  that is its own spec, and the finding is more valuable than the workaround.
- **No agent-loop logic in `backend/` or `frontend/` (§8).** The loop moves from Foundry's prompt
  runtime into a container *Foundry runs*; it does not move into the BFF or the browser. §8 is
  **amended** by this spec so its headline stops overreaching — see *Contract / data impact*.
- No UI for choosing between the harnesses — that is **spec 019** *(done, 2026-09-16)*.
- No side-by-side comparison surface — that is **spec 020**.
- No third harness (`agent-framework/`). Two is enough to prove the boundary.
- No Toolbox, no Foundry IQ. The tool set is the prompt agent's tool set, unchanged.

## Where the tools run — the decision this spec turns on

**Clarified 2026-09-16.** The function tools run **inside the container**, not in the BFF.

A hosted agent owns its loop, so the natural thing — and the thing the documentation describes — is
for the graph to call its tools itself. The alternative was to make the graph `interrupt()` on every
tool so the BFF answers it, mirroring the prompt agent's round trip byte for byte. That mechanism
exists (`ResponsesHostServer` surfaces an interrupt as a `function_call` named
`__hosted_agent_adapter_interrupt__`, resumed with a `function_call_output` carrying a LangGraph
`Command`), and it was rejected: it repurposes human-in-the-loop machinery to make a hosted agent
impersonate a prompt agent, and it would hide exactly the difference this repo exists to show.

So the two harnesses differ in **one** visible way, and it is the right one:

| | prompt agent | hosted agent |
|---|---|---|
| Who runs the loop | Foundry | our container, on Foundry |
| Who executes `search_web` et al. | the BFF | the container |
| The event | `tool_call` `executor: "app"` → `tool_result` | `tool_call` `executor: "foundry"` → `tool_result` |
| Rendered tag | `bff` | `foundry` |

`executor: "foundry"` on a `tool_call` is **dead code today** — no harness emits it, because the
prompt agent's only Foundry-side tool is MCP, which is an `mcp_call`. This spec is the first thing
to exercise a field the contract has carried since spec 001.

**What it costs.** `search_web` needs `TAVILY_API_KEY` in the container. The hosted-agent
documentation is explicit that secrets do not belong in images or environment variables. That is a
real constraint on this spec, not a footnote — AC7 holds it, and decision 7a below settles it: the
container reads the value from an Azure Key Vault using the agent identity Foundry gives it.

## User-facing behavior

From the browser, **almost nothing looks different** — and that is the deliverable. With the hosted
agent selected, the user asks the same question, watches the same tool rows and reads the same
answer.

> **Corrected 2026-09-16, from measurement.** This paragraph originally promised "the same reasoning
> card, the same MCP attribution, the same usage figures and the same trace link", and three of
> those four turned out to be false. A hosted turn emits **no reasoning summary** (AC13's answer),
> **no `usage`** at all, and **no `mcp_call`** — and its spans carry no `gen_ai.response.id`, so the
> trace link resolves to nothing. None of that breaks the contract: every one of those events was
> always optional. It does mean the app must render three absences as absences rather than as zeros
> or errors, and spec 020's comparison has more to say than expected.

The one difference is the one that matters: the executor tag on each tool row reads `foundry`
instead of `bff`. The row is otherwise identical, because the tool is identical.

What the user can also see, if they look:

- The harness badge in the header names the hosted harness instead of the prompt one.
- The reasoning card never fills, and the token count is absent rather than zero.
- The numbers differ — time to first token, total duration, and cost, because container compute is
  now on the bill. Those differences are the lesson, and spec 020 puts them side by side.

**i18n (§7).** Any new string this spec introduces ships `{ en, pt }`. In the end it introduced
**none**: the "voice unavailable for this agent" reason was contingent on AC9, and Voice Live
attaches to a hosted agent (verified 2026-09-16), so no refusal string exists to translate. The
harness badge renders the harness name verbatim, which is a proper noun and correctly untranslated.

## Acceptance criteria

1. **AC1** — Given the LangGraph harness is selected, when the BFF builds its adapter, then it
   returns a working adapter: no `NotImplementedError` is reachable on the request path, and the
   scaffold's sentinel message no longer exists in the shipped code.
2. **AC2** — Given the LangGraph adapter, when it is passed to `ai/tests/conformance.py`'s existing
   suite **with no edit to that suite**, then every case passes. The suite's diff for this spec is
   limited to registering the new adapter in its parameterisation.
3. **AC3** — Given a **live** turn against the deployed hosted agent asking a question that needs
   Microsoft Learn, when the raw stream is recorded, then the recording is committed as a dated
   fixture (§5) and the normalised stream carries the Learn call as a `tool_call` with
   `executor: "foundry"` answered by a matching `tool_result` — **not** an `mcp_call`, because the
   container is the MCP client here. The same question against the prompt agent still produces an
   `mcp_call`; the two fixtures side by side are the finding, and AC12 writes it down.
4. **AC4** — Given a **live** turn that needs a function tool, when it runs end to end, then the
   container executes the tool and the normalised stream carries a `tool_call` with
   `executor: "foundry"` answered by a matching `tool_result` carrying the tool's real output —
   the same two events the prompt agent produces, differing only in the executor. Recorded and
   committed as a dated fixture.
5. **AC5** — Given both harnesses, then the model, the instructions and the tool set they run have
   **one source of truth** (§4): a test fails if the two definitions drift, rather than a reviewer
   noticing.
6. **AC6** — Given the four tools, then the container executes them through
   `ai/harness/_shared/tools/` — the same implementations the prompt agent uses, imported into the
   image, never vendored or reimplemented (§4).
7. **AC7** — Given the app's zero-secrets rule, then `TAVILY_API_KEY` reaches the container from
   an **Azure Key Vault, read at runtime by the agent's own Entra identity** — the dedicated agent
   identity Foundry creates at deploy time — with `KEY_VAULT_URI` (not a secret) as the only thing
   the agent version declares. A plaintext environment variable on the agent version is a failing
   case. The role assignment that makes the read work ships as a documented manual step if it
   cannot be verified from this repo, never as unverified IaC (§5).

   > **Amended 2026-09-16, during implementation.** AC7 originally said *"through a **Key Vault
   > connection on the project**"*. Reading the doc that the hosted-agent guidance links to, a
   > Foundry Key Vault connection is a different mechanism: a **bring-your-own vault for Foundry's
   > own connection secrets**, replacing the Microsoft-managed vault that backs connections. It
   > offers the container no way to read an application secret, it is limited to **one per Foundry
   > resource**, and its prerequisite is a resource with **no existing connections** — which this
   > project fails, because the gateway's bring-your-own-model connection already exists. The
   > original wording was inferred from a doc title; this is §10's lesson arriving again, and the
   > finding is more useful than the workaround. Decision 7 below is superseded by decision 7a.
8. **AC8** — Given the container, when someone else clones this repo, then they can build and
   register the hosted agent from committed configuration, or from documented manual steps where a
   step could not be automated and verified. Nothing unverified ships as if it worked (§5).
9. **AC9** — Given the deployed hosted agent, when a Voice Live session is attempted against it,
   then the outcome is **recorded with its date** either way: if it attaches, a live voice turn is
   committed as a fixture and voice works on both harnesses; if it does not, the harness reports
   voice unavailable, the UI disables the control with a reason in `en` and `pt`, and the refusal
   is written into `docs/REFERENCES.md`. Not attempting is a failing case.
10. **AC10** — Given a completed hosted-agent turn and a configured Application Insights workspace,
    when the trace panel queries that turn's `response_id`, then it resolves to that run's spans —
    or this spec records precisely what a hosted-agent trace looks like instead, with a dated
    observation.
11. **AC11** — Given the deployed agent version, then it is sized **1 vCPU / 2 GiB** with the
    **15-minute** default idle timeout, and it calls the model **without** the APIM gateway, matching
    the prompt agent's deliberate bypass. Each of those three values is stated in exactly one place
    and every mirror of it moves in the same change (§4).
12. **AC12** — Given the docs, then `docs/harness-comparison.md`'s hosted column is filled from
    measurement rather than documentation and names the two findings this spec produced — where the
    tools execute, and who the MCP client is; `ai/harness/langgraph/README.md` no longer says
    nothing there works; `docs/architecture.md` shows both harnesses; and every Foundry detail this
    spec relied on is cited in `docs/REFERENCES.md` with the date it was read (§10).
13. **AC13** — Given a hosted-agent turn, then whether it emits `reasoning_summary` at all is a
    **recorded, dated observation**, not an assumption. If it emits none, the turn still renders
    correctly — spec 015 already made an empty reasoning card a survivable state — and the
    comparison says so rather than leaving the panel looking broken.

## Contract / data impact

- **`AgentEvent` (§9): unchanged.** This spec is the first real test of that claim, not an
  amendment to it. `ai/harness/_shared/contract.py` stays the single source of truth; the adapter
  normalises *into* it.
- **`ai/tests/conformance.py` is the proof surface.** It gains the new adapter in its
  parameterisation and nothing else. Any other change to it is a signal, not a detail.
- **`ai/harness/_shared/tools/` stays the one implementation** of the function tools (§4). The
  container imports them; it does not vendor a copy. They now run in two processes — the BFF and
  the container — which makes shared-ness a correctness property, not a tidiness one.
- **`mcp_call` becomes harness-specific.** After this spec the prompt agent emits it and the hosted
  agent never does. Nothing in the contract changes — a harness has always been free to emit a
  subset — but the frontend's MCP rendering must not assume every harness produces one, and the
  comparison surface (spec 020) must not read its absence as an error.
- **The agent definition.** The prompt agent's `agent.yaml` is our own schema; hosted agents are
  configured by Microsoft's `azure.yaml` (`azure.ai.project` + `azure.ai.agent`). Two files with
  overlapping content is exactly the drift §4 forbids — AC5 exists because of this. AC5 states the
  rule; `plan.md` chooses the arrangement that satisfies it.
- **`GET /config`** reports `harness`; a second real value flows through it to the badge. The
  richer selection contract is spec 019's, not this one's.
- **`docs/REFERENCES.md`** gains every hosted-agent fact used (§10).
- **§8 is amended** (decided 2026-09-16, before the plan). Its operative prohibition is unchanged
  and unweakened: `backend/` and `frontend/` still contain no agent-loop logic. What changes is the
  headline, which currently reads *"the agent loop lives in Foundry — never in this repo"* and
  becomes false the moment a LangGraph graph lands in `ai/harness/`. §8 was always about **the app**
  — the BFF and the browser — not looping; `ai/harness/<name>/` is where an agent is *authored*, and
  authoring an agent is not the same as the app running one.

  The amendment carries the distinction the plan needs anyway: inside one harness, the **adapter**
  is imported by the BFF and contains no loop, while the **agent** is deployed to Foundry and may
  contain all the loop it likes. §8's own test survives intact — swap the harness and the BFF is
  still not choosing tools.

  `.specify/constitution.md` §8 and its amendments table move in the same commit as this spec, and
  `CLAUDE.md` + `AGENTS.md` follow in that commit too (§6).

- **`executor` keeps two values** (decided 2026-09-16). A tool run by a container we wrote, on
  infrastructure Foundry runs, is tagged `"foundry"`. `executor` answers *who is responsible for
  executing and answering this call — this app, or the platform side?*, and the container is the
  platform side. A third value (`"container"`) was considered and rejected: it would make the BFF
  care about **how** the platform ran a tool, which is the coupling §9 exists to prevent, and it
  would move the contract, the frontend type, the tag map, the CSS and every fixture for a
  distinction the reader gets from the harness badge anyway. The only change is `ToolCall`'s
  docstring, which currently says "Foundry runs it" and must say "the platform side runs it".

## Clarified decisions

All taken 2026-09-16, with the user, before any plan was written.

| # | Question | Decision |
|---|---|---|
| 1 | Where do the function tools run? | **In the container**, tagged `executor: "foundry"`. The `interrupt()` route that would have made a hosted agent impersonate a prompt agent was rejected — see *Where the tools run*. |
| 2 | Does `executor` need a third value for "our container, their infrastructure"? | **No.** Two values; `"foundry"` means the platform side. A third would make the BFF care *how* the platform ran a tool — the coupling §9 prevents. One docstring changes. |
| 3 | Does §8 need amending? | **Yes** — headline only. "Never in this repo" → never in **the app**. The prohibition on `backend/` and `frontend/` is unchanged; `ai/harness/<name>/` is where an agent is authored, and an adapter that runs in the BFF is distinguished from an agent that runs on Foundry. |
| 4 | How simple is the graph, and does it have a checkpointer? | An **explicit `StateGraph`** with named `agent` → `tools` → `agent` nodes, and **no checkpointer** — so conversation state stays Foundry's, exactly as with the prompt agent. A one-line `create_agent` would have made a harness called "LangGraph" that shows no graph. |
| 5 | Microsoft Learn — container as MCP client, or MCP declared to Foundry? | **The container is the MCP client.** `mcp_call` therefore never appears in this harness, and that is the finding, not a regression: with a prompt agent Foundry is the MCP client for you; with a hosted agent you are. |
| 6 | Voice on a hosted agent? | **Attempt it live**, and record whichever answer the service gives (AC9). Nobody knows and §10 forbids guessing. The chat-supervisor fallback stays out — it would route the "hosted" column through a prompt agent and destroy the comparison. |
| 7 | How does `TAVILY_API_KEY` reach the container? | ~~A **Key Vault connection on the project**~~ — **superseded by 7a.** Environment variable rejected either way: the hosted-agent doc forbids it, and a reference repo that teaches it teaches the wrong thing. |
| 7a | *(2026-09-16, during implementation)* Then how? | **Azure Key Vault read directly by the agent identity** (`azure-keyvault-secrets` + `DefaultAzureCredential`). A Foundry *Key Vault connection* turned out to be a BYO vault for Foundry's own connection secrets — one per resource, and only on a resource with no existing connections, which this project already fails. The agent identity reading a vault it has **Key Vault Secrets User** on needs no Foundry connection and matches what AC7 was reaching for. See AC7's amendment note. |
| 8 | Gateway or direct? | **Direct**, matching the prompt agent's deliberate bypass, so the two harnesses differ in one thing. Both are restored together when the APIM API is bound to its backend. |
| 9 | Sandbox size and idle timeout? | **1 vCPU / 2 GiB, idle 15 min** (the default). Right-sizing is done later **by measurement**, following the doc's own procedure — representative load, App Insights → Performance, adjust if sustained peaks pass ~70% of allocation. |
| 10 | Protocol? | **Responses**, via `ResponsesHostServer`. Settled by the documentation: the platform then manages conversation history and the streaming lifecycle. |
| 11 | Where does the shared instructions text live? | Not a spec question. AC5 states the **rule** — one source of truth, enforced by a test — and `plan.md` chooses the arrangement. |
| 12 | Do hosted turns carry reasoning summaries? | **Unknown, and it stays unknown until measured** (AC13). An empty reasoning card is already a survivable state (spec 015), so either answer ships. |

## What the documentation already settles (§10)

Read 2026-09-16; each goes into `docs/REFERENCES.md` in the implementing commit.

| Fact | Source |
|---|---|
| Hosted agents are available in **East US 2** (and Brazil South); 31 regions listed | [Hosted agents](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/hosted-agents) |
| Idle timeout is **2–60 minutes, 15 default** — `docs/REFERENCES.md` currently says 5–60 and is stale | same |
| Sandbox sizes: 0.5 vCPU/1 GiB · 1 vCPU/2 GiB · 2 vCPU/4 GiB; billing is CPU+memory across **active sessions**, so oversizing multiplies by concurrency | same |
| Responses endpoint: `{project_endpoint}/agents/{name}/endpoint/protocols/openai/responses`; active protocols come from `protocol_versions` / `azure.yaml` | same |
| Each agent gets a **dedicated Entra agent identity** at deploy time, with model inference and session storage access by default | same |
| The platform injects `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_MODEL_NAME`, `APPLICATIONINSIGHTS_CONNECTION_STRING` into the container | [LangGraph hosted agents](https://learn.microsoft.com/en-us/azure/foundry/how-to/develop/langchain-hosted-agents) |
| `pip install -U "langchain-azure-ai[hosting]>=1.2.9"`; `ResponsesHostServer(graph).run(port=...)`; binds `PORT`, default 8088 | same |
| With **no** checkpointer the host replays Responses history into the graph; **with** one it sends only the current input and keys state by conversation/response thread | same |
| Interrupts surface as a `function_call` named `__hosted_agent_adapter_interrupt__` (or an `mcp_approval_request` with `server_label: langgraph`) | same |
| Deploy: `azd ext install azure.ai.agents` → `azd ai agent init -m <sample azure.yaml>` → `azd provision` / `azd deploy`; Docker required locally; **Foundry Project Manager** role required | same |
| Secrets must not live in the image or in environment variables — "use managed identities and connections, and store secrets in a managed secret store" | [Hosted agents](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/hosted-agents) |
| A Foundry **Key Vault connection** is a BYO vault for Foundry's *own* connection secrets: one per Foundry resource, and only creatable on a resource with **no existing connections**. Not a channel for an application secret — see AC7's amendment | [Set up a Key Vault connection](https://learn.microsoft.com/en-us/azure/foundry/how-to/set-up-key-vault-connection) |
| The idle timeout is configurable **per agent version**, but the `azure.ai.agent` field reference documents **no key for it**. Open question O-18-1; the generator states it in a comment rather than inventing one (§10) | [azure.yaml reference](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/azure-yaml-reference) |
| The two docs disagree on sizing: the concept doc offers **three sandbox sizes**, the `azure.yaml` reference allows `cpu` `"0.25"`–`"4.0"` and `memory` `0.5Gi`–`8.0Gi`. The loader enforces the three; 1 vCPU / 2 GiB satisfies both | [Hosted agents](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/hosted-agents) · [azure.yaml reference](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/azure-yaml-reference) |
| `FOUNDRY_` and `AGENT_` are **reserved prefixes**; `FOUNDRY_PROJECT_ENDPOINT` must not be declared in `env`. The model deployment is passed as `MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME`, while the LangGraph guide's code reads `FOUNDRY_MODEL_NAME` — the container reads both, preferring the injected one | [azure.yaml reference](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/azure-yaml-reference) · [LangGraph hosted agents](https://learn.microsoft.com/en-us/azure/foundry/how-to/develop/langchain-hosted-agents) |
| **Observed 2026-09-16, from inside the built container**: `https://learn.microsoft.com/api/mcp` exposes **three** tools — `microsoft_docs_search`, `microsoft_code_sample_search`, `microsoft_docs_fetch`. The prompt agent declares one MCP *server* and Foundry calls into it; the hosted agent's graph binds three *tools*. So the harnesses agree on the definition (AC5) and differ at runtime, and AC3's recorded `tool_call` will carry a `microsoft_docs_*` name rather than `microsoft_learn` | Built image, `load_mcp_tools` against the live server |
| **Observed 2026-09-16**: `pip` 25.0.1, which `python:3.12-slim` ships, cannot resolve `langchain-azure-ai` at all — `InvalidVersion: Invalid version: 'hosting'`, with or without the extra, pinned or not. pip 26 resolves it cleanly, so the Dockerfile upgrades pip before installing anything | Reproduced in a clean container |
| `docker.path` and `docker.context` are valid on an `azure.ai.agent` service — which is what lets the build context be `ai/` while the Dockerfile sits with the agent code | [azure.yaml schema](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/azd-schema) |

## Out of scope / deferred

- A third harness (`ai/harness/agent-framework/`).
- Toolbox, Foundry IQ, additional MCP servers.
- Publishing either agent to M365 Copilot or Teams.
- Autoscale, cold-start or sandbox-size tuning beyond picking one deliberately and writing down why.
