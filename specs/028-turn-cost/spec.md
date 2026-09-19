# Spec: What a turn cost

| | |
|---|---|
| **ID** | 028-turn-cost |
| **Status** | clarified |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

`PLAN.md` promised "usage/cost display" for Phase 2. What shipped is usage: the meta line shows
tokens and latency, and the trace panel adds reasoning tokens, a prompt-cache figure and the model
snapshot the spans reported. There is no money anywhere in the app.

That omission lands exactly where this repository makes its argument. Spec 018 built a second
harness so the project could answer *what changes when Foundry runs the loop versus when your
container does*, and spec 020 is about demonstrating it side by side. Latency and token counts get
half an answer. The half a reader actually repeats afterwards — *the hosted one thought longer and
cost more* — needs a number in a currency, and reasoning tokens make that number non-obvious enough
that nobody computes it in their head.

The honesty problem is the whole design problem. Prices are an external table that changes without
telling us, they vary by region and by agreement, and cached input is billed differently from fresh
input. A number rendered with a currency symbol reads as a fact. Constitution §5 says we do not
render as measured what we did not measure.

## Goals

- **A turn says what it cost**, beside the tokens it already reports.
- **A conversation says what it has cost so far.**
- The figure is **traceable to its inputs**: which rates, from when, applied to which token classes.
- An **unpriced deployment shows no money at all**, rather than a wrong number or a zero.

## Non-goals

- **No price list baked into the frontend.** A table of model prices compiled into the browser bundle
  is a fact with no owner, and it goes stale silently.
- **No billing integration**, no Cost Management query, no invoice reconciliation. This is an
  estimate from token counts and declared rates, and it says so.
- **No price for the Voice Live session**, which is billed on audio minutes and is a different
  measurement — until someone verifies how, from a doc (§10).
- **No currency conversion.** One currency, declared by whoever declares the rates.
- **No price for container compute.** The hosted harness bills it (`docs/harness-comparison.md`) and
  this app cannot measure container-seconds. The estimate covers inference, and says so where it
  matters — see below.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Where the money appears.** Beside the tokens on a finished turn's meta line, and as its own figure
in the trace panel's numbers, where runs are compared. **The conversation total lives in the trace
panel too**, under the turn's numbers and above the rate breakdown that explains it — the panel is
already where tokens, cache and latency live, and it is where a reader comparing two harnesses is
looking. It is not on every turn.

**It is labelled an estimate**, always, and never in a way a reader can miss — not a footnote at the
bottom of a panel but part of how the figure is written.

**Where the rates came from** is readable from the panel: the rate applied to input, to cached input,
to output, and the date the rates were recorded. A reader comparing two harnesses can then see that
both were priced with the same table, which is the only thing that makes the comparison mean
anything.

**A deployment with no rates configured** shows tokens exactly as it does today and shows no money.
It is not an error state and it says nothing apologetic; most deployments of this repository will
run this way.

**Cached input is priced as cached input**, from the stream, on every turn. Foundry's
`response.completed` payload carries `input_tokens_details.cached_tokens` beside the
`output_tokens_details.reasoning_tokens` the normaliser already reads — recorded in this repository's
own fixtures at 1024, 3584 and 4096 tokens. The `usage` event carries it forward from this spec on
(see *Contract*), so a deployment with no Application Insights still prices cache correctly instead
of silently overstating every turn. Spans remain the corroboration they already are, not the source.

**Reasoning tokens are not priced separately.** They are billed as output tokens and they are
already *inside* `output_tokens` — the doc says the first (§10, recorded in `docs/REFERENCES.md`)
and this repository's recordings say the second: `total_tokens == input_tokens + output_tokens` in
every turn we have, with reasoning nested under `output_tokens_details`. Adding reasoning to the
priced output would double-count it. It stays on screen as a token count, as it is today.

**A hosted turn says what the figure leaves out.** The hosted harness also bills container compute
and the prompt agent does not. Two estimates side by side that a reader takes as comparable, when
one omits a cost line the other does not have, is precisely the §5 failure this spec is about — so a
turn answered by a hosted agent carries that sentence, once.

