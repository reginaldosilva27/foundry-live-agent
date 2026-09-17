# Spec: Charts and diagrams in an answer

| | |
|---|---|
| **ID** | 033-charts-in-answers |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

An agent that has just searched the web, queried Learn and counted something can only describe the
result in prose or in a Markdown table. Some answers are shapes — a comparison of two harnesses'
latencies, a breakdown of where a turn's tokens went, the architecture the agent is explaining — and
a shape written as a paragraph is a shape the reader has to rebuild.

The reason to write this as a spec rather than an afternoon's work is that the obvious implementation
is the one constitution §8 forbids, and the two are easy to confuse.

**The legal design**: the agent writes a fenced block, the app renders it. That is rendering
`text_delta`, the same category as the Markdown, the syntax highlighting and the tables already
rendered today. No `AgentEvent` changes, the app decides nothing, and the test §8 names — *would this
still be true if the harness were swapped?* — passes, because any harness emitting the same text
produces the same picture.

**The illegal design**: the app notices the answer contains numbers and decides to call a charting
tool, or re-prompts the model asking for a chart. That is the app choosing which tool to call and
looping on model output. It is not in this spec and must not arrive in the plan.

What the spec therefore has to get right is the **fenced block's schema**, because that becomes a
public contract between an agent's instructions and this app's renderer.

## Goals

- **A chart in an answer**, drawn from a block the agent wrote.
- **A diagram in an answer**, for the architecture questions this agent is asked constantly.
- A schema small enough that a model writes it correctly, and strict enough that the app never
  guesses what was meant.
- **Both harnesses produce it identically**, because both read the same instructions (§4).

## Non-goals

- **The app never decides to chart anything.** No heuristic over the answer text, no re-prompting,
  no tool the app chooses to call (§8). This is the non-goal that defines the spec.
- **No charting library that fetches at runtime**, and no chart that loads data from anywhere. The
  block contains its own data or it does not render.
- **No editing a chart**, no changing its type from the UI, no download as an image in this spec.
- **No inventing data.** A block whose data is incomplete renders as an error, never as a chart with
  a gap filled in (§5).
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**A chart block** is a fenced code block with a declared language and a small JSON body: the chart
type, the series, their labels, and the axis labels. The set of types is closed and short — the plan
proposes it, the clarify step settles it — and anything outside it does not render as a chart.

**A diagram block** is a fenced `mermaid` block, rendered as a diagram.

**Rendering while streaming.** A fenced block arrives a token at a time and is invalid for most of
its life. Nothing is drawn until the fence closes; until then the block renders as what it is, a code
block in progress. The app must never flash a half-parsed chart, and must never treat an unclosed
fence at the end of a stopped turn as a failure — it is an unfinished answer (spec 023).

**When a block does not parse**, it renders as a code block with a short line saying it could not be
drawn. The content stays visible and copyable. A reader debugging their agent's instructions needs to
see exactly what it wrote; hiding it would make the failure unteachable.

**Colours come from the design system**, and the chart is legible in whatever themes the app has
(spec 036). Every series has a label; nothing depends on colour alone.

**The agent has to be told how.** The block's schema lives in the agent's instructions, in
`agent_core.yaml`, shared by both harnesses — which is what makes "the harnesses differ in the
harness only" stay true (spec 018).

## Acceptance criteria

1. **AC1** — A closed, valid chart block in an answer renders as a chart of the declared type.
2. **AC2** — A closed `mermaid` block renders as a diagram.
3. **AC3** — An unclosed fence renders as a code block in progress and draws nothing.
4. **AC4** — A block that is not valid renders as a code block plus a line saying it could not be
   drawn, with its content intact and copyable.
5. **AC5** — A chart type outside the closed set does not render as a chart and is treated as AC4.
6. **AC6** — A block with missing or malformed data renders as AC4 — never a chart with substituted
   or omitted values (§5).
7. **AC7** — Every series carries a text label, and the chart is readable without colour.
8. **AC8** — Chart colours come from design-system tokens; no colour literal exists in the chart
   component (asserted).
9. **AC9** — No code path inspects answer text to decide to render a chart other than by the fence
   itself, and no code path issues a request as a result of rendering one (asserted — this is the §8
   guard).
10. **AC10** — The block schema is documented in `agent_core.yaml`'s instructions, and the renderer
    and the instructions are checked against one another (§4).
11. **AC11** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). A chart is `text_delta` like any other text. |
| **The block schema** | **New public contract**, between `agent_core.yaml`'s instructions and the frontend renderer. Its single source of truth must be named in the plan, and the instructions and the renderer must be tested against the same examples, or they drift a sentence at a time (§4) — the exact failure `agent_core.yaml` exists to prevent. |
| **Agent definition** | Changing the instructions means a new agent version applied to Foundry for both harnesses. |
| **Dependencies** | Mermaid and any charting code are frontend dependencies with a bundle cost. The plan justifies each or hand-draws the chart in SVG. |
| **Docs** | `docs/how-it-works/` — what the app renders and what it refuses to. |

## Open questions (clarify before planning)

- [ ] Which chart types are in the closed set? Bar, line and pie cover most of what an agent
      produces; anything more is speculation.
- [ ] What is the fence language — `chart`, or something less likely to collide with a real code
      sample about charting?
- [ ] Mermaid is a large dependency. Is a diagram worth it, or does it ship separately from charts
      after the charts prove useful?
- [ ] Does the chart go into the Markdown export (`exportTurn.ts`) as its source block, as an image,
      or as neither?
- [ ] How do we test that the *agent actually writes valid blocks*, rather than only that the
      renderer draws them? A recorded run is the honest answer (§5) — which one?

## Out of scope / deferred

- Interactive charts, tooltips beyond a label, zoom.
- Downloading a chart as an image.
- Charts in the voice transcript, which has no visual surface of its own.
- Any tool that produces a chart server-side.
