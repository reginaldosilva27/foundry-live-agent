# Harness comparison — prompt agent vs. hosted agent

> **Status: both columns are real.** The `prompt-agent` column was filled by **spec 002**; the
> hosted column by **spec 018** on **2026-09-16**, from a deployed container answering real
> questions — not from the documentation. Where a number here came from a recording rather than a
> doc, it says so. Everything is cited in [REFERENCES.md](REFERENCES.md) (constitution §10).

## The two ways Foundry runs an agent

| | **Prompt agent** — ships | **Hosted agent (LangGraph)** — ships |
|---|---|---|
| **Who runs the loop** | Foundry | Your container, on Foundry-managed infrastructure |
| **Authoring surface** | Portal, SDK, or REST | Agent Framework, LangGraph, OpenAI Agents SDK, custom code |
| **Runtime code to maintain** | None | Your agent logic |
| **Compute to manage** | None, fully managed | Container compute, Foundry-managed |
| **Autoscale** | With request volume | Container instances per session and request volume |
| **Agent identity (Entra)** | Yes | Automatic, dedicated per agent |
| **Cost model** | Per-call inference + tool usage | Per-call inference + tool usage **+ container compute** |
| **What the inspector can show (spec 030)** | Instructions, tools with their schemas, model, reasoning configuration | No instructions, no tools, no model of its own: a container image, cpu, memory and the protocols it speaks |
| **Cost the app can estimate (spec 028)** | Inference, from the token counts Foundry reports | **None today** — a hosted turn's `response.completed` carries `usage: null`, so there is nothing to price. Container compute is not estimable from the browser either. |
| **State** | Foundry conversations | Conversations + per-session `$HOME` and `/files` (2–60 min idle, 15 default) |
| **Best for** | Fast start; production agents without custom orchestration | Agents that call into custom code; custom orchestration |

## Side by side, in the app

Spec 020 puts the two columns of this table on a screen: `/compare` sends one question to two agents
at once and each answers into its own column, with its own tool rows, its own executor tags and its
own figures. It is the demonstration of what the table argues.

### Measured — 2026-09-20

AC16, run. Six turns through the real BFF (`ai/scripts/compare_harnesses.py`, which posts to
`/chat` exactly as the screen does), against the live project `ai-admin2354ai223634534-project`,
`gpt-5.5`, from São Paulo. Every turn is committed under
[`ai/tests/fixtures/recorded/`](../ai/tests/fixtures/recorded/) with its summary; **these are two
turns per probe (one per harness), not a benchmark** — they are what one run looked like, on one day, from one
machine, and the numbers include one localhost hop.

| | prompt agent | hosted agent |
|---|---|---|
| First `text_delta` | **6.4s** · 4.3s · 6.6s | **14.6s** · 13.6s · 13.9s |
| Total | 22.8s · 43.5s · 28.3s | 27.6s · 30.7s · 27.2s |
| Events in the turn | 387 · 311 · 198 | 373 · 491 · 269 |
| `reasoning_summary` | 250 · 88 · 79 | **absent in these recordings** |
| `usage` | reported | **`null`** |
| `mcp_call` | 2 · 0 · 0 | **absent in these recordings** |

These observations distinguish the implementations, without explaining latency causally:

- **First text arrived later for hosted in these three probes.** Total durations overlapped.
  One turn per harness per probe cannot separate planning, cold starts, network effects or
  throughput. This is not a performance ranking or production recommendation.
- **Hosted usage was null**, so the UI reports no token price rather than inventing a zero.
- **Learn appeared as ordinary hosted tool calls**, not `mcp_call`, because this container is the
  MCP client. Prompt Learn calls appear under `microsoft_learn`.

One more, which is a property and not a measurement: the prompt agent's function tools arrive with
`executor: "app"` (`get_current_datetime`, `lookup_knowledge`, `search_web` — our BFF answers them),
and the hosted agent's arrive with `executor: "foundry"`. Same tools, same question, different side
of the boundary, visible in the recordings.

## What you give up by choosing each

**Choosing the prompt agent**, you give up custom orchestration: you cannot express a graph, a
cyclic plan, or logic between model calls. You gain having nothing to operate.

**Choosing the hosted agent**, you give up "nothing to maintain": you own a container image, its
dependencies, its cold starts and its resource sizing — and you pay for compute per active session,
so oversizing multiplies cost by concurrency. You gain full control of the loop.

## The deprecation that shapes this repo

Foundry's own `agent.yaml` / `agent.manifest.yaml` (AgentSchema) are **deprecated**. As of the
Foundry `azd` extensions (`azure.ai.agents` 1.0.0-beta.1), hosted-agent configuration lives in a
single **`azure.yaml`**.

That replacement describes *hosted* agents — it is not a prompt-agent format. So this repo keeps its
own small, clearly-labelled schema (`schema_version: foundry-live-agent/v1`) at
`ai/harness/<harness>/agent.yaml`, applied through the Agent Service SDK by
`ai/scripts/apply_agent.py`. It preserves "agent definition as code" without teaching a schema
Microsoft has retired.

**Both are now in the repo, and they do not disagree**, because one is generated from the other.
`ai/azure.yaml` is Microsoft's format, written by `ai/scripts/build_hosted_config.py` from
`ai/harness/langgraph/agent.yaml`, with a test that fails if the committed file drifts (§4). The
behaviour they share — model, instructions, tools — lives in neither: it is in
`ai/harness/_shared/agent_core.yaml`, which both harnesses `extends:`. That is what makes this
comparison less vulnerable to definition drift. It does not isolate the causes of latency.

