# Plan: What a turn cost

> The HOW. Written after `spec.md` is `clarified`. Decisions here must respect every
> principle in `.specify/constitution.md`; if one must bend, amend the constitution
> first and note it.

## Approach

Four layers, in dependency order, and the first one is a **§9 contract change** — which is why this
spec exists before any code.

1. **`usage` learns about cache.** Foundry already sends it; `prompt_agent/events.py` reads
   `output_tokens_details` and steps straight past `input_tokens_details.cached_tokens` in the same
   payload. Adding one optional field to `Usage` is the whole change, and the **recorded fixtures
   are already the proof** — `prompt-agent-turn-20260915.jsonl` holds real Foundry events with
   `cached_tokens: 1024`, and the tests replay them through the normaliser. Nothing is re-recorded
   and nothing is hand-written (§5).
2. **The BFF owns the rates.** `settings.py` reads them from the environment, `GET /config` reports
   them, and the key is **absent** when nothing is configured rather than empty — "no rates" and "a
   table with nothing in it" are different claims and only the first is true.
3. **The frontend computes and renders, and holds no prices.** One pure module, `state/cost.ts`,
   turns a `usage` plus a rate table into an estimate with its breakdown. A test reads every file
   under `frontend/src/` looking for a price literal (AC12).
4. **Two surfaces render it.** The meta line gets the figure; the trace panel gets the figure, the
   conversation total and the rate breakdown that explains both.

**Three traps this plan is built around:**

- **Cached tokens are a subset of `input_tokens`, not an addition.** Recorded: `input_tokens 17401`
  with `cached_tokens 1024`, and `total_tokens 17783 == 17401 + 382`. Pricing
  `input × rate + cached × cached_rate` would charge the cached portion twice.
- **Reasoning tokens are inside `output_tokens`.** Same arithmetic, and the doc says they are billed
  as output. The estimate prices `output_tokens` and never adds reasoning. Both traps get a test
  whose only job is to fail if someone "fixes" the formula.
- **The two APIs spell the field differently.** The Responses API sends `input_tokens_details`
  (plural); Voice Live sends `input_token_details` (singular). Both are in this repo's fixtures. One
  spelling copied to the other emitter would silently read `None` forever, so each emitter reads its
  own and each has its own recorded test.

**Alternative rejected:** taking cache from spans only, as the draft spec assumed. Most deployments
of this repository have no Application Insights, and those would price every cached token at the
full rate and overstate silently — the exact §5 failure this spec is about.

## Affected files

**`ai/` — the contract**

- `harness/_shared/contract.py` — `Usage` gains `cached_input_tokens: NotRequired[int]`; `_SCHEMA`
  gains it as optional. Single source of truth for the event set (§9).
- `harness/prompt_agent/events.py` — read `input_tokens_details.cached_tokens`.
- `harness/_shared/voice_events.py` — read `input_token_details.cached_tokens` (**singular**).
- `tests/test_recorded_turn.py`, `tests/test_contract.py`, `tests/test_voice_events.py` — assert the
  field arrives from the recordings.

**`backend/` — the rates**

- `app/settings.py` — `model_rates`, `rates_currency`, `rates_recorded_at`, parsed and validated
  eagerly; a malformed table is a `SettingsError`, not a silent empty.
- `app/routers/config.py` — report `pricing`, or omit the key entirely.
- `tests/` — configured, unconfigured and malformed.
- `.env.example` — placeholders, and where to read the real numbers.

**`frontend/` — the money**

- `src/types/events.ts` — `UsageEvent.cached_input_tokens?`.
- `src/state/turn.ts` — carry it onto `Turn.usage`.
- `src/state/cost.ts` (new, + test) — `estimateTurn`, `estimateConversation`, `RateTable`.
- `src/config.ts` — `pricing` on `BffConfig`.
- `src/components/MetaLine.tsx` (+ test) — the figure, qualified, and the hosted sentence.
- `src/components/TraceNumbers.tsx` (+ test) — figure, conversation total, rate breakdown.
- `src/components/format.ts` — `formatMoney`, through `Intl.NumberFormat`.
- `src/App.tsx`, `src/panes/Conversation.tsx` — thread the rates and the answering harness down.
- `src/i18n/strings.ts` — the new strings, `en` + `pt`.
- `src/styles/app.css` — the breakdown block.
- `src/state/noPriceLiterals.test.ts` (new) — AC12, in the shape `noAutoRepeat.test.ts` already uses.

**Docs**

- `docs/REFERENCES.md` — the reasoning-billing citation, dated.
- `docs/how-it-works/` — the `usage` event's new field.
- `docs/harness-comparison.md` — what the estimate covers and what it leaves out.
- `CLAUDE.md` ↔ `AGENTS.md` — the two arithmetic traps, in the same commit (§6).

