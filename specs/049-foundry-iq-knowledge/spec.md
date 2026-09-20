# Spec: Foundry IQ as a knowledge source

| | |
|---|---|
| **ID** | 049-foundry-iq-knowledge |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-20 |

## Problem / motivation

`PLAN.md`'s Phase 4 has said since the beginning: *"Foundry IQ replacing `lookup_knowledge`"*.
`ai/harness/_shared/tools/knowledge_tool.py` was written to be swapped, and the repository layout
comment says so (`PLAN.md:110`). This spec is where that swap stops being a note and becomes a
decision — because reading the documentation changes what the note means.

**`lookup_knowledge` today is a function tool, and Foundry IQ is an MCP tool.** That is not a detail
of implementation; it moves the work to the other side of the boundary this whole repository exists
to teach:

| | `lookup_knowledge` today | Foundry IQ |
|---|---|---|
| Who executes it | **our BFF** (`executor: "app"`) | **Foundry** (`executor: "foundry"`) |
| What the app must do | answer the call, or the run hangs and expires in 10 minutes | nothing |
| What the stream carries | `tool_call` + `tool_result` | `mcp_call` |

So "replacing `lookup_knowledge`" as written would **delete one of the only two app-executed
function tools**, leaving `get_current_datetime` and `search_web`, and would make the reference
project demonstrate *less* of the round trip that `docs/how-it-works/function-call-round-trip.md`
is entirely about. That may still be the right trade — grounded retrieval with citations is the
thing a real deployment wants — but it is a trade, and the note in `PLAN.md` does not read like one.

Second, Foundry IQ is not a library call. It needs **infrastructure this repository does not have**:
an Azure AI Search service, a knowledge base, at least one knowledge source, a project connection
created through ARM, and four role assignments across two resources. `infra/` currently holds a
README and no Bicep at all.

## Goals

- The reference agent can answer from a **grounded knowledge base with citations**, and the app
  renders where the answer came from through the machinery spec 034 already built.
- A reader can see **both** kinds of tool in one turn and tell them apart — the app-executed round
  trip and the Foundry-executed retrieval — because that contrast is the teaching material.
- The setup is **reproducible by a reader**: whatever is required is either provisioned by code in
  `infra/` or written down as a manual step, never assumed (§5).
- A deployment **without** Foundry IQ keeps working exactly as it does today, with no degraded
  screen and no error.

## Non-goals

- **No knowledge-base authoring in this app.** Creating, indexing or editing knowledge sources is
  Azure AI Search's job. This repository consumes a knowledge base; it does not manage one.
- **No new `AgentEvent`.** Foundry IQ retrieval arrives as `mcp_call`, which the contract has
  carried since spec 001 — this is the same shape `microsoft_learn` already produces (§9).
- **No per-user document filtering** in the first pass. The documented `x-ms-query-source-authorization`
  header with `structured_inputs` requires an identity for the person asking, and **this app has no
  notion of a user** — the same absence that keeps `FOUNDRY_ALLOW_VERSION_PROMOTE` off. Shipping a
  per-user filter with no user would be theatre.
- **No replacement of `search_web`.** Tavily answers a different question (the open web) and is the
  repository's one documented third-party key.

## User-facing behavior

A turn that consults the knowledge base shows a retrieval row in the activity panel tagged as
Foundry-executed, and the Sources strip under the settled answer lists what it consulted (spec 034).
Any new prose ships `en` + `pt` (§7).

Where a deployment has no Foundry IQ configured, nothing about the screen changes and nothing
announces an absence — the same rule spec 032 applies to every other unconfigured capability.

## Acceptance criteria

1. **AC1** — Given a deployment with Foundry IQ configured, when the agent answers a question its
   knowledge base covers, then the turn carries an `mcp_call` naming the knowledge base, and the
   answer is grounded in what came back.
2. **AC2** — Given that same turn, when it settles, then the Sources strip lists the retrieved
   sources, built from events and never from the answer's prose (spec 034's rule, unchanged).
3. **AC3** — Given a deployment with **no** Foundry IQ configured, when a turn runs, then it behaves
   exactly as today: no error, no empty panel, no string announcing the absence.
4. **AC4** — Given the agent definition, when it is applied, then the knowledge tool is declared in
   `agent.yaml` in this repository's own schema, and the two harnesses agree on what they declare.
5. **AC5** — Given a turn that uses both kinds of tool, when the activity panel renders it, then the
   app-executed call and the Foundry-executed retrieval are distinguishable by their executor tag —
   the contrast this spec exists to preserve.
