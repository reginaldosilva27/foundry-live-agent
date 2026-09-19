# Plan: The tool playground

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

**Two routes, both behind `FOUNDRY_ALLOW_PLAYGROUND`:**

- `GET /tools` — the registry's function tools: name, description, schema. It **is** the registry,
  projected; no second list exists anywhere (AC1).
- `POST /tools/{name}/run` — validates the arguments against that schema with `jsonschema`, then
  calls `app.tool_executor.execute`, which is the **same function** `harness_factory` hands to
  every adapter. Not a copy of the execution path: the path.

That reuse is the whole §4 argument, and AC3 asserts it by patching `execute` and watching the
route go through it rather than by reading the source.

**The §8 argument is about who chose.** §8 forbids *the app* choosing which tool to call. A person
typing arguments and pressing run has chosen, exactly as a person choosing which agent answers is
configuration (spec 019). What makes it safe is that it is visibly outside the conversation: no
`conversation_id` is created, sent or stored, nothing reaches a model, and nothing lands in the
transcript or in this browser's record. Those are assertions, not intentions.

## Affected files

- `backend/app/routers/tools.py` (new), registered in `main.py`.
- `backend/app/settings.py`, `routers/config.py` — `allow_playground`.
- `backend/tests/test_tool_playground.py` (new).
- `frontend/src/panes/Playground.tsx` (new) + test; `state/route.ts` (`/tools`); `App.tsx`;
  `Sidebar.tsx`; `config.ts`; `i18n/strings.ts`; `styles/app.css`.
- `SECURITY.md` — an enabled playground is an unauthenticated way to spend `TAVILY_API_KEY`.
- `docs/how-it-works/function-call-round-trip.md` — the place to try one.

## Contract / data model changes (§4)

`AgentEvent` unchanged (§9) — the playground does not stream and emits no events.

```
GET  /tools                 { tools: [{ name, description, schema }], error }
POST /tools/{name}/run      { arguments: string }
                            { output, duration_ms, error }
```

`GET /config` gains `playground: { enabled }`.

## Test strategy (§2 — TDD)

| AC | Test |
|---|---|
| AC1 | `/tools` is exactly `registry.specs()`; no second list in backend or frontend source |
| AC2 | the screen renders the schema and a raw `arguments` field, and no generated form |
| AC3 | the route goes through `tool_executor.execute` — patched and observed |
| AC4 | the raw output and the duration render, copyable |
| AC5 | a raising tool renders its failure; `search_unavailable` renders verbatim |
| AC6 | no `conversation_id` anywhere, and no model request |
| AC7 | nothing run here reaches the transcript or storage |
| AC8 | arguments failing the schema are refused before execution |
| AC9 | with the flag off the endpoint refuses, not merely hidden |
| AC10 | the screen states no agent and no model were involved |
| AC12 | the flag is independent of any other surface |