## Contract / data model changes (constitution §4)

| Contract | Single source of truth | Must move with it |
|---|---|---|
| `AgentEvent` `usage` | `ai/harness/_shared/contract.py` | both emitters, contract tests, `frontend/src/types/events.ts`, `turn.ts`, `docs/how-it-works/` |
| Rate table | `backend/app/settings.py` → `GET /config` | `frontend/src/config.ts`; **no price in `frontend/`**, asserted |
| Money formatting | `frontend/src/components/format.ts` | every renderer |

`pricing` on `GET /config`:

```json
{ "currency": "USD", "recorded_at": "2026-09-18",
  "rates": { "gpt-5.5": { "input": 1.25, "cached_input": 0.125, "output": 10.0 } } }
```

Rates are **per million tokens**, which is how every price page reads; the unit is named in the
config key and in the panel so nobody has to guess a factor of a thousand. The whole key is absent
when unconfigured.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `cost.estimate` | est. | est. |
| `cost.turn` | Estimated cost | Custo estimado |
| `cost.conversation` | This conversation so far | Esta conversa até agora |
| `cost.partial` | Partial — {count} turns could not be priced | Parcial — {count} turns não puderam ser precificados |
| `cost.ratesTitle` | Rates recorded {date} | Taxas anotadas em {date} |
| `cost.rateInput` | input / 1M | entrada / 1M |
| `cost.rateCachedInput` | cached input / 1M | entrada em cache / 1M |
| `cost.rateOutput` | output / 1M | saída / 1M |
| `cost.excludesContainer` | Inference only — the hosted harness also bills container compute, which this figure excludes. | Somente inferência — o harness hosted também cobra compute de container, que esta figura não inclui. |
| `meta.cachedInput` | cached input | entrada em cache |

`cost.estimate` is identical in both and joins `INTENTIONALLY_IDENTICAL`: `est.` is the abbreviation
in both languages, and `strings.test.ts` is the gate that forces the declaration.

## Test strategy (constitution §2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | a turn with usage and rates renders a figure | `components/MetaLine.test.tsx` |
| AC2 | the figure carries the estimate qualifier, in `en` and `pt` | `components/MetaLine.test.tsx` |
| AC3 | no `pricing` on config → no money anywhere; tokens unchanged | `MetaLine` · `TraceNumbers` |
| AC4 | the panel renders input, cached input, output and the recorded date | `components/TraceNumbers.test.tsx` |
| AC5 | `cached_input_tokens` survives the recorded stream, both emitters | `ai/tests/test_recorded_turn.py` · `ai/tests/test_voice_events.py` |
| AC6 | `(input − cached) × input + cached × cached`, and cached never added on top | `state/cost.test.ts` |
| AC7 | a turn with reasoning costs exactly what its `output_tokens` cost | `state/cost.test.ts` |
| AC8 | no `usage` → `undefined`, never `0` | `state/cost.test.ts` · `MetaLine.test.tsx` |
| AC9 | total sums the turns; an unpriceable turn makes it partial and says how many | `state/cost.test.ts` · `TraceNumbers.test.tsx` |
| AC10 | an unlisted model prices nothing while its neighbours still price | `state/cost.test.ts` |
| AC11 | a hosted turn renders the sentence; a prompt-agent turn does not | `components/MetaLine.test.tsx` |
| AC12 | no price literal under `frontend/src/` | `state/noPriceLiterals.test.ts` |
| AC13 | every key in `en` + `pt` | `i18n/strings.test.ts` (exists) |
| — | `GET /config` reports rates, omits the key unconfigured, refuses a malformed table | `backend/tests/` |

## Risks / trade-offs

- **A §9 change touches every consumer.** It is additive and optional, so an adapter that does not
  emit it stays valid and the parameterised contract tests keep passing — that is the whole reason
  `NotRequired` is the right shape here.
- **Rates go stale in the operator's environment**, which is why the recorded date is rendered beside
  the figure rather than stored and forgotten. We own the mechanism; they own the number.
- **`Intl.NumberFormat` rounds**, and a turn costing fractions of a cent renders as `$0.00`. Rendering
  a true zero for something that cost money is a §5 problem, so small amounts fall back to more
  decimal places rather than rounding to nothing.
- **AC11 needs to know which harness answered a turn.** For the live session that is the answering
  agent's row; for a restored conversation it is the stored `agent` resolved against the listing —
  the resolution `App.tsx` already does for `blocked`. When the listing has not arrived, the sentence
  is omitted rather than guessed.