6. **AC6** — Given the contract, when this ships, then **no new `AgentEvent` type exists**: the nine
   are unchanged and the adapter-parameterised suite passes unedited (§9).
7. **AC7** — Given a knowledge base that has no answer, when the agent is asked, then it says so
   rather than answering from the model's own knowledge — and a test drives that from a recording,
   not from a hand-written fixture (§5).
8. **AC8** — Given the setup this feature needs, when a reader follows the repository, then every
   resource, connection and role assignment is either provisioned by `infra/` or documented as a
   manual step with the doc it came from (§5, §10).
9. **AC9** — Given `GET /config`, when Foundry IQ is configured, then the deployment reports that
   fact, and `/about` renders it — because `About.coverage.test.ts` fails otherwise (spec 032).
10. **AC10** — Every new user-facing string ships `en` + `pt` (§7).
11. **AC11** — Given `docs/REFERENCES.md`, when this ships, then every endpoint, `api-version`, tool
    name and role it relies on is recorded with the doc URL and the date it was read (§10).

## Contract / data impact

- **`AgentEvent` (§9): unchanged.** Retrieval is an `mcp_call`. If planning shows it cannot be, that
  is a contract change and needs its own spec before this one continues.
- **`ai/harness/*/agent.yaml`** gains a tool declaration. `agent_spec.py` validates it, and it is the
  single source of truth for what the agent is (§4) — the BFF must not learn the knowledge base's
  address a second way.
- **`GET /config`** gains one field, which means `aboutFields.ts` moves in the **same** change or CI
  fails (spec 032, §4).
- **`.env.example`** gains the settings, with placeholders only.
- **A new Azure dependency**: Azure AI Search. Authentication is the project's **managed identity**
  through a `RemoteTool` project connection, so §"zero secrets" holds and no key is introduced.

## Open questions (clarify before planning)

- [ ] **Does `lookup_knowledge` go, stay, or move?** Three futures: Foundry IQ *replaces* it (what
      `PLAN.md` says, and the app loses an executed round trip); Foundry IQ is *added beside* it
      (both kinds visible in one turn, which is the better demonstration but two knowledge tools
      answering the same sort of question is a confusing agent); or `lookup_knowledge` *stays and is
      re-pointed* at something clearly different. **This is the spec's first question and everything
      else follows from it.**
- [ ] **Who pays for the Azure AI Search service, and does it exist?** A knowledge base needs a
      search service, an index and content. Is there one in `rg-belake-core-lab`, or is provisioning
      it part of this spec? Its tier decides whether semantic reranking and query planning are even
      available.
- [ ] **What is the knowledge base's content?** `lookup_knowledge` answers from this repository's
      own material. Indexing this repository's docs would keep the demonstration self-contained and
      honest; anything else needs a source we may not be able to ship.
- [ ] **Does `infra/` start here?** This feature needs a search service, a knowledge base, a project
      connection and four role assignments. `infra/` has no Bicep today and O-4 is already open
      about IaC that could not be verified. Provisioning this by code would be the first Bicep in
      the repository — a large thing to attach to a knowledge feature.
- [ ] **Does the hosted harness get the same tool, and does it look the same?** Measured on
      2026-09-20: the hosted agent emits **no `mcp_call` at all** — Learn arrives as plain tool calls
      with `executor: "foundry"`. So AC5's contrast may render differently per harness, and AC4's
      "the two harnesses agree on what they declare" may not imply they agree on what they emit.
- [ ] **Preview.** The MCP endpoint is `api-version=2026-08-01-preview` and answer synthesis and
      query planning are individually marked preview. This repository has shipped against preview
      before (Voice Live WebRTC) and said so. Is that acceptable here, and where is it said?
- [ ] **Does the citation format survive?** The documented instructions ask the model to render
      annotations as `【message_idx:search_idx†source_name】`. That is not Markdown, `Markdown.tsx`
      will render it literally, and spec 034 builds sources from **events** rather than prose. Do we
      adopt that instruction at all?

## Out of scope / deferred

- **Per-user document-level permissions** (`x-ms-query-source-authorization`, `structured_inputs`)
  — see non-goals; it needs a signed-in user this app does not have.
- **Writing to search indexes** (`Search Index Data Contributor`). Read-only is the whole need.
- **Knowledge sources beyond the first.** The documentation lists Azure AI Search, Blob Storage,
  SharePoint and OneLake; one is enough to demonstrate the mechanism.
