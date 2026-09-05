# `langgraph/` — scaffold, not an implementation

**Nothing here works.** `adapter.py` raises `NotImplementedError` from every method, including its
constructor. It exists so the intended design is visible and so `AGENT_HARNESS=langgraph` fails with
a sentence that explains itself rather than an `AttributeError` three frames deep.

This is deliberate (constitution §5): a scaffold that pretends to work is worse than no scaffold.

## What it would be

A LangGraph graph packaged as a Foundry **hosted agent** — a container image that Foundry runs, with
a managed endpoint, per-session VM-isolated sandboxes, a dedicated Entra identity, autoscaling and
built-in tracing.

| Concern | Decision |
|---|---|
| Protocol | **Responses** — the platform then manages conversation history and the streaming lifecycle. `Invocations` only if a custom payload is ever needed. |
| Model calls | The **Responses API** on the project endpoint, through the AI Gateway |
| Foundry-side tools | MCP (later Foundry IQ) declared in the Responses call, or via a **Toolbox** |
| Client-side tools | The same `_shared/tools/` this repo already has. **Unchanged.** |
| Graph state | A **Postgres checkpointer** |
| Deployment | `azure.yaml` + `azd` — `azure.ai.project` and `azure.ai.agent` services |
| Voice | Voice Live attached to the hosted agent |

### Where state lives — the part that is easy to get wrong

Hosted agents already persist `$HOME` and `/files` per session, with a configurable idle timeout
(5–60 minutes, 15 by default) and deletion after 30 days of inactivity. A Postgres checkpointer is
**not** a replacement for that; it is for graph state that must outlive a session or be queried
outside it. Whichever is chosen, this README must say which state lives where, or the next reader
will assume both and duplicate it.

### Voice, and the fallback

Voice Live attaches to a hosted agent directly. If that turns out to be constrained, the fallback is
the **chat-supervisor pattern**: a thin *prompt* agent that Voice Live attaches to, which invokes the
hosted agent as a tool. Slower, but it keeps one voice path across both harnesses.

## How it gets proven

Not by new tests. By the existing ones:

```python
from tests.conformance import run_conformance

await run_conformance(LangGraphAdapter(...))
```

If the suite has to change to accommodate it, either the contract was wrong or the adapter is —
and that is a conversation worth having explicitly.

## What it will cost you

See [`docs/harness-comparison.md`](../../../docs/harness-comparison.md). In one line: you trade
"nothing to operate" for full control of the loop, and you start paying for container compute per
active session — so oversizing multiplies cost by concurrency.

## Also possible later

`harness/agent-framework/` as a third column, using Microsoft Agent Framework's `FoundryChatClient`.
