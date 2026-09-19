# Tasks: Charts and diagrams in an answer

> The work, ordered, as a TDD checklist. Each implementation task is preceded by the
> test that should fail first (red → green → refactor). Check boxes as you go.

## Phase 1 — the schema, as a parser (AC5 · AC6 · AC12)

- [x] **T1 — test**: a valid bar block and a valid line block parse into a `ChartSpec`.
- [x] **T2 — implement**: `state/chart.ts` — types and `parseChart`.
- [x] **T3 — test**: every rule has its own failure code — `bad_json`, `unknown_type`,
      `no_categories`, `no_series`, `too_many_series`, `length_mismatch`, `bad_value`,
      `missing_label`.
- [x] **T4 — implement**: the validation, defaulting nothing and dropping nothing (§5).
- [x] **T5 — test**: five series fail with `too_many_series`, and the parser does not return four
      of them (AC12).

## Phase 2 — the palette (AC8 · AC13)

- [x] **T6 — test**: `--ds-series-1..4` are defined by the design system.
- [x] **T7 — implement**: the four validated tokens in `public/ds/colors_and_type.css`.

## Phase 3 — the chart (AC1 · AC7 · AC8 · AC9)

- [x] **T8 — test**: a bar chart renders one mark per value, a line chart one point per value.
- [x] **T9 — implement**: `components/Chart.tsx`.
- [x] **T10 — test**: every series label appears in the output, and ≥2 series carry a legend (AC7).
- [x] **T11 — test (guard)**: `Chart.tsx` holds no colour literal (AC8), no static mermaid import
      exists in `src/` (AC14), and rendering a chart issues no request (AC9).
- [x] **T12 — implement**: whatever those guards demand.

## Phase 4 — the block, in an answer (AC1–AC5)

- [x] **T13 — test**: a closed `foundry-chart` block in Markdown renders an `<svg>`.
- [x] **T14 — test**: an unclosed fence renders a code block and no `<svg>` (AC3).
- [x] **T15 — test**: an invalid block renders a code block with its content intact plus the
      translated failure line (AC4, AC5).
- [x] **T16 — implement**: the `components.code` override in `Markdown.tsx`.

## Phase 5 — the diagram (AC2 · AC14)

- [x] **T17 — test**: a closed `mermaid` block renders the diagram container; an unclosed one does
      not.
- [x] **T18 — implement**: `components/Diagram.tsx` with `await import('mermaid')`.
- [x] **T19 — verify**: the built output puts mermaid in its own chunk, and the main chunk does not
      grow.

## Phase 6 — the contract with the agent (AC10)

- [x] **T20 — test**: every `foundry-chart` example in `agent_core.yaml` parses and renders.
- [x] **T21 — implement**: the instructions and the two worked examples in `agent_core.yaml`.

## Phase 7 — the record (AC11 · AC15)

- [x] **T22 — test**: a chart block survives a Markdown export as its source fence (AC15).
- [x] **T23 — i18n**: every key in `plan.md`, `en` + `pt`.
- [x] **T24 — styles**: the chart, the legend, the failure line.
- [x] **T25 — docs**: `docs/how-it-works/` — what the app renders and what it refuses to;
      `docs/REFERENCES.md` — the open item, that no recorded run yet proves the agent writes one.
- [x] **T26 — sync**: `CLAUDE.md` ↔ `AGENTS.md` (§6) — the fence is a new public contract.
- [x] **T27 — refactor**: clean up, keep tests green.
- [x] **T28 — spec**: flip `spec.md` status to `done`.

## Definition of done

- [ ] Every acceptance criterion in `spec.md` maps to a passing test
- [ ] Lint clean
- [ ] Tests green
- [ ] `verify-gates` skill run and green
