# Spec: Charts and diagrams in an answer

| | |
|---|---|
| **ID** | 033-charts-in-answers |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |
| **Clarified** | 2026-09-19 |

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

**A chart block** is a fenced **`foundry-chart`** block with a small JSON body: the chart type, the
series, their labels, and the axis labels. The fence is namespaced on purpose — this schema exists
only in this repository, and a plain `chart` fence would both claim a standard that does not exist
and turn a genuine ```chart code sample into a chart that failed to draw. `agent.yaml` is labelled
as our schema for the same reason.

**The closed set is `bar` and `line`.** Those are the two shapes this agent's own answers need — a
comparison of two harnesses' latencies is a bar, anything across turns is a line — and both stay
readable without colour, which is what AC7 requires. `pie` is deliberately absent: its job here is a
breakdown, a bar does that better at every category count, and a pie leans on exactly the colour and
angle that AC7 forbids depending on. The set being closed means adding one later is one entry and
one renderer, decided on evidence.

**At most four series.** Not a taste call: the design system had no categorical palette, so one was
built for this spec and **validated** — four hues pass the colourblind-separation checks against
every other hue in the set, and no fifth was found that does across a broad search. A block with
more than four series therefore does not render. Folding the extras into an "Other" would be the app
aggregating data the agent never asked it to, which is the same §5 line as inventing a value.

**A diagram block** is a fenced `mermaid` block, rendered as a diagram. `mermaid` stays plain
because mermaid genuinely is a standard that other tools read; ours is not.

**Mermaid is fetched only when a diagram appears.** It is roughly 500 kB gzipped against a bundle
that is 192 kB today, so it loads through a dynamic import and lives in its own chunk. A reader who
never sees a diagram never downloads it. While it loads, the block renders as what it is — a code
block — which is the same thing AC3 already asks for.

**Rendering while streaming.** A fenced block arrives a token at a time and is invalid for most of
its life. Nothing is drawn until the fence closes; until then the block renders as what it is, a code
block in progress. The app must never flash a half-parsed chart, and must never treat an unclosed
fence at the end of a stopped turn as a failure — it is an unfinished answer (spec 023).

**When a block does not parse**, it renders as a code block with a short line saying it could not be
drawn. The content stays visible and copyable. A reader debugging their agent's instructions needs to
see exactly what it wrote; hiding it would make the failure unteachable.

**Colours come from the design system**, and the chart is legible in whatever themes the app has
(spec 036). Every series has a label; nothing depends on colour alone — which is also what makes the
palette legal, since one pair's tritanopia separation is low and the mandatory labels are the
secondary encoding that covers it.

The app has **one** theme today. Spec 036 adds the second, and its work includes re-validating these
four hues against the dark surface — a dark palette is *selected*, never an automatic flip of a
light one.

**The agent has to be told how.** The block's schema lives in the agent's instructions, in
`agent_core.yaml`, shared by both harnesses — which is what makes "the harnesses differ in the
harness only" stay true (spec 018).

**The examples in those instructions are the renderer's test fixtures.** One source of truth, parsed
in CI by the renderer's own parser: that is what stops the instructions and the renderer drifting a
sentence at a time, which is the exact failure `agent_core.yaml` was created to prevent (§4).
Whether the *model* then follows them is a different claim, it needs a credential this machine does
not have, and §5 forbids hand-writing a recording to stand in for one — so it is an open item in
`docs/REFERENCES.md`, closed by one real turn.

**The chart travels in an export as its source block.** `exportTurn.ts` writes the answer verbatim,
so this already works; a test keeps a future change from eating the fence. Not as an image — the
non-goals rule that out, and the source is the more useful artifact anyway, since a reader who pastes
it back gets a chart again.

## Acceptance criteria

1. **AC1** — A closed, valid chart block in an answer renders as a chart of the declared type.
2. **AC2** — A closed `mermaid` block renders as a diagram.
3. **AC3** — An unclosed fence renders as a code block in progress and draws nothing.
4. **AC4** — A block that is not valid renders as a code block plus a line saying it could not be
   drawn, with its content intact and copyable.
5. **AC5** — A chart type outside the closed set (`bar`, `line`) does not render as a chart and is
   treated as AC4.
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
12. **AC12** — A block with more than four series is treated as AC4, and nothing is aggregated or
    dropped to make it fit.
13. **AC13** — The categorical palette passes the colourblind-separation checks for **every** pair,
    not only adjacent ones, and the validation is recorded.
14. **AC14** — Mermaid is imported dynamically; no static import of it exists, so the main bundle
    does not carry it (asserted).
15. **AC15** — A chart block survives a Markdown export as its source fence.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). A chart is `text_delta` like any other text. |
| **The block schema** | **New public contract**, between `agent_core.yaml`'s instructions and the frontend renderer. Its single source of truth must be named in the plan, and the instructions and the renderer must be tested against the same examples, or they drift a sentence at a time (§4) — the exact failure `agent_core.yaml` exists to prevent. |
| **Agent definition** | Changing the instructions means a new agent version applied to Foundry for both harnesses. |
| **Dependencies** | The chart is **hand-drawn SVG** — no charting dependency at all, which is also what makes AC8 achievable, since every fill is a token this repo chose. `mermaid` is a real dependency and is **dynamically imported**, so it never enters the main chunk. |
| **Design system** | `public/ds/colors_and_type.css` gains four validated categorical series tokens. It had none — only a brand blue, neutrals, and status colours, which are reserved and must never stand in for a series. |
| **Docs** | `docs/how-it-works/` — what the app renders and what it refuses to. |

## Out of scope / deferred

- Interactive charts, tooltips beyond a label, zoom. A chart in a chat answer is read, not explored,
  and a hover layer is the first thing to add if that turns out to be wrong.
- `pie`, and any fifth series colour — both are additions to a closed set, decided on evidence.
- Downloading a chart as an image.
- Charts in the voice transcript, which has no visual surface of its own.
- Any tool that produces a chart server-side.
