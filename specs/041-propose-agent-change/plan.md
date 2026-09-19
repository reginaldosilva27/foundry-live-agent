# Plan: Proposing a change to the agent

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

The file stays the truth; the screen becomes a better editor **of the file**.

**Two read-only BFF routes**, both behind one default-off flag:

- `GET /agents/{name}/definition` — the YAML this build was made from, the parsed instructions, and
  the instructions the service is actually serving, so the screen can state a drift before anybody
  edits. Owned agents only: proposing a change to a file we do not have is meaningless.
- `POST /agents/{name}/definition/proposal` — takes proposed instructions, validates them through
  `agent_spec.py`, and answers with the rewritten YAML and a unified diff. **It writes nothing** —
  not the file, not Foundry. The name says proposal and so does the behaviour.

`agent_spec.py` stays the one validator (§4). The editor does not re-describe the schema; it edits
one field and lets the validator judge the result.

**Alternative rejected:** letting the browser PUT the YAML and having the BFF write it. It is one
line of code and it is the thing this whole spec exists to avoid — the second copy of the agent's
definition appears on the first save, and `docs/harness-comparison.md` quietly stops meaning
anything.

## Affected files

- `backend/app/agent_definition.py` (new) — read, validate, diff. Pure where it can be.
- `backend/app/routers/agents.py` — the two routes.
- `backend/app/settings.py`, `routers/config.py` — `allow_proposals`.
- `frontend/src/panes/AgentDefinition.tsx` (new) + test.
- `frontend/src/panes/AgentDetail.tsx` — the way in, when the flag allows.
- `frontend/src/config.ts`, `i18n/strings.ts`, `styles/app.css`.
- `docs/development-workflow.md`.

## Contract / data model changes (§4)

`AgentEvent` unchanged (§9).

```
GET  /agents/{name}/definition
  { path, yaml, instructions, served_instructions, drifted, error }

POST /agents/{name}/definition/proposal   { instructions }
  { ok, yaml, diff, error }
```

`GET /config` gains `agents.can_propose`.

## i18n (§7)

The wording is load-bearing and AC6 asserts it: nothing here may say *saved*, *updated* or
*applied*. `propose.title` · `propose.fromThisBuild` · `propose.drift` · `propose.noDrift` ·
`propose.instructions` · `propose.produce` · `propose.download` · `propose.copyPatch` ·
`propose.remaining` (review, merge, apply) · `propose.invalid` · `propose.unavailable`.

## Test strategy (§2 — TDD)

| AC | Test |
|---|---|
| AC1 | the definition is served for an owned agent and refused for any other |
| AC2 | a served instruction differing from the file's is reported as drift |
| AC3 | a proposal answers a unified diff naming the file and the changed lines |
| AC4 | the rewritten YAML comes back whole, so it can be taken as a file |
| AC5 | **no route here writes**: asserted on the router's methods and on the Azure client never being touched |
| AC6 | no string in this feature says saved/updated/applied, in either language |
| AC7 | an invalid proposal answers its validation failure and no diff |
| AC8 | with the flag off, `/config` says so and no editor renders |
| AC11 | the editor offers no control for tools or model |
| AC12 | the label names the build, not the repository |
