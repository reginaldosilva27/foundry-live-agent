/**
 * Spec 028 AC4, AC9 — the panel is where a reader compares two runs, so it is where the figure has
 * to be traceable to its inputs: which rates, from when, applied to which token classes.
 *
 * A total that silently omitted the turns it could not price would be a smaller number presented as
 * the whole conversation. That is the §5 failure this file is mostly about.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TraceNumbers } from './TraceNumbers'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import type { Pricing } from '../state/cost'
import type { Turn } from '../state/turn'

const PRICING: Pricing = {
  currency: 'USD',
  recorded_at: '2026-09-18',
  per_tokens: 1_000_000,
  rates: { 'gpt-5.5': { input: 2, cached_input: 0.2, output: 10 } },
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

const USED = { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 500_000 }

function show(props: Partial<React.ComponentProps<typeof TraceNumbers>> = {}) {
  return render(
    <LangContext.Provider value="en">
      <TraceNumbers turn={turn(USED)} model="gpt-5.5" pricing={PRICING} {...props} />
    </LangContext.Provider>,
  )
}

describe('the turn figure and its rates', () => {
  it('renders the estimated cost for the turn', () => {
    show()
    // 500k fresh at 2 + 500k cached at 0.2 + 1M output at 10 = 1 + 0.1 + 10.
    expect(screen.getByTestId('trace-cost')).toHaveTextContent(/11\.10/)
  })

  it('renders the rate applied to input, cached input and output, and the date (AC4)', () => {
    show()
    const rates = screen.getByTestId('trace-rates')

    expect(rates).toHaveTextContent(t('cost.rateInput', 'en'))
    expect(rates).toHaveTextContent(t('cost.rateCachedInput', 'en'))
    expect(rates).toHaveTextContent(t('cost.rateOutput', 'en'))
    expect(rates).toHaveTextContent('2026-09-18')
  })

  it('reads the cache off the stream, so a deployment with no spans still shows it', () => {
    show({ trace: undefined })
    expect(screen.getByText('500000')).toBeInTheDocument()
  })

  it('lets the spans win where they disagree with the stream', () => {
    show({ trace: { status: 'ok', spans: [], usage: { cached_tokens: 777 } } as never })
    expect(screen.getByText('777')).toBeInTheDocument()
  })

  it('renders no money and no rates when nothing is configured (AC3)', () => {
    show({ pricing: undefined })

    expect(screen.queryByTestId('trace-cost')).toBeNull()
    expect(screen.queryByTestId('trace-rates')).toBeNull()
    expect(screen.getByText('2000000')).toBeInTheDocument()
  })
})

describe('the conversation total', () => {
  it('sums the turns of the conversation (AC9)', () => {
    show({ conversationTurns: [turn(USED), turn(USED)] })
    expect(screen.getByTestId('trace-conversation-cost')).toHaveTextContent(/22\.20/)
  })

  it('says the total is partial, and how many turns it could not price (AC9)', () => {
    show({ conversationTurns: [turn(USED), turn(), turn()] })

    expect(screen.getByTestId('trace-conversation-cost')).toHaveTextContent(/11\.10/)
    expect(screen.getByText(t('cost.partial', 'en').replace('{count}', '2'))).toBeInTheDocument()
  })

  it('does not call a complete total partial', () => {
    show({ conversationTurns: [turn(USED)] })
    expect(screen.queryByText(/Partial/)).toBeNull()
  })

  it('is absent when no turn of the conversation could be priced', () => {
    show({ turn: turn(), conversationTurns: [turn(), turn()] })
    expect(screen.queryByTestId('trace-conversation-cost')).toBeNull()
  })
})
