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

/** Spec 005 AC16, AC18 — what the spans know that the event stream never reported. */
describe('what the spans add', () => {
  it('shows prompt-cache tokens when the spans report them (AC16)', () => {
    render(
      <TraceNumbers
        turn={settled}
        model="gpt-5.5"
        trace={{
          status: 'ok',
          spans: [],
          usage: { input_tokens: 3145, output_tokens: 851, cached_tokens: 2620 },
        }}
      />,
    )

    const row = screen.getByTestId('trace-numbers')
    expect(row).toHaveTextContent('2620')
    expect(row).toHaveTextContent(/cached|cache/i)
  })

  it('omits the cache figure when the spans do not report one (AC16)', () => {
    render(
      <TraceNumbers
        turn={settled}
        model="gpt-5.5"
        trace={{ status: 'ok', spans: [], usage: { input_tokens: 10, output_tokens: 2 } }}
      />,
    )

    expect(screen.getByTestId('trace-numbers')).not.toHaveTextContent(/cached|cache/i)
  })

  it('prefers the model snapshot the spans name over the configured one (AC18)', () => {
    render(
      <TraceNumbers
        turn={settled}
        model="gpt-5.5"
        trace={{ status: 'ok', spans: [], model: 'gpt-5.5-2026-04-24', agent_version: '3' }}
      />,
    )

    const row = screen.getByTestId('trace-numbers')
    expect(row).toHaveTextContent('gpt-5.5-2026-04-24')
    expect(row).toHaveTextContent('3')
  })

  it('falls back to the configured model when there is no trace', () => {
    render(<TraceNumbers turn={settled} model="gpt-5.5" />)

    expect(screen.getByTestId('trace-numbers')).toHaveTextContent('gpt-5.5')
  })
})
