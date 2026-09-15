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
