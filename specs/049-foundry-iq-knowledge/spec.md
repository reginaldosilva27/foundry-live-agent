# Spec: Foundry IQ as a knowledge source

| | |
|---|---|
| **ID** | 049-foundry-iq-knowledge |
| **Status** | clarified |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-20 |
| **Clarified** | 2026-09-20 |

## Problem / motivation

`PLAN.md`'s Phase 4 has said since the beginning: *"Foundry IQ replacing `lookup_knowledge`"*, and
`ai/harness/_shared/tools/registry.py:43` carries the line it was written around:

> *"The knowledge backing store. Swap this line for Foundry IQ; nothing else changes."*

Today that store is `LocalMarkdownKnowledge`, a **scored keyword match** over three markdown files,
and its own docstring refuses to call itself semantic search because it is not (§5). It is the
weakest part of the reference agent, and the one a reader is most likely to ask about.

**Reading the documentation changed what "replacing" should mean, and that is the whole value of
reading it first.** Foundry IQ is reachable two ways:

| | As an MCP tool | As a REST call |
|---|---|---|
| Endpoint | `…/knowledgebases/{kb}/mcp` | `POST …/knowledgebases/{kb}/retrieve` |
| `api-version` | `2026-08-01-preview` | **`2026-04-01` — GA** |
| Who executes it | **Foundry** | **our BFF** |
| The stream carries | `mcp_call` | `tool_call` + `tool_result`, `executor: "app"` |
| Setup | an ARM project connection + 4 role assignments | one role assignment |

The first reading is what `PLAN.md` implied, and it would have **deleted one of only two
demonstrations of the function-call round trip** — the thing
`docs/how-it-works/function-call-round-trip.md` is entirely about, and the reason this repository
exists. The second changes one class behind a Protocol that was designed for exactly this, keeps
the round trip, needs no preview API and no control-plane write.

**This spec takes the second.** Foundry IQ becomes a better implementation of a tool the app still
executes, rather than a tool the app stops executing.

## Goals

- `lookup_knowledge` answers from a **real retrieval pipeline with semantic reranking and source
  references**, instead of a keyword score.
- The change is **one class behind `KnowledgeSource`** — the tool, its schema, its registration and
  both `agent.yaml` files are untouched (§4).
- **Both harnesses keep running the same tool.** Spec 018's AC6 stays true, so spec 020's
  measurements keep comparing two harnesses rather than two different agents.
- A deployment **without** Foundry IQ keeps working exactly as today.
- Whatever setup is required is **written down and reproducible**, never assumed (§5).

## Non-goals

- **No MCP tool on the agent definition.** That is the other design, and taking it would move
  retrieval to Foundry's side of the boundary. Recorded in `docs/REFERENCES.md` as the road not
  taken, with what it would cost.
- **No knowledge-base authoring in this app.** Creating and indexing is Azure AI Search's job.
- **No new `AgentEvent`.** The tool's events are the ones it already emits (§9).
- **No query planning and no answer synthesis.** They are preview-only; see *What this does not do*.
- **No per-user document filtering.** The `x-ms-query-source-authorization` header needs an identity
  for the person asking, and **this app has no notion of a user** — the same absence that keeps
  `FOUNDRY_ALLOW_VERSION_PROMOTE` off. A per-user filter with no user would be theatre.
- **No replacement of `search_web`.** Tavily answers a different question.
- **No Bicep.** See *Setup*.

## What this does not do, and says so

The GA `2026-04-01` retrieve API is **minimal and extractive**: it runs the query against the
knowledge sources with semantic reranking and returns references. It does **not** decompose the
question into subqueries (query planning) and does **not** synthesise an answer — both are
`2026-08-01-preview` only.

So this is a real improvement over a keyword match, and it is **not** the full "agentic" pipeline
the marketing name suggests. The spec says that in the same voice `knowledge_tool.py` already uses
about itself, and `docs/REFERENCES.md` records what the preview would add. Preview was declined
here deliberately: with a three-document corpus there is little for query planning to decompose,
and the repository already carries one preview dependency (Voice Live WebRTC) that it names out
loud — a second needs a better reason than a nicer adjective.

## Setup

Free tier, and provisioning is a **documented manual step**, not Bicep. `infra/` holds no Bicep
today, and O-4 already records that unverifiable IaC does not ship here (§5). The knowledge base
and knowledge source have no documented Bicep path either, so a Bicep file would cover a third of
the work and read as if it covered all of it.

| Thing | Value |
|---|---|
| Search service | **Free** tier — one per subscription, 50 MB, shared infrastructure, no SLA |
| Knowledge bases / sources | 3 per service on Free; this needs 1 of each |
| Corpus | the same three files `lookup_knowledge` reads today |
| Role | **`Search Index Data Reader`** on the search service, for **two** identities |

Free is enough and its limits are stated rather than discovered: a free service is on shared
hardware and *"might be deleted after extended periods of inactivity"*. The reference deployment is
a demonstration, so that is acceptable — and it is written in `.env.example` so nobody is surprised.

## User-facing behavior

