# Tasks: Suggestions that belong to the agent

- [x] **T1 — test**: `examples` validates; a malformed block raises (AC11).
- [x] **T2 — implement**: `agent_spec.py` + the block in `agent_core.yaml` (AC9).
- [x] **T3 — test**: an owned agent's row carries them; an unowned one carries `[]` (AC1, AC10).
- [x] **T4 — implement**: `EXAMPLES_FOR_AGENT` and `AgentSummary.suggestions`.
- [x] **T5 — test**: the TypeScript mirror covers the new field.
- [x] **T6 — test**: the empty state renders what it is given, in both languages, and nothing when
      given none; derives nothing; issues no request (AC2–AC8).
- [x] **T7 — implement**: `EmptyState` takes a prop; the three keys leave `strings.ts`.
- [x] **T8 — docs/sync**, **T9 — refactor**, **T10 — spec** flip to `done`.

## Definition of done

- [ ] Every acceptance criterion maps to a passing test
- [ ] Lint clean · Tests green · `verify-gates` green