## Acceptance criteria

1. **AC1** — With rates configured, a finished turn renders an estimated cost beside its tokens.
2. **AC2** — The figure is rendered with an explicit "estimate" qualifier in both languages.
3. **AC3** — With no rates configured, no money is rendered anywhere, and tokens render unchanged.
4. **AC4** — The trace panel renders the rate breakdown: input, cached input, output, and the date
   the rates were recorded.
5. **AC5** — The `usage` event carries `cached_input_tokens` when Foundry reported it, and every
   adapter that emits `usage` is covered by the parameterised contract test (§9).
6. **AC6** — A turn reporting cached input is priced as `(input − cached) × input rate +
   cached × cached rate`; the breakdown shows both portions. Cached tokens are treated as a **subset**
   of `input_tokens`, never as an addition to them.
7. **AC7** — Reasoning tokens are never added to the priced output: a turn with reasoning costs
   exactly what the same turn's `output_tokens` cost, and a test pins that against double-counting.
8. **AC8** — A turn with no `usage` event renders no cost — not zero (§5).
9. **AC9** — The conversation total is the sum of its turns' estimates and renders in the trace
   panel; a conversation containing a turn that could not be priced says the total is partial, and
   says how many turns are missing.
10. **AC10** — Rates for a model that is not configured produce no cost for turns on that model,
    while other turns still price.
11. **AC11** — A turn answered by a **hosted** agent renders, once, that the estimate covers
    inference and excludes container compute; a prompt-agent turn does not render that sentence.
12. **AC12** — The rates are read from one declared source; **no price literal exists anywhere in
    `frontend/`**, asserted as a test that reads the source files (§4).
13. **AC13** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **`AgentEvent` (§9)** | **The `usage` event gains an optional `cached_input_tokens`.** This spec is what §9 requires for that change. The raw `response.completed` payload already carries `input_tokens_details.cached_tokens` — this repository's own fixtures hold values of 1024, 3584 and 4096 — and `ai/harness/prompt_agent/events.py` reads `output_tokens_details` beside it while dropping the cache. Moving with it: `contract.py`, every adapter that emits `usage`, the contract tests (parameterised, so a new harness proves itself), the recorded fixtures, `frontend/src/types/events.ts`, `turn.ts`, and `docs/how-it-works/`. No other event changes; nothing is removed or renamed. |
| **`GET /config`** | Gains the rate table: per model, the rates, the currency and the date they were recorded. **The BFF is the single source of truth for rates**; the frontend computes and renders and holds no prices (§4). Absent from the payload when nothing is configured — not an empty table, which would be a different claim. |
| **Rates source** | Environment values read by `settings.py`, with the recording date and currency beside them. **The repository ships none**: an unconfigured deployment is the out-of-the-box state, because a price compiled into this repo is a fact with no owner that goes stale in silence. `.env.example` carries placeholders and says where to read the real ones. |
| **Currency** | Declared by whoever declares the rates, as an ISO 4217 code, and rendered with `Intl.NumberFormat` in the reader's language. No conversion, ever. |
| **Constitution §5** | The qualifier, the absence-rather-than-zero rule, the partial-total marker and the hosted turn's sentence are the spec's centre, not polish. |
| **Constitution §10** | *Reasoning tokens are billed as output tokens* and are reported at `output_tokens_details.reasoning_tokens` — [Azure OpenAI reasoning models](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning), read 2026-09-18, recorded in `docs/REFERENCES.md`. That they sit *inside* `output_tokens` is measured from this repo's recordings, where `total_tokens == input_tokens + output_tokens` in every turn. |
| **Docs** | `docs/harness-comparison.md` — the cost row gains what the estimate does and does not cover. `docs/REFERENCES.md` — the reasoning-billing citation. `docs/how-it-works/` — the `usage` event's new field. |

## Out of scope / deferred

- Voice Live session cost.
- Any real billing data.
- Budgets, alerts, or anything that acts on a cost figure.