A turn that consults the knowledge base looks like it does today — an app-executed tool row in the
activity panel — and the Sources strip under the settled answer lists what came back (spec 034).
The difference a reader sees is that the answer is *better grounded*, and that the sources are real
references rather than a repository path.

Any new prose ships `en` + `pt` (§7). Where a deployment has no Foundry IQ configured, nothing about
the screen changes and nothing announces the absence (spec 032's rule).

## Acceptance criteria

1. **AC1** — Given a deployment with Foundry IQ configured, when the agent calls `lookup_knowledge`,
   then the BFF retrieves from the knowledge base and the turn carries `tool_call` + `tool_result`
   with `executor: "app"` — the same round trip as today.
2. **AC2** — Given that turn, when it settles, then the Sources strip lists the returned references,
   built from events and never from the answer's prose (spec 034's rule, unchanged).
3. **AC3** — Given a deployment with **no** Foundry IQ configured, when a turn runs, then
   `lookup_knowledge` uses the local markdown exactly as today: no error, no empty panel, no string
   announcing an absence.
4. **AC4** — Given the agent definitions, when this ships, then **neither `agent.yaml` changed**,
   and neither did `SCHEMA`, the tool's name, or its registration (§4 — the seam is the whole point).
5. **AC5** — Given Foundry IQ **is** configured but the caller lacks `Search Index Data Reader`,
   when the tool runs, then it fails **visibly** — the failure reaches `tool_result` and the activity
   panel — and **never** falls back to the local markdown. A silent fallback would make the app lie
   about where an answer came from (§5) and would break spec 020's comparison.
6. **AC6** — Given the contract, when this ships, then **no new `AgentEvent` type exists** and the
   adapter-parameterised suite passes unedited (§9).
7. **AC7** — Given both harnesses, when each calls `lookup_knowledge`, then both use the **same**
   `KnowledgeSource` implementation — spec 018's AC6 still holds, and no line in `registry.py`
   decides by harness.
8. **AC8** — Given a question the corpus does not cover, when the agent is asked, then the tool
   returns no passages and the agent says it does not know, driven by a **recorded** run rather than
   a hand-written fixture (§5).
9. **AC9** — Given `GET /config`, when Foundry IQ is configured, then the deployment reports that
   fact and `/about` renders it — `About.coverage.test.ts` fails otherwise (spec 032).
10. **AC10** — Given the setup, when a reader follows the repository, then the search service, the
    knowledge base, the knowledge source and **both** role assignments are documented as manual
    steps with the doc each came from (§5, §10).
11. **AC11** — Every new user-facing string ships `en` + `pt` (§7).
12. **AC12** — Given `docs/REFERENCES.md`, when this ships, then the retrieve endpoint, its
    `api-version`, the token scope, the role and the tier limits are recorded with their doc URL and
    the date read (§10) — including what the preview API would add and why it was declined.

## Contract / data impact

- **`AgentEvent` (§9): unchanged.** The tool already emits `tool_call` / `tool_result`.
- **`ai/harness/*/agent.yaml`: unchanged**, and AC4 asserts it.
- **`KnowledgeSource` (`knowledge_tool.py`) is the source of truth for the seam** (§4). A second
  implementation appears beside `LocalMarkdownKnowledge`; `registry.py:43` is the one line that
  chooses, driven by configuration.
- **`Passage` may need to carry a reference** that is not a repository path. `frontend/src/state/sources.ts`
  reads `lookup_knowledge`'s output today as *"a repository path, which renders as a path and never
  as a link"* (spec 034). If the shape changes, `sources.ts` moves in the **same** change (§4), and
  spec 034's rule holds: **one reader per tool, because the shapes really differ**.
- **`GET /config`** gains one field → `aboutFields.ts` moves with it or CI fails (spec 032).
- **`.env.example`** gains the search endpoint and knowledge base name. Placeholders only.
- **A new Azure dependency**: Azure AI Search, authenticated with `DefaultAzureCredential` at scope
  `https://search.azure.com/.default`. **No key**, so §"zero secrets" holds and `TAVILY_API_KEY`
  remains the single documented exception.

## Clarify outcome — 2026-09-20

| Question | Decision |
|---|---|
| Does `lookup_knowledge` go, stay, or change inside? | **Change inside.** Swap the `KnowledgeSource`; it stays an app-executed function tool. The MCP design is recorded as the road not taken. |
| Provision a search service, and at what tier? | **Free**, created as a documented manual step. `infra/` does not start here. |
| What goes in the knowledge base? | **The same three markdown files**, so the two implementations answer the same question and the difference is the teaching material. |
| GA or preview? | **GA `2026-04-01`**, and the spec names what GA does not do rather than implying it does. |
| Which identity gets the role? | **Both** — the BFF's and the container's. Missing role fails loudly; never a silent fallback. |

## Out of scope / deferred

- **Query planning, answer synthesis, multi-turn `messages`, configurable reasoning effort** — the
  `2026-08-01-preview` feature set. Worth its own spec when a corpus justifies it.
- **Per-user document-level permissions** — needs a signed-in user this app does not have.
- **Writing to search indexes.** Read-only is the whole need.
- **Knowledge sources beyond the first**, and kinds beyond the one chosen (Blob, SharePoint, OneLake).
