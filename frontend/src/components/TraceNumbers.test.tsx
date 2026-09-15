/**
 * Spec 014 AC2, AC3 — the run's numbers, in the panel a reader opens to look at the run.
 *
 * AC3 is the one worth being strict about: a turn that has not reported usage yet must show
 * nothing rather than `0 tokens`, which is a measurement and not an absence.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TraceNumbers } from './TraceNumbers'
import { emptyTurn, type Turn } from '../state/turn'

const settled: Turn = {
  ...emptyTurn(),
  status: 'done',
  usage: { inputTokens: 120, outputTokens: 34, reasoningTokens: 64 },
}

describe('the run numbers', () => {
  it('shows model, total tokens, reasoning tokens and latency (AC2)', () => {
    render(<TraceNumbers turn={settled} model="gpt-5.5" latencyMs={2400} />)

    const row = screen.getByTestId('trace-numbers')
    expect(row).toHaveTextContent('gpt-5.5')
    expect(row).toHaveTextContent('154') // 120 + 34, summed rather than shown as two figures
    expect(row).toHaveTextContent('64')
    expect(row).toHaveTextContent('2.4 s')
  })

  it('omits the figures it does not have instead of showing zeros (AC3)', () => {
    render(<TraceNumbers turn={emptyTurn()} />)

    expect(screen.getByTestId('trace-numbers')).not.toHaveTextContent('0')
  })

  it('omits reasoning tokens for a model that reports none', () => {
    const { reasoningTokens: _drop, ...usage } = settled.usage!
    render(<TraceNumbers turn={{ ...settled, usage }} model="gpt-4o" latencyMs={900} />)

    const row = screen.getByTestId('trace-numbers')
    expect(row).toHaveTextContent('154')
    expect(row).not.toHaveTextContent(/reasoning|racioc/i)
  })
})
