# Tasks: Proposing a change to the agent

- [x] **T1 — test**: reading the definition for an owned agent; refused for any other (AC1).
- [x] **T2 — test**: drift reported when the served instructions differ (AC2).
- [x] **T3 — implement**: `agent_definition.py` read + drift.
- [x] **T4 — test**: a proposal validates, answers YAML and a unified diff; an invalid one answers
      its failure and no diff (AC3, AC4, AC7).
- [x] **T5 — implement**: validate + rewrite + diff.
- [x] **T6 — test**: the flag gates both routes and `/config` (AC8); nothing here writes (AC5).
- [x] **T7 — implement**: the routes and the setting.
- [x] **T8 — test**: the screen labels the build, offers only instructions, and never says saved
      (AC6, AC11, AC12).
- [x] **T9 — implement**: `AgentDefinition.tsx` and the way in.
- [x] **T10 — i18n/styles**, **T11 — docs/sync**, **T12 — spec** flip to `done`.

## Definition of done

- [ ] Every acceptance criterion maps to a passing test, or is cut with its reason recorded
- [ ] Lint clean · Tests green · `verify-gates` green
