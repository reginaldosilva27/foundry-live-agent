# Architecture — what runs in Foundry vs. what runs in this app

> **Status: stub.** This document describes the *running* system, so it is written as the system
> comes to exist — filled by **specs 003–006**, and kept in sync with the code from then on
> (constitution §4). The design record that precedes it is [`../PLAN.md`](../PLAN.md); this file will
> replace it as the description of what actually runs.
>
> Writing it now would mean describing software that does not run yet (constitution §5).

## The one-sentence version

The agent — instructions, model and tools — lives in **Microsoft Foundry**. This repository is
everything around it: identity, streaming, tool execution, tracing, voice and a UI. See the diagram
in [`../README.md`](../README.md).

## Two harnesses, one contract (spec 018)

Since 2026-09-16 there are **two** agents in Foundry, behind one `AgentEvent` contract, running the
same model, instructions and tools from one file (`ai/harness/_shared/agent_core.yaml`):

```
                     ┌── prompt agent ──────────────────────────────────────┐
                     │  Foundry runs the loop.                              │
Browser ──SSE──> BFF │  It emits a function call and WAITS; the BFF runs    │
   │             │   │  the tool and answers. Two legs per turn.            │
   │             │   │  Microsoft Learn is Foundry's MCP client → mcp_call  │
   │             │   └──────────────────────────────────────────────────────┘
   │             │   ┌── hosted agent (LangGraph) ──────────────────────────┐
   │             └──>│  OUR CONTAINER runs the loop, on Foundry.            │
   │                 │  It calls its own tools and answers them. One leg.   │
   └──WebRTC────────>│  The container is the MCP client → no mcp_call       │
      (Voice Live,   │  ai/harness/langgraph/agent/ — 1 vCPU / 2 GiB        │
       both agents)  └──────────────────────────────────────────────────────┘
```

**Which half is "the app" matters, and §8 was amended to say it properly.** The BFF and the browser
contain no agent-loop logic — that is unchanged. But a hosted agent's loop *is* in this repository,
in `ai/harness/langgraph/agent/`, because that directory is where an agent is **authored** before
being deployed to Foundry. Inside one harness: the **adapter** is imported by the BFF and contains no
loop; the **agent** runs on Foundry and is nothing but loop.

What the two cost each other is measured, not described, in
[`harness-comparison.md`](harness-comparison.md).

## Choosing between them from the screen (spec 019)

Which agent answers used to be an environment variable read once at process start, which meant the
swap this repository is *about* could not be seen without restarting the server. Since 2026-09-16 the
sidebar lists the project's agents and a person picks one.

```
Browser ──GET /agents──> BFF ──GET {project_endpoint}/agents?api-version=v1──> Foundry
                          │                                    (audience https://ai.azure.com)
                          └── decides SELECTABILITY here, because "which kinds can this build
                              drive" is backend knowledge: HARNESS_FOR_KIND in harness_factory.py

Browser ──POST /chat {message, agent}──> BFF ──build_harness(agent=…)──> that agent
```

Three properties worth knowing, each of which is a decision rather than an accident:

- **The selection is per request, never a swapped singleton.** `app.state.harness` stays the
  configured default and is never mutated. Replacing it on selection would be process-global mutable
  state: one browser's choice would change another browser's turn, and a turn already streaming
  could have its adapter swapped underneath it. Adapters are cheap — a closure and a name — while
  the credential and the project client live in `AzureClients`, built once per process.
- **The BFF ships no user-facing prose.** A row that cannot be chosen carries a *code* —
  `no_harness`, `disabled`, `version_not_active` — and the frontend says it in the reader's
  language (§7).
- **Letting a person choose is configuration, not an agent loop (§8).** Nothing in the app switches
  agents on its own, and nothing reads model output to decide. The violation would be the app
  choosing; a person choosing is what a settings screen is.

## The rollback story, demonstrated (spec 031)

`apply_agent.py` has always said that every run creates a new immutable version and that this is
the rollback story. Until 2026-09-19 the story was told and never shown: the app displayed one
number and offered no way to see the others, let alone go back to one.

```
Browser ──GET /agents/{name}──> BFF ──GET {project_endpoint}/agents──> Foundry   (the definition)
                                 ├── agents.get(name)                           (the routing)
                                 └── agents.list_versions(name)                 (the versions)

Browser ──POST /agents/{name}/versions/{version}/promote──> BFF ──update_details(...)──> Foundry
                                 └── then READS BACK, and answers with what the service says now
```

**"The served version" is not "the newest version".** An agent endpoint can pin a version through
`agent_endpoint.version_selector`, and the moment anything does, the two come apart. One function,
`served_version()` in `backend/app/agents.py`, is where that distinction is decided — the selector's
version when the endpoint carries one, the newest when it does not.

Three properties, each a decision:

- **The listing stays one request.** `GET /agents` does not carry `agent_endpoint`, and resolving a
  pin there would cost a call per agent — undoing what spec 030 verified. So the rail reports the
  *latest* version and says so, and the agent detail screen, which is opened deliberately and can
  afford two more calls, is the authoritative place for what is actually served. A test asserts the
  absence of the extra call.
