/**
 * What a turn cost — an estimate, and honest about being one (spec 028).
 *
 * **This module holds no prices.** The rate table arrives from `GET /config`, because a price
 * compiled into a browser bundle is a fact with no owner that goes stale in silence (§4, §5).
 * `noPriceLiterals.test.ts` watches the whole of `frontend/src/` for one that crept in.
 *
 * Two fields of `usage` are **breakdowns, not additions**, and reading either as an addition
 * produces a plausible wrong number that nobody notices:
 *
 * - `cachedInputTokens` is the part of `inputTokens` that was served from the prompt cache. The
 *   charge is `(input − cached) × input rate + cached × cached rate`. Adding the cache on top
 *   bills that portion twice.
 * - `reasoningTokens` is part of `outputTokens`, and the service bills it as output. Pricing it
 *   separately bills the thinking twice.
 *
 * Neither is a guess. The first is measured in this repository's recorded turns, where
 * `total_tokens == input_tokens + output_tokens` with both details nested inside; the second is
 * documented and cited in `docs/REFERENCES.md` (§10).
 *
 * Everything here returns `undefined` rather than `0` when it cannot price something. A turn that
 * rendered `$0.00` would be claiming it was free, which is a different statement from "we do not
 * know what this cost" (§5).
 */
import type { Turn } from './turn'

/** The rate table exactly as `GET /config` reports it. Absent when nothing is configured. */
export interface Pricing {
  currency: string
  recorded_at: string
  /** Rates are quoted per this many tokens — reported by the BFF so nothing here assumes 1e6. */
  per_tokens: number
  rates: Record<string, ModelRates>
}

export interface ModelRates {
  input: number
  /** Absent when the operator did not declare one; the full input rate then applies throughout. */
  cached_input?: number
  output: number
}

export interface Estimate {
  amount: number
  currency: string
  breakdown: {
    freshInputTokens: number
    cachedInputTokens: number
    outputTokens: number
  }
}

export interface ConversationEstimate {
  amount: number
  currency: string
  /** Turns that had no usage, or a model with no rate. Counted, never absorbed into the total. */
  unpriced: number
  partial: boolean
}

/**
 * The rate table is keyed on the model; `GET /config` may report `<connection>/<model>` when the
 * gateway is in the path. The part after the slash is what is billed.
 */
function rateKey(model: string): string {
  return model.includes('/') ? model.slice(model.lastIndexOf('/') + 1) : model
}

export function estimateTurn(
  turn: Turn,
  model: string | undefined,
  pricing: Pricing | undefined,
): Estimate | undefined {
  const { usage } = turn
  if (!usage || !pricing || !model) return undefined

  const rates = pricing.rates[rateKey(model)]
  if (!rates) return undefined

  // Clamped because the number comes off the wire: a cache larger than the input is a payload we
  // do not understand, and it must not turn into a negative charge.
  const cached = Math.min(Math.max(usage.cachedInputTokens ?? 0, 0), usage.inputTokens)
  const fresh = usage.inputTokens - cached
  const cachedRate = rates.cached_input ?? rates.input

  const amount =
    (fresh * rates.input + cached * cachedRate + usage.outputTokens * rates.output) /
    pricing.per_tokens

  return {
    amount,
    currency: pricing.currency,
    breakdown: {
      freshInputTokens: fresh,
      cachedInputTokens: cached,
      // `outputTokens` already contains the reasoning tokens. It is named plainly here so nobody
      // is tempted to add `usage.reasoningTokens` to the line below it.
      outputTokens: usage.outputTokens,
    },
  }
}

/**
 * What the conversation has cost so far, and how much of it we could not price.
 *
 * A turn with no usage is **counted, not skipped**: a total that silently omitted three turns
 * would be a smaller number presented as the whole (§5). The caller renders `partial`.
 */
export function estimateConversation(
  turns: readonly Turn[],
  model: string | undefined,
  pricing: Pricing | undefined,
): ConversationEstimate | undefined {
  if (!pricing) return undefined

  let amount = 0
  let priced = 0
  let unpriced = 0

  for (const turn of turns) {
    const estimate = estimateTurn(turn, model, pricing)
    if (estimate) {
      amount += estimate.amount
      priced += 1
    } else {
      unpriced += 1
    }
  }

  if (priced === 0) return undefined

  return { amount, currency: pricing.currency, unpriced, partial: unpriced > 0 }
}
