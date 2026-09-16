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