- **The write is off by default and bounded twice.** A flag decides whether the surface exists at
  all; the harness `agent.yaml` names decide which agents it applies to. Neither is a permission —
  RBAC is — and [`SECURITY.md`](../SECURITY.md) is where that is spelled out, because a BFF this app
  puts no sign-in in front of is a real consideration rather than a footnote.
- **It reads back rather than assuming.** The response to a promotion is a fresh read, so a
  promotion that silently did not take effect looks like one.

This is the first thing in the app that writes to Foundry, and the deliberate shape of the route is
that it *cannot* do more: there is no request body, so no agent definition can travel on it. Editing
an agent from the browser remains out of scope, and creating a version stays with `apply_agent.py`.

## What the browser keeps, and what it must never keep (spec 021)

Since 2026-09-16 the shell has two views, an action row under each answer, and a list of past
conversations down the left. The last of those is the one that needed an argument, because "state
the platform already holds" is exactly what §8 forbids the app to duplicate.

What this browser stores is **not the conversation**. Foundry owns that, keyed by
`conversation_id`. `localStorage` holds two things beside it:

| Key | What it is |
|---|---|
| `fla.history.v1` | Up to 25 conversations: the frames this browser already received and drew, plus Foundry's id for each, the agent that held it, a title and a timestamp |
| `fla.ui.v1` | Whether the rail is collapsed |
| `fla.favourites.v1` | Agent **names** the reader starred (spec 022) — resolved against `GET /agents` on every render, so a favourite never outlives the project's own answer about what exists and what this build can drive |

```
reopen a conversation ──> restore(messages, conversation_id) ──> POST /chat { message, conversation_id, agent }
                              │                                                          │
                              └─ the DRAWING, rendered                                   └─ Foundry supplies the context
```

Three properties keep the render cache on the right side of §8, and each is an acceptance criterion
in spec 021 rather than a promise:

- **It never travels.** The request body is `message · conversation_id · agent` and nothing else —
  `ChatRequest` refuses history by construction, and spec 021 did not change it.
- **Nothing derives a decision from it.** No re-prompt, no replay into the model, no tool chosen
  from it. It is rendered, and that is all.
- **Foundry stays the owner.** Continuing a restored conversation hands Foundry *its own id*; if the
  drawing and the conversation ever disagree, Foundry wins, because Foundry is the one being asked.

A conversation's title is taken from the first thing the person typed. Asking a model to name the
thread would be this app running inference of its own — the precise thing §8 exists to stop.

### What leaves the browser, and what comes back (spec 027)

The record is searchable and portable, and both are reads of something this browser already has.
Nothing here calls the BFF: searching Foundry's conversations would duplicate state the service
owns, and validating an imported pointer against the service would be this app deriving a decision
from its own storage.

