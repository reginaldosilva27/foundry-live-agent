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
| **State** | Foundry conversations | Conversations + per-session `$HOME` and `/files` (2–60 min idle, 15 default) |
| **Best for** | Fast start; production agents without custom orchestration | Agents that call into custom code; custom orchestration |

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
comparison a measurement of the harness rather than of two agents that drifted apart.

## Tools: why not a Toolbox (yet)

A **Toolbox** — a curated tool set behind one managed MCP endpoint — is the recommended way to scale
tools across many agents. This repo declares tools **directly on the agent** instead, for one
concrete reason: **function calling cannot live in a Toolbox.** It is client-side execution by
definition. Putting the Learn MCP server in a Toolbox while the two function tools stayed direct
would split three tools across two mechanisms and teach the split rather than the idea. Toolbox is
documented here as the scaling path, and is the natural home for the extra MCP tools in Phase 4.

## Measured, not documented — what spec 018 found

Both agents run the **same model, the same instructions and the same four tools**, from one file
(`ai/harness/_shared/agent_core.yaml`). Only the harness differs. Everything below is therefore a
property of the harness, and every row came from a recording or a live query on 2026-09-16.

| | **Prompt agent** | **Hosted agent** |
|---|---|---|
| Who executes `search_web` et al. | the BFF | the container |
| The event | `tool_call` `executor: "app"` → `tool_result` | `tool_call` `executor: "foundry"` → `tool_result` |
| Rendered tag | `bff` | `foundry` |
| Who is the MCP client | **Foundry** → `mcp_call` | **the container** → ordinary tool calls, **never `mcp_call`** |
| Learn tool names | `microsoft_learn` (one server) | `microsoft_docs_search` · `microsoft_code_sample_search` · `microsoft_docs_fetch` (three tools) |
| `response.completed` per turn | **2** — Foundry completes the leg it is waiting on | **1** — the container never hands the turn back |
| Token usage | reported | **`usage: null`** — none at all |
| Reasoning summaries | `detailed`; the card fills | **none**; the card stays empty |
| Trace join key | `gen_ai.response.id` | **`microsoft.session.id`** == `agent_session_id`; no span carries a response id |
| A BFF-run tool in traces | invisible — §8 showing in telemetry | **visible**: `execute_tool get_current_datetime` is a span |
| Voice Live | attaches | **attaches** — same query, only the agent named changes |
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

A third column, `ai/harness/agent-framework/`, using Microsoft Agent Framework's `FoundryChatClient`.
