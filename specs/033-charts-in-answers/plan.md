# Plan: Charts and diagrams in an answer

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

The agent writes a fenced block; the app renders it. That is all. `Markdown.tsx` already routes
fenced code through `react-markdown`, so the whole feature is a `components.code` override that
recognises two languages and falls through to today's behaviour for everything else. **Nothing
inspects the answer text** — the fence is the signal, and it is `react-markdown`'s parser that finds
it, not ours (§8, AC9).

Four pieces:

1. **`state/chart.ts` — the schema, as a parser.** Pure, no React, no DOM. `parseChart(source)`
   returns a `ChartSpec` or a failure **code**. Being pure is what lets the same function validate
   the examples in `agent_core.yaml` in CI (AC10).
2. **`components/Chart.tsx` — hand-drawn SVG.** No charting dependency: a bar and a line chart are
   about 120 lines of SVG, and writing them is what makes AC8 achievable, since every fill is a
   token this repo chose rather than one a library picked.
3. **`components/Diagram.tsx` — mermaid, dynamically imported.** `await import('mermaid')` inside an
   effect, so Vite emits a separate chunk. Until it resolves, and if it throws, the block renders
   as a code block — the state AC3 already defines.
4. **`agent_core.yaml` — the instructions**, with two worked examples that are also the fixtures.

**Alternative rejected:** a charting library (Recharts, Chart.js). Each is 50–150 kB gzipped for two
chart types we fully specify, each ships its own colour defaults that AC8 would then have to fight,
and each renders DOM we do not control at exactly the point where "readable without colour" has to
be true. Hand-drawn SVG is smaller, and the constraint is the feature.

### The palette, measured rather than chosen

The design system had **no categorical palette** — a brand blue, neutrals, and status colours, which
are reserved and must never stand in for a series. So one was built and validated with the dataviz
skill's checker, all-pairs (every series is on screen at once, so adjacent-only would be the wrong
check):

```
#0074FF  #B45309  #00998C  #A21CAF        light surface, --pairs all
  lightness band  PASS    chroma floor  PASS    contrast  PASS
  CVD separation  PASS    worst all-pairs ΔE 12.5 (deutan)
  normal vision   PASS    worst all-pairs ΔE 22.3
```

`#0074FF` is the brand blue, so a one-series chart is Dataside blue. **No fifth hue passed** — eight
candidates were tried across the wheel and each collided with one of the four. That is why AC12
refuses a fifth series instead of folding it into an "Other": aggregating is the app deciding what
the data means.

One caveat recorded rather than hidden: the worst **tritan** separation in the set is ΔE 4.7. The
checker passes the palette on deutan/protan, which are far more common, and AC7's mandatory series
labels are the secondary encoding that makes the pair legal. Labels are not decoration here.

Tokens land in `public/ds/colors_and_type.css` as `--ds-series-1..4`, which is where the design
system's own values live and what `layout.test.ts` already validates against.

## Affected files

- `frontend/src/state/chart.ts` (new) — schema, parser, failure codes.
- `frontend/src/state/chart.test.ts` (new).
- `frontend/src/components/Chart.tsx` (new) — bar + line in SVG.
- `frontend/src/components/Chart.test.tsx` (new).
- `frontend/src/components/Diagram.tsx` (new) — lazy mermaid.
- `frontend/src/components/Markdown.tsx` — the `code` override.
- `frontend/src/components/Markdown.test.tsx` (new or extended) — AC1–AC6 through the real renderer.
- `frontend/src/state/chartContract.test.ts` (new) — AC10: the `agent_core.yaml` examples, parsed.
- `frontend/src/state/exportTurn.test.ts` — AC15.
- `frontend/src/i18n/strings.ts`, `frontend/src/styles/app.css`,
  `frontend/public/ds/colors_and_type.css`.
- `ai/harness/_shared/agent_core.yaml` — the instructions and the two examples.
- `frontend/package.json` — `mermaid`.
- `docs/how-it-works/`, `docs/REFERENCES.md` (the open item).

## Contract / data model changes (constitution §4)

`AgentEvent` unchanged (§9) — a chart is `text_delta`.

**The block schema is a new public contract.** Its single source of truth is `state/chart.ts`: the
TypeScript type and the parser. `agent_core.yaml` documents it in prose for the model, and
`chartContract.test.ts` extracts the examples from that YAML and runs them through `parseChart`, so
the two cannot drift.

