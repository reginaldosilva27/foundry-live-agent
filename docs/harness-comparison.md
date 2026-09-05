# Harness comparison — prompt agent vs. hosted agent

> **Status: stub with the comparison already sourced.** The `prompt-agent` column is filled by
> **spec 002**; the `langgraph` column stays marked **planned** until Phase 4 and is documented, not
> implemented. Everything below is cited in [REFERENCES.md](REFERENCES.md) (constitution §10).

## The two ways Foundry runs an agent

| | **Prompt agent** — ships now | **Hosted agent (LangGraph)** — planned |
|---|---|---|
| **Who runs the loop** | Foundry | Your container, on Foundry-managed infrastructure |
| **Authoring surface** | Portal, SDK, or REST | Agent Framework, LangGraph, OpenAI Agents SDK, custom code |
| **Runtime code to maintain** | None | Your agent logic |
| **Compute to manage** | None, fully managed | Container compute, Foundry-managed |
| **Autoscale** | With request volume | Container instances per session and request volume |
| **Agent identity (Entra)** | Yes | Automatic, dedicated per agent |
| **Cost model** | Per-call inference + tool usage | Per-call inference + tool usage **+ container compute** |
| **State** | Foundry conversations | Conversations + per-session `$HOME` and `/files` (5–60 min idle, 15 default) |
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
Microsoft has retired. When the LangGraph harness lands, it uses the real `azure.yaml`, and this
document shows both side by side.

## Tools: why not a Toolbox (yet)

A **Toolbox** — a curated tool set behind one managed MCP endpoint — is the recommended way to scale
tools across many agents. This repo declares tools **directly on the agent** instead, for one
concrete reason: **function calling cannot live in a Toolbox.** It is client-side execution by
definition. Putting the Learn MCP server in a Toolbox while the two function tools stayed direct
would split three tools across two mechanisms and teach the split rather than the idea. Toolbox is
documented here as the scaling path, and is the natural home for the extra MCP tools in Phase 4.

## Planned: the LangGraph harness

Documented, not implemented (see `ai/harness/langgraph/README.md`):

- LangGraph graph packaged as a hosted agent container exposing the **Responses** protocol, so the
  platform manages conversation history and streaming lifecycle.
- Model calls via the Responses API on the project endpoint, through the AI Gateway.
- Foundry-side tools (MCP, later Foundry IQ) declared in the Responses call or a Toolbox.
- Postgres checkpointer for graph state — noting hosted agents *also* persist `$HOME` and `/files`
  per session, so the doc must say which state lives where.
- Registered and versioned through `azure.yaml` + `azd`.
- Voice Live attached to the hosted agent, with a fallback of a thin prompt agent invoking the hosted
  agent as a tool (**chat-supervisor pattern**).

A third column, `ai/harness/agent-framework/`, may be added later.
