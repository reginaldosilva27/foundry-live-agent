# `backend/` — the BFF

FastAPI (Python 3.12, async). A **Backend For Frontend**, not an agent runtime.

## What lives here

| Concern | Where |
|---|---|
| SSE streaming of `AgentEvent`s to the browser | `app/sse.py`, `app/routers/chat.py` |
| Executing the function tools Foundry asks for | `app/tool_executor.py` |
| Application Insights span lookup | `app/routers/traces.py` |
| Voice Live control channel (WebRTC signalling) | `app/routers/voice.py` |
| Harness selection from `AGENT_HARNESS` | `app/harness_factory.py` |
| OpenTelemetry → Azure Monitor | `app/telemetry.py` |

## What must never live here

**No agent-loop logic** (constitution §8). This layer never chooses *which* tool to call, never
re-prompts the model, never loops on model output, and never duplicates state Foundry owns.

Executing a function tool Foundry asked for, and submitting its output, **is** allowed — that is the
documented client-side contract. The distinction is *choice* versus *execution*.

## Gate

```bash
ruff check . && ruff format --check . && pytest -q
```

Filled by **spec 003**.
