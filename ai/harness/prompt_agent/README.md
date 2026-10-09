# `prompt-agent/` — Foundry runs the loop

The harness that ships. The agent's instructions, model and tools live **in Foundry**; this folder
contains the definition that puts them there and the adapter that streams the result back.

## What runs where

| | Runs in **Foundry** | Runs in **this app** |
|---|---|---|
| Deciding which tool to call | ✅ | never |
| Deciding when to stop | ✅ | never |
| Calling the model | ✅ | never |
| `microsoft_learn` (MCP) | ✅ | — |
| `get_current_datetime` | — | ✅ |
| `lookup_knowledge` | — | ✅ |
| `search_web` | — | ✅ |
| Turning the stream into `AgentEvent`s | — | ✅ |

The three function tools are the interesting rows. Foundry emits a `function_call` item and **stops**.
Our backend looks the name up in the registry, runs it, and posts a `function_call_output` back on
the same conversation. If it doesn't, the run hangs until it expires ten minutes later — and from the
browser that looks like the stream simply stopped.

That is why `check_stream` in the contract has an invariant for it. A local `tool_result` is
not an upstream receipt, however: submission can fail after execution.

The adapter permits `max_turns` execution legs (default 8) plus **one settlement leg** to submit
the last outputs: at most 9 upstream requests by default. Settlement never executes new tool
requests; it reports them and ends with `turn_limit_exceeded`, explicitly leaving them unanswered.
It may instead finish normally, with one `done` and summed usage. This cap is a protocol bound,
not an agent decision or an unlimited extension. See the
[round-trip budget and failure limits](../../../docs/how-it-works/function-call-round-trip.md#the-budget-includes-settling-the-last-outputs-spec-054).

## The definition

[`agent.yaml`](agent.yaml), applied by `ai/scripts/apply_agent.py`:

```bash
just agent                                        # apply
python scripts/apply_agent.py --dry-run           # validate and print, no Azure needed
```

Each apply creates a new **immutable version**; that is the rollback story, so running it twice is
normal. The loader cross-checks every declared function tool against the registry, so a definition
naming a tool nobody implements fails at load rather than in production.

The schema is **ours**, marked `schema_version: foundry-live-agent/v1`. Foundry's own `agent.yaml`
is deprecated and its replacement describes hosted agents. See
[`docs/harness-comparison.md`](../../../docs/harness-comparison.md).

## The model, and one thing it costs us

```yaml
model: foundry-analytics-demo/gpt-4o
```

The `<connection>/<model>` form routes inference through a **bring-your-own-model** connection — the
APIM gateway. A plain name here silently bypasses the gateway, which is easy to do by accident, so
`apply_agent.py --dry-run` prints whether the gateway is in the path.

**`gpt-4o` is not a reasoning model.** On this path the agent emits no reasoning summaries, so the
activity panel's reasoning card has nothing to show. That is a real limitation of the current setup,
stated here rather than left as an unexplained empty panel (§5). To get summaries back, expose a
GPT-5.x model on the same connection and change one line above.

## Trade-offs

You maintain no runtime code and no container, and you cannot express custom orchestration. If you
need a graph, that is the [`langgraph`](../langgraph/README.md) harness — scaffolded, not built.