## Tools: why not a Toolbox (yet)

A **Toolbox** — a curated tool set behind one managed MCP endpoint — is the recommended way to scale
tools across many agents. This repo declares tools **directly on the agent** instead, for one
concrete reason: **function calling cannot live in a Toolbox.** It is client-side execution by
definition. Putting the Learn MCP server in a Toolbox while the three function tools stayed direct
would split four declared surfaces across two mechanisms and teach the split rather than the idea. Toolbox is
documented here as the scaling path, and is the natural home for the extra MCP tools in Phase 4.

## Measured, not documented — what spec 018 found

Both agents run the **same model, the same instructions and the same four tools**, from one file
(`ai/harness/_shared/agent_core.yaml`). This reduces authoring drift; the rows below describe
this implementation and its recordings/live queries on 2026-09-16, not every hosted runtime.

| | **Prompt agent** | **Hosted agent** |
|---|---|---|
| Who executes `search_web` et al. | the BFF | the container |
| The event | `tool_call` `executor: "app"` → `tool_result` | `tool_call` `executor: "foundry"` → `tool_result` |
| Rendered tag | `bff` | `foundry` |
| Who is the MCP client | **Foundry** → `mcp_call` | **the container** → ordinary tool calls, **no `mcp_call` in the current normalizer** |
| Learn tool names | `microsoft_learn` (one server) | `microsoft_docs_search` · `microsoft_code_sample_search` · `microsoft_docs_fetch` (three tools) |
| `response.completed` per turn | **2 for one function round trip**; more rounds mean more completions | **1** — the container never hands the turn back |
| Token usage | reported | **`usage: null`** — none at all |
| Reasoning summaries | `detailed`; present in these probes, optional per turn | **absent in this stream**; the card stays empty |
| Trace join key | `gen_ai.response.id` | **`microsoft.session.id`** == `agent_session_id`; no span carries a response id |
| A BFF-run tool in traces | invisible — §8 showing in telemetry | **visible**: `execute_tool get_current_datetime` is a span |
| Voice Live | attaches | **attachment observed** — one `session.created` frame, not a full voice turn |
| Adapter shape | a loop over legs, answering function calls | one stream, no loop, nothing to answer |
| Compute bill | none | per active session |

### The two findings, in one sentence each

**Where the tools run.** A hosted agent calls its own tools, so every `function_call` arrives
already paired with its `function_call_output` and the BFF has nothing to answer — which is why the
hosted adapter has no loop at all and `submit_tool_output` is structurally unreachable.

**Who is the MCP client.** With a prompt agent Foundry holds the MCP session for you; with a hosted
agent you hold it. Same server, same corpus, different event — and nothing in the app may read a
missing `mcp_call` as an error.

### The ones that are worse, said plainly

A reference implementation that only reported the flattering numbers would be advertising. The
hosted agent reports **no token usage** and **no reasoning summaries**, and its turns are **not
reachable from the trace panel**, because its spans carry no `gen_ai.response.id`. The first two are
absences the contract always permitted; the third is a real gap, and closing it means putting
`agent_session_id` on `trace_ids` — an `AgentEvent` change, so it needs its own spec (§9).

It also costs container compute per active session, and it starts cold.

### What it takes to operate

Three things the prompt agent needs none of, all discovered by doing it:

1. **A role assignment the docs say is unnecessary.** The agent identity is documented as having
   implicit model access. It does not: the first turn failed `401 PermissionDenied`. It needs
   `Foundry User` at project scope — and the identity does not exist until after the first deploy,
   so the real sequence is deploy → assign → wait → works.
2. **A secret path.** `search_web` needs a key, and it may live in neither the image nor the agent
   version. The container reads it from a Key Vault with its own identity; a Foundry *Key Vault
   connection* is a different mechanism and cannot do this.
3. **A container to keep current** — its base image, its dependencies, its pip.

See [`../ai/harness/langgraph/README.md`](../ai/harness/langgraph/README.md) for the commands.

## Also possible later

A third harness or a Copilot integration remains a separate educational increment. No SDK client,
product surface or API is selected here without a current documentation read (§10).

## Learn by observing

Follow the [English](learning-journey.md) or [Portuguese](learning-journey.pt-BR.md) journey.
The hosted graph compiles without a checkpointer; a forwarded Foundry conversation pointer is not
proof of end-to-end hosted multi-turn continuity. Verify that separately before teaching it as a
delivered capability. Manual provisioning/cleanup is described in [infra](../infra/README.md);
root setup instructions and new command/capture verification await #32.

## `examples:` — what an agent is worth being asked (spec 037)

Our schema, not Microsoft's, like the rest of `agent.yaml`. An optional list, each entry carrying
`en` and `pt`, validated by `agent_spec.py` — a missing `pt` fails `apply_agent.py` rather than
reaching a bilingual UI as an English-only string (§7).

```yaml
examples:
  - en: What time is it in Sao Paulo right now?
    pt: Que horas são em São Paulo agora?
```

These used to be three hard-coded strings in the frontend. What an agent is good at is a property
of the **agent**, and a copy in TypeScript was a second description of it, free to drift from the
one that actually ships (§4).

**The service has no field for them.** `GET {project_endpoint}/agents` returns `instructions`,
`model`, `tools` and `reasoning` — nothing that could hold an example question. So the BFF joins
the service's rows against our own definitions by name, and an agent this repository did not write
carries none. That is a permanent limitation rather than a gap to close, and the honest one: we
cannot know what somebody else's agent is for. `AgentVersionDetails.metadata` could technically
carry them, but writing it would make this app an author of agent state, which spec 031 rules out.

