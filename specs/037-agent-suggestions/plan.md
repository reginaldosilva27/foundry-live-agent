# Plan: Suggestions that belong to the agent

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

The suggestions move from `strings.ts` into `agent_core.yaml`, travel on `GET /agents`, and the
empty state renders whatever the answering agent's row carries.

**The BFF joins two sources.** The service's listing says which agents exist; our YAML says what
ours are for. `app/agents.py` already imports `OWNED_AGENT_NAMES` from `harness_factory` for spec
031, so the same module gains `EXAMPLES_FOR_AGENT` — read from the same files, once per process.
A row whose name is not ours carries `suggestions: []`, and the frontend renders nothing.

**Alternative rejected:** deriving suggestions from the agent's tools in the frontend. That is the
app inventing a description of an agent, which the non-goals name explicitly, and it would produce
confident nonsense for the eight agents this repository did not write.

## Affected files

- `ai/harness/_shared/agent_spec.py` — an `examples` block, validated for `en`/`pt`.
- `ai/harness/_shared/agent_core.yaml` — the three current suggestions, moved unchanged.
- `backend/app/harness_factory.py` — `EXAMPLES_FOR_AGENT`, beside `OWNED_AGENT_NAMES`.
- `backend/app/agents.py` — `AgentSummary.suggestions`.
- `frontend/src/types/agents.ts` + parity test.
- `frontend/src/panes/EmptyState.tsx` + test — takes the suggestions as a prop.
- `frontend/src/App.tsx` — passes the answering agent's row.
- `frontend/src/i18n/strings.ts` — the three keys leave.

## Contract / data model changes (§4)

`AgentEvent` unchanged (§9). `GET /agents` rows gain:

```
suggestions: [{ en: string, pt: string }]   // [] when this repository did not write the agent
```

The definition is the single source of truth; the frontend keeps no list, which is the whole point.

## i18n (§7)

`empty.suggestion1..3` are **deleted** from `strings.ts` — they now live in the agent definition,
carrying their own `en` and `pt`. Nothing replaces them, and `strings.test.ts` will not flag them
because they are gone rather than half-translated.

## Test strategy (§2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1/AC9 | the prompt agent's row carries the three current suggestions, unchanged | `backend/tests/test_agent_suggestions.py` |
| AC2/AC10 | an unowned agent's row carries `[]`, and the screen renders no list | backend + `EmptyState.test.tsx` |
| AC3 | changing the row changes what renders | `EmptyState.test.tsx` |
| AC4 | each suggestion renders in the interface language | `EmptyState.test.tsx` |
| AC5 | choosing one sends exactly its text | `EmptyState.test.tsx` |
| AC6/AC7 | the component derives nothing from tools/name/kind and issues no request | `EmptyState.test.tsx` |
| AC8 | with the listing unavailable, no hard-coded list appears | `EmptyState.test.tsx` |
| AC11 | a malformed `examples` block fails validation | `ai/tests/test_agent_spec.py` |