```
```foundry-chart
{
  "type": "bar",
  "title": "Latency by harness",
  "x": { "label": "Harness", "categories": ["prompt-agent", "hosted"] },
  "y": { "label": "ms" },
  "series": [{ "label": "p50", "values": [1240, 980] }]
}
```
```

Rules the parser enforces, each a failure code the UI translates: `bad_json` · `unknown_type` ·
`no_categories` · `no_series` · `too_many_series` · `length_mismatch` · `bad_value` ·
`missing_label`. Nothing is defaulted and nothing is dropped (§5, AC6).

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `chart.couldNotDraw` | This block could not be drawn as a chart | Não foi possível desenhar este bloco como gráfico |
| `chart.reason.bad_json` | it is not valid JSON | não é JSON válido |
| `chart.reason.unknown_type` | that chart type is not supported | esse tipo de gráfico não é suportado |
| `chart.reason.no_categories` | it declares no categories | não declara categorias |
| `chart.reason.no_series` | it declares no series | não declara séries |
| `chart.reason.too_many_series` | it has more than four series | tem mais de quatro séries |
| `chart.reason.length_mismatch` | a series has a different number of values than there are categories | uma série tem um número de valores diferente do número de categorias |
| `chart.reason.bad_value` | a value is not a number | um valor não é um número |
| `chart.reason.missing_label` | a series has no label | uma série está sem rótulo |
| `diagram.failed` | This block could not be drawn as a diagram | Não foi possível desenhar este bloco como diagrama |
| `chart.of` | {title} — {type} chart | {title} — gráfico de {type} |

`chart.reason.*` deliberately says *which* rule failed: the reader is debugging their agent's
instructions, and "invalid" would make the failure unteachable.

## Test strategy (constitution §2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | a valid bar and a valid line block render an `<svg>` with a mark per value | `Markdown.test.tsx`, `Chart.test.tsx` |
| AC2 | a closed `mermaid` block renders the diagram container | `Markdown.test.tsx` |
| AC3 | an unclosed fence renders `<code>` and no `<svg>` | `Markdown.test.tsx` |
| AC4 | an invalid block renders `<code>` with its content intact **plus** the failure line | `Markdown.test.tsx` |
| AC5 | `"type": "pie"` → AC4 with `unknown_type` | `chart.test.ts`, `Markdown.test.tsx` |
| AC6 | a missing value, a non-numeric value, a short series → AC4, and no chart with a gap | `chart.test.ts` |
| AC7 | every series' label is in the rendered output; the chart carries a legend for ≥2 series | `Chart.test.tsx` |
| AC8 | `Chart.tsx` contains no `#hex`, `rgb(`, `hsl(` or named colour | `Chart.test.tsx` |
| AC9 | the chart modules contain no `fetch`/`import(` of data, and rendering one issues no request | `Chart.test.tsx` |
| AC10 | every `foundry-chart` example in `agent_core.yaml` parses and renders | `chartContract.test.ts` |
| AC11 | both languages | existing `strings.test.ts` |
| AC12 | five series → `too_many_series`, and nothing is aggregated | `chart.test.ts` |
| AC13 | the four tokens are defined, and the recorded validator output is in the plan | `Chart.test.tsx` (tokens exist), this document (the run) |
| AC14 | no static `from 'mermaid'` anywhere in `src/` | `Chart.test.tsx` |
| AC15 | a turn whose answer holds a chart block exports with the fence intact | `exportTurn.test.ts` |

**AC10 is the one that earns its keep.** It reads `ai/harness/_shared/agent_core.yaml`, pulls every
` ```foundry-chart ` block out of the instructions, and asserts each parses. An instruction edited
to describe a field the parser does not accept fails there.

## Risks / trade-offs

- **Mermaid renders untrusted text.** The diagram source comes from a model, and mermaid draws what
  it is given. It runs with `securityLevel: 'strict'` (its default) — no HTML in labels, no click
  handlers — and the container is not `dangerouslySetInnerHTML` of arbitrary markup but the SVG
  mermaid returns. Worth stating because "render what the model wrote" is exactly the shape of a
  problem in a less careful feature.
- **The palette caps series at four.** Measured, not chosen, and the cap is visible to the agent in
  its instructions so it can aggregate deliberately if it wants to.
- **A dark theme will need the palette re-validated** (spec 036). Stated in the spec; it is not an
  automatic flip.
- **The agent is not yet known to write valid blocks.** Open item in `docs/REFERENCES.md`, beside
  spec 031's four, closed by one recorded turn.
