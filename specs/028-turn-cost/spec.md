# Spec: What a turn cost

| | |
|---|---|
| **ID** | 028-turn-cost |
| **Status** | draft |
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
- **No currency conversion.** One currency, declared.
- No change to the `AgentEvent` set (§9) — `usage` already carries what is needed.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Where the money appears.** Beside the tokens on a finished turn's meta line, and as its own figure
in the trace panel's numbers, where runs are compared. A conversation total sits with the
conversation, not on every turn.

**It is labelled an estimate**, always, and never in a way a reader can miss — not a footnote at the
bottom of a panel but part of how the figure is written.

**Where the rates came from** is readable from the panel: the rate applied to input, to cached input,
to output, and the date the rates were recorded. A reader comparing two harnesses can then see that
both were priced with the same table, which is the only thing that makes the comparison mean
anything.

**A deployment with no rates configured** shows tokens exactly as it does today and shows no money.
It is not an error state and it says nothing apologetic; most deployments of this repository will
run this way.

**Cached input is priced as cached input** when the spans reported it, and the breakdown says so.
When the spans have not arrived, the estimate uses what the stream reported and is marked as the
coarser of the two — the panel already has this pattern, where spans win over stream events.

## Acceptance criteria

1. **AC1** — With rates configured, a finished turn renders an estimated cost beside its tokens.
2. **AC2** — The figure is rendered with an explicit "estimate" qualifier in both languages.
3. **AC3** — With no rates configured, no money is rendered anywhere, and tokens render unchanged.
4. **AC4** — The trace panel renders the rate breakdown: input, cached input, output, and the date
   the rates were recorded.
5. **AC5** — A turn whose spans report cached tokens is priced with the cached rate for that portion;
   the breakdown shows both portions.
6. **AC6** — A turn with no `usage` event renders no cost — not zero (§5).
7. **AC7** — The conversation total is the sum of its turns' estimates and renders only when every
   priced turn has usage; a conversation containing an unpriced turn says the total is partial.
8. **AC8** — Rates for a model that is not configured produce no cost for turns on that model, while
   other turns still price.
9. **AC9** — The rates are read from one declared source; no price literal exists in frontend code
   (asserted as a test).
10. **AC10** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | The event set is unchanged (§9). `usage` already carries input, output and reasoning tokens. |
| **`GET /config`** | Gains the rate table: per model, the rates and the date they were recorded. The BFF is the single source of truth for rates; the frontend computes and renders, and holds no prices (§4). |
| **Rates source** | A configuration file or environment values, with the recording date beside them. It is **not** a doc read at build time and it is not guessed — an unconfigured deployment is the default. |
| **Constitution §5** | The qualifier and the absence-rather-than-zero rule are the spec's centre, not polish. |
| **Constitution §10** | If the plan wants published list prices as a shipped default, they come from a page read at the time of writing and recorded in `docs/REFERENCES.md`, with the date. |
| **Docs** | `docs/harness-comparison.md` — the measured comparison gains a cost column, or says why it cannot. |

## Open questions (clarify before planning)

- [ ] Does the repository ship default rates for `gpt-5.5` at all, or is unconfigured the only
      out-of-the-box state? Shipping defaults means owning their staleness.
- [ ] Which currency — USD, because that is how the price pages read, or BRL for this audience?
- [ ] Are reasoning tokens billed as output tokens for this model family? This is a §10 question and
      the answer must come from a doc, not from an assumption.
- [ ] Does the hosted harness have costs the prompt harness does not — container compute — and does
      an estimate that ignores them mislead the comparison spec 020 exists to make?
- [ ] Where does the conversation total live: the rail's history row, the header, or the trace panel?

## Out of scope / deferred

- Voice Live session cost.
- Any real billing data.
- Budgets, alerts, or anything that acts on a cost figure.
