# Tasks: The tool playground

- [x] **T1 — test**: `/tools` is the registry, and the flag gates it (AC1, AC9, AC12).
- [x] **T2 — implement**: the listing route and the setting.
- [x] **T3 — test**: running goes through `tool_executor.execute`, returns raw output and duration,
      and renders a failure as itself (AC3, AC4, AC5).
- [x] **T4 — test**: bad arguments are refused before execution (AC8).
- [x] **T5 — implement**: the run route with `jsonschema` validation.
- [x] **T6 — test (guard)**: no `conversation_id`, no model request, nothing stored (AC6, AC7).
- [x] **T7 — test**: the screen shows the schema and a raw JSON field, and says what it is not
      (AC2, AC10).
- [x] **T8 — implement**: `Playground.tsx`, the route and the way in.
- [x] **T9 — i18n/styles**, **T10 — SECURITY.md + docs**, **T11 — spec** flip to `done`.

## Definition of done

- [ ] Every acceptance criterion maps to a passing test
- [ ] Lint clean · Tests green · `verify-gates` green