**Search** (the rail's field, and the `/history` screen) matches a conversation's title, the text of
either role's messages, and the **names** of the tools and MCP servers its turns used — because
"which conversation called `search_web`?" is the question a reader of this repository has. Call
arguments and outputs are deliberately not searched: a hit inside a JSON blob renders as an
unreadable fragment.

**Export** comes in two shapes, and only the second is meant to be read back:

| Shape | Contents |
|---|---|
| One conversation, Markdown | Every turn through the same renderer the single-turn download uses: the question, the answer, every call and who ran it, and the numbers underneath |
| The whole record, JSON | `{ version, exportedAt, conversations }` — the stored shape verbatim, including each turn's trace identifiers |

The trace identifiers are **not** stripped on the way out. They are what ties a transcript back to
spans in the workspace, which is the point of a teaching repository, and a `response_id` or an OTel
trace id is inert without access to that workspace.

**Import** merges a file into the record by our own conversation id, so the same file twice leaves
one of each, and a stored conversation always wins over its imported twin. Past the 25-conversation
cap the newest survive and the screen says how many were kept and how many were not — discarding
somebody's transcripts in silence is what §5 is about. A file this build does not recognise, by
version or by shape, is refused whole and the record is untouched.

Import writes the file's `conversation_id` **verbatim and asks Foundry nothing**. That is the point:
a pointer that survives the round trip is what makes reopening an imported conversation a
resumption rather than a screenshot. A pointer from another project or tenant therefore fails the
way any unusable pointer already fails — the next turn sent into it errors, and the turn-error card
says so. There is no second failure mode and no "imported" flag on the record.

The export format's single source of truth is `frontend/src/state/history.ts`, which owns the stored
shape and the exported one together (§4).

## Planned outline

| Section | Filled by |
|---|---|
| The trust boundary — what holds a credential, and what never does | spec 003 |
| Why a BFF exists at all, and what it is forbidden from doing (§8) | spec 003 |
| The `AgentEvent` contract and why two harnesses can share it (§9) | spec 001 |
| Request lifecycle: browser → BFF → Responses API → agent → tools → back | spec 003 |
| Where state lives: Foundry conversations vs. anything we hold | spec 003 |
| What the browser renders, and why it cannot decide anything (§8) | spec 004 |
| Tracing topology: Foundry spans, APIM logs, and what neither one records | spec 005 |
| Voice topology: three channels, and why audio skips our server | ✅ [how-it-works/voice-live-lifecycle.md](how-it-works/voice-live-lifecycle.md) |

## Facts already established (cited in [REFERENCES.md](REFERENCES.md))

- **Voice Live traffic does not pass through the AI Gateway.**
- **Voice attaches to the same agent by name, and its function calls land on the same executor.**
  Observed 2026-09-15: the control channel emits `response.function_call_arguments.done` and the BFF
  answers it with `tool_executor.execute` — the identical function the chat path calls. One agent
  definition, one tool set, two modalities. See
  [how-it-works/voice-live-lifecycle.md](how-it-works/voice-live-lifecycle.md).
- **Voice Live needs two api-versions, one per endpoint.** The WebRTC control route exists only on
  `2026-01-01-preview`; the plain WebSocket route works on all published values.
- **The AI Gateway does not log tool traces** — tool-level detail comes only from Foundry tracing.
- A `function_call` Foundry emits **must** be answered, or the run hangs and expires after 10 minutes.
- Function calling is **client-side execution** by definition and cannot live in a Toolbox.


## This page, on screen (spec 032)

`/about` renders `GET /config` — which project and agent, through the gateway or not, tracing on or
off, what voice can do, whether this build may roll an agent back, and the **event-mapping report**:
how many Foundry event names have been seen in a recorded run, and which have not.

That last one is why the screen is worth having. It is constitution §10 in numeric form, and until
spec 032 it was visible only by curling the endpoint.

Two properties keep it honest:

- **Read-only by construction, and asserted.** No control, no form, no request of its own — the
  panel is handed the config the rail already read. The browser's preferences (spec 036) live
  elsewhere on purpose: one is what the deployment decided, the other is what this browser keeps,
  and a toggle beside a fact would blur the distinction spec 021 is built on.
- **A field added to `/config` and not rendered fails CI.** `About.coverage.test.ts` reads
  `backend/app/routers/config.py` and compares it with the panel's declared coverage (§4). Spec
  031's `agents.can_promote` is the case that motivated it.

This page and that screen describe the same deployment. Where they disagree, the screen is right —
it is generated from the configuration, and this page is written.

## Addresses (spec 024)

The frontend has nine addresses and one reservation. `frontend/src/state/route.ts` is their single
source of truth — every link is built through it, and `route.test.ts` proves the parse and the build
round-trip for **every** route in `ROUTES`, so this table cannot quietly fall behind the code again.

| Address | Shows |
|---|---|
| `/` | the chat |
| `/agents` | the agents screen |
| `/agents/<name>` | one agent's definition, as the service reports it (spec 030) |
| `/history` | the record this browser kept, and the controls that move it (spec 027) |
| `/about` | what this deployment is, from `GET /config` (spec 032) |
| `/preferences` | what **this browser** prefers, and editable (spec 036) |
| `/tools` | run one function tool, outside any conversation (spec 042) |
| `/c/<id>` | a conversation **this browser** kept (spec 021) |
| `/trace/<response_id>` | the trace panel on that response |
| `/compare` | one question to two agents, side by side (spec 020) |

Two properties are load-bearing and are tested, not merely intended:

- **The URL is an address, not state.** Nothing the app needs in order to be correct lives only in
  it. Foundry's `conversation_id` still comes from this browser's stored record and the answering
  agent still comes from the agents state, so `POST /chat` carries exactly `message ·
  conversation_id · agent` after navigation, as it did before (§8).
- **A trace is keyed on Foundry's `response_id`, not nested under a conversation.** The spans live
  in the workspace, so the link opens for a reader who has never had the conversation — the panel
  renders the identifier and the spans and says which half is missing. Nesting the trace under
  `/c/<id>` would have broken exactly the case the feature exists for.

An address naming a conversation this browser does not have renders the chat and says so. It does
not redirect, because rewriting the reader's address bar would lose the evidence of what they
opened.

The `/c/<id>` in an address is **this browser's** id for its own record, not Foundry's conversation
id. Sending that link to someone else opens an empty app that says so — correctly, since they do not
have the record.

## The one origin that is not the BFF (spec 044)

"The browser talks to the BFF and nothing else" is true of every request this app **makes**. An
`<img>` in an answer is not one of them: when the agent cites a page with a diagram, the browser
loads that diagram from the documentation host.

The alternative is worse. Proxying it would make the BFF a machine that fetches arbitrary URLs on
request, which is a larger hole than loading an image. So the image is loaded directly, with
`referrerpolicy="no-referrer"` and `loading="lazy"`, and this paragraph exists so a reader meets
the exception here rather than discovering it in a network panel.

Base64 cannot arrive: `react-markdown` sanitises a `data:` source to the empty string before the
app sees it — measured, not assumed — so an inlined image can neither cross the SSE stream nor be
written into this browser's record.

**The agent cannot produce an image yet.** That half of spec 044 is deferred for want of a verified
Foundry API, and is recorded in [`REFERENCES.md`](REFERENCES.md).

