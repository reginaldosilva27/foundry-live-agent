# `ai/` — the agent layer

Harnesses, agent definitions, and the client-side tools. This is the layer that talks to Foundry.

## What lives here

```
harness/
  _shared/
    contract.py     HarnessAdapter Protocol + the AgentEvent set  ← the boundary (§9)
    agent_spec.py   Loader/validator for our agent.yaml
    tools/          The function tools, implemented ONCE and shared by every harness
  prompt-agent/     Implemented — Foundry runs the loop
  langgraph/        SCAFFOLD ONLY — no working code, and its README says so
tests/
  fixtures/         Event streams RECORDED from real Foundry runs (§5)
  test_contract.py  Parameterised over adapters — a new harness reuses it unedited
scripts/
  apply_agent.py    agent.yaml → Agent Service SDK
```

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
