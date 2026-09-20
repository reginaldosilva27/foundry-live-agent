/**
 * Spec 028 AC1, AC2, AC3, AC8, AC11 — the money on the meta line.
 *
 * Every assertion here is about a claim, not a layout. A figure that looks measured when it was
 * estimated, a zero where we mean "we do not know", and two harnesses' figures presented as
 * comparable when one omits a cost line the other does not have — those are the three ways this
 * feature can lie, and they are the three things tested.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MetaLine } from './MetaLine'
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

const USED = { inputTokens: 1_000_000, outputTokens: 1_000_000 }

function show(props: Partial<React.ComponentProps<typeof MetaLine>> = {}, lang: 'en' | 'pt' = 'en') {
  return render(
    <LangContext.Provider value={lang}>
      <MetaLine
        turn={turn(USED)}
        model="gpt-5.5"
        pricing={PRICING}
        onOpenTrace={() => {}}
        {...props}
      />
    </LangContext.Provider>,
  )
}

describe('the money on the meta line', () => {
  it('renders an estimated cost beside the tokens (AC1)', () => {
    show()
    expect(screen.getByTestId('turn-cost')).toHaveTextContent(/12\.00/)
    expect(screen.getByText(/2000000/)).toBeInTheDocument()
  })

  it('carries the estimate qualifier, in both languages (AC2)', () => {
    const { unmount } = show()
    expect(screen.getByTestId('turn-cost')).toHaveTextContent(t('cost.estimate', 'en'))
    unmount()

    show({}, 'pt')
    expect(screen.getByTestId('turn-cost')).toHaveTextContent(t('cost.estimate', 'pt'))
  })

  it('renders no money at all when no rates are configured, and tokens unchanged (AC3)', () => {
    show({ pricing: undefined })

    expect(screen.queryByTestId('turn-cost')).toBeNull()
    expect(screen.getByText(/2000000/)).toBeInTheDocument()
  })

  it('renders nothing rather than zero for a turn with no usage (AC8)', () => {
    show({ turn: turn() })

    expect(screen.queryByTestId('turn-cost')).toBeNull()
    expect(screen.queryByText(/0\.00/)).toBeNull()
  })

  it('renders nothing for a model the rate table does not list', () => {
    show({ model: 'gpt-9-unreleased' })
    expect(screen.queryByTestId('turn-cost')).toBeNull()
  })
})

/** AC11 — the sentence that keeps spec 020's comparison honest. */
describe('a hosted turn says what the figure leaves out', () => {
  it('names the container compute the estimate excludes', () => {
    show({ harness: 'langgraph' })
    expect(screen.getByText(t('cost.excludesContainer', 'en'))).toBeInTheDocument()
  })

  it('says it once, not once per number', () => {
    show({ harness: 'langgraph' })
    expect(screen.getAllByText(t('cost.excludesContainer', 'en'))).toHaveLength(1)
  })

  it('does not say it on a prompt-agent turn, which has no container to bill', () => {
    show({ harness: 'prompt-agent' })
    expect(screen.queryByText(t('cost.excludesContainer', 'en'))).toBeNull()
  })

  it('says nothing when there is no figure for it to qualify', () => {
    show({ harness: 'langgraph', pricing: undefined })
    expect(screen.queryByText(t('cost.excludesContainer', 'en'))).toBeNull()
  })

  it('says nothing when the harness is not known yet, rather than guessing', () => {
    show({ harness: undefined })
    expect(screen.queryByText(t('cost.excludesContainer', 'en'))).toBeNull()
  })
})

/**
 * Spec 020 AC4 — time to first token.
 *
 * The figure a comparison is actually about: two agents given the same question rarely differ much
 * in total, and differ a lot in how long they sit silent first. It is the browser's clock, same as
 * the latency beside it, which is why the two are formatted identically and only the label differs.
 */
describe('how long before the answer started (spec 020 AC4)', () => {
  it('renders the figure when the turn produced a token', () => {
    show({ firstTokenMs: 820, latencyMs: 4200 })

    expect(screen.getByTestId('meta-line')).toHaveTextContent(`820 ms ${t('meta.firstToken', 'en')}`)
  })

  it('renders nothing at all when no token ever arrived, rather than a zero', () => {
    // A turn that called tools and then failed never started answering. `0 ms to first token`
    // would say it answered instantly, which is the opposite of what happened (§5).
    show({ firstTokenMs: undefined, latencyMs: 4200 })

    expect(screen.getByTestId('meta-line')).not.toHaveTextContent(t('meta.firstToken', 'en'))
  })

  it('puts the labelled figure AFTER the bare total, or the line reads as one phrase', () => {
    // Seen in a browser, not in jsdom: rendered first, the line read
    // `… 820 ms to first token 4.2 s`, where the label sits between the two numbers and a
    // reader cannot tell which one it belongs to. The total has always been the bare number on
    // this line, so the labelled one goes after it.
    show({ firstTokenMs: 820, latencyMs: 4200 })

    const line = screen.getByTestId('meta-line')
    expect(line).toHaveTextContent('820 ms')
    expect(line).toHaveTextContent('4.2 s')
    const text = line.textContent ?? ''
    expect(text.indexOf('4.2 s')).toBeLessThan(text.indexOf('820 ms'))
  })

  it('says it in the active language', () => {
    show({ firstTokenMs: 820 }, 'pt')

    expect(screen.getByTestId('meta-line')).toHaveTextContent(t('meta.firstToken', 'pt'))
  })
})
