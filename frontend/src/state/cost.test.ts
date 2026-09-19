/**
 * Spec 028 — what a turn cost, and the two ways to compute it wrong.
 *
 * Both traps come from reading a *breakdown* as an *addition*, and both are invisible in the
 * result: the number looks plausible either way. So each has a test whose only job is to fail if
 * someone "simplifies" the formula, and each carries the recorded arithmetic that settles it.
 */
import { describe, expect, it } from 'vitest'
import { estimateConversation, estimateTurn, type Pricing } from './cost'
import type { Turn } from './turn'

/** Round numbers, so an assertion reads as the arithmetic it is checking. */
const PRICING: Pricing = {
  currency: 'USD',
  recorded_at: '2026-09-18',
  per_tokens: 1_000_000,
  rates: {
    'gpt-5.5': { input: 2, cached_input: 0.2, output: 10 },
    'gpt-4o': { input: 1, output: 4 },
  },
}

function turn(usage?: Turn['usage']): Turn {
  return {
    reasoning: '',
    activities: [],
    text: 'answer',
    status: 'done',
    unknownEvents: {},
    ...(usage ? { usage } : {}),
  }
}

describe('estimateTurn', () => {
  it('prices input and output at their rates', () => {
    const estimate = estimateTurn(turn({ inputTokens: 1_000_000, outputTokens: 1_000_000 }), 'gpt-5.5', PRICING)
    expect(estimate?.amount).toBe(12)
    expect(estimate?.currency).toBe('USD')
  })

  it('treats cached input as a SUBSET of input, never as an addition', () => {
    // 1M input of which 500k was cached: 500k at 2 + 500k at 0.2 = 1 + 0.1.
    // The wrong formula — input x rate + cached x cached rate — would give 2.1.
    const estimate = estimateTurn(
      turn({ inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 500_000 }),
      'gpt-5.5',
      PRICING,
    )

    expect(estimate?.amount).toBeCloseTo(1.1, 10)
    expect(estimate?.breakdown.freshInputTokens).toBe(500_000)
    expect(estimate?.breakdown.cachedInputTokens).toBe(500_000)
  })

  it('prices an entirely cached input at the cached rate', () => {
    const estimate = estimateTurn(
      turn({ inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 1_000_000 }),
      'gpt-5.5',
      PRICING,
    )
    expect(estimate?.amount).toBeCloseTo(0.2, 10)
  })

  it('never lets a cache larger than the input produce a negative charge', () => {
    // Defensive, because the number comes off the wire: a cache exceeding the input is not a
    // discount, it is a payload we do not understand.
    const estimate = estimateTurn(
      turn({ inputTokens: 100, outputTokens: 0, cachedInputTokens: 999 }),
      'gpt-5.5',
      PRICING,
    )
    expect(estimate?.amount).toBeGreaterThanOrEqual(0)
    expect(estimate?.breakdown.freshInputTokens).toBe(0)
  })

  it('falls back to the full input rate when the model declares no cached rate', () => {
    const estimate = estimateTurn(
      turn({ inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 500_000 }),
      'gpt-4o',
      PRICING,
    )
    expect(estimate?.amount).toBeCloseTo(1, 10)
  })

  it('never adds reasoning tokens on top of output — they are already inside it', () => {
    // Documented: reasoning tokens are billed as output tokens. Measured in this repo's recordings:
    // total_tokens == input_tokens + output_tokens, with reasoning nested under output details.
    const withReasoning = estimateTurn(
      turn({ inputTokens: 0, outputTokens: 1_000_000, reasoningTokens: 400_000 }),
      'gpt-5.5',
      PRICING,
    )
    const without = estimateTurn(turn({ inputTokens: 0, outputTokens: 1_000_000 }), 'gpt-5.5', PRICING)

    expect(withReasoning?.amount).toBe(without?.amount)
    expect(withReasoning?.amount).toBe(10)
  })

  it('prices nothing at all for a turn with no usage — not zero (AC8)', () => {
    expect(estimateTurn(turn(), 'gpt-5.5', PRICING)).toBeUndefined()
  })

  it('prices nothing when no rates are configured (AC3)', () => {
    expect(estimateTurn(turn({ inputTokens: 10, outputTokens: 10 }), 'gpt-5.5', undefined)).toBeUndefined()
  })

  it('prices nothing for a model the table does not list, and its neighbour still prices (AC10)', () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 0 }
    expect(estimateTurn(turn(usage), 'gpt-9-unreleased', PRICING)).toBeUndefined()
    expect(estimateTurn(turn(usage), 'gpt-4o', PRICING)?.amount).toBe(1)
  })

  it('reads the model out of a gateway-qualified deployment name', () => {
    // `<connection>/<model>` is what `GET /config` reports when the gateway is in the path; the
    // rate table is keyed on the model, which is the part that is billed.
    const estimate = estimateTurn(
      turn({ inputTokens: 1_000_000, outputTokens: 0 }),
      'foundry-analytics-demo/gpt-5.5',
      PRICING,
    )
    expect(estimate?.amount).toBe(2)
  })
})

describe('estimateConversation', () => {
  const priced = turn({ inputTokens: 1_000_000, outputTokens: 0 })

  it('sums the turns it could price', () => {
    const total = estimateConversation([priced, priced], 'gpt-5.5', PRICING)
    expect(total?.amount).toBe(4)
    expect(total?.unpriced).toBe(0)
  })

  it('reports how many turns it could not price, rather than pretending they were free (AC9)', () => {
    const total = estimateConversation([priced, turn(), priced], 'gpt-5.5', PRICING)

    expect(total?.amount).toBe(4)
    expect(total?.unpriced).toBe(1)
    expect(total?.partial).toBe(true)
  })

  it('is absent when nothing could be priced at all', () => {
    expect(estimateConversation([turn(), turn()], 'gpt-5.5', PRICING)).toBeUndefined()
    expect(estimateConversation([priced], 'gpt-5.5', undefined)).toBeUndefined()
  })
})
