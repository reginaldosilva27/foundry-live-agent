# `ai/` — the agent layer

Harnesses, agent definitions, and the client-side tools. This is the layer that talks to Foundry.

## What lives here

```
harness/
  _shared/
    contract.py       HarnessAdapter Protocol + the AgentEvent set  ← the boundary (§9)
    agent_spec.py     Loader/validator for our agent.yaml, including `extends:`
    agent_core.yaml   Model + instructions + tools — the ONE definition both harnesses extend (§4)
    tools/            The function tools, implemented ONCE and shared by every harness
  prompt_agent/       Foundry runs the loop; the BFF answers its function calls
  langgraph/          A LangGraph graph Foundry runs as a HOSTED AGENT container
    adapter.py        Runs in the BFF. One stream, no loop — the container answers its own calls
    agent/            Runs on FOUNDRY. The graph, its tools, its Dockerfile — this is the agent
azure.yaml            GENERATED from harness/langgraph/agent.yaml; what `azd` deploys
tests/
  conformance.py    The adapter-agnostic suite. Byte-identical since spec 001 — both harnesses
                    proved themselves against it without editing it
  fixtures/         Event streams RECORDED from real Foundry runs (§5)
scripts/
  apply_agent.py         agent.yaml → Agent Service SDK (prompt agents only)
  build_hosted_config.py agent.yaml → azure.yaml, with --check for the drift test
  spike_hosted.py        Record a live hosted-agent turn as a fixture
```

**Two harnesses, one contract.** They run the same model, instructions and tools; only *where the
loop runs* differs, and with it who executes the tools. What that costs is measured in
[`../docs/harness-comparison.md`](../docs/harness-comparison.md).

## Why the tools live here and not in `backend/`

They belong to the **agent**, not to the web app. Both harnesses declare and execute the same two
functions, so their location makes it structurally obvious that swapping the harness does not change
the tools (constitution §4).

## A note on `agent.yaml`

Foundry's own `agent.yaml` (AgentSchema) is **deprecated** — superseded by `azure.yaml` for hosted
agents. Ours is a small schema of our own, labelled `schema_version: foundry-live-agent/v1`, applied
through the Agent Service SDK. See `docs/harness-comparison.md`.

## Gate

```bash
ruff check . && pytest -q
```

Integration tests that hit real Foundry are gated behind `RUN_INTEGRATION_TESTS=1`.

Filled by **specs 001 and 002**.
