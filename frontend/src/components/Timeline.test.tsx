/**
 * Spec 029 AC1, AC3, AC4, AC5, AC8, AC10 — the band.
 *
 * It is a list of buttons, not an SVG, and the tests are written that way on purpose: focus, an
 * accessible name and a click target are what AC8 and AC10 ask for, and the platform gives all
 * three to a `<button>`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Timeline } from './Timeline'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import type { Span } from '../types/trace'

function span(over: Partial<Span> = {}): Span {
  return {
    name: 'chat gpt-5.5',
    span_id: 's1',
    parent_id: 'root',
    duration_ms: 100,
    start_ms: 0,
    kind: 'model',
    ...over,
  }
}

const ROOT = span({
  name: 'invoke_agent foundry-live-agent:8',
  span_id: 'root',
  parent_id: 'outside',
  kind: 'agent',
  duration_ms: 1000,
})

/** A run whose children leave 400ms nobody accounted for. */
const WITH_GAP = [
  ROOT,
  span({ span_id: 'a', start_ms: 0, duration_ms: 300 }),
  span({ span_id: 'b', start_ms: 700, duration_ms: 300, kind: 'tool', name: 'execute_tool learn.search' }),
]

function show(props: Partial<React.ComponentProps<typeof Timeline>> = {}) {
  return render(
    <LangContext.Provider value="en">
      <Timeline spans={WITH_GAP} onSelectSpan={() => {}} {...props} />
    </LangContext.Provider>,
  )
}

describe('the band', () => {
  it('renders a titled band with an axis over the measured extent (AC1)', () => {
    show()

    expect(screen.getByText(t('timeline.title', 'en'))).toBeInTheDocument()
    expect(screen.getByTestId('timeline')).toBeInTheDocument()
    // 1000ms measured, so the axis ends at a second.
    expect(screen.getByTestId('timeline-axis')).toHaveTextContent('1.0 s')
  })

  it('gives every segment an accessible name carrying its kind and duration (AC10)', () => {
    show()

    expect(screen.getByRole('button', { name: /chat gpt-5\.5.*300 ms/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /execute_tool learn\.search.*300 ms/ })).toBeInTheDocument()
  })

  it('is operable from the keyboard, because every segment is a button (AC10)', async () => {
    const onSelectSpan = vi.fn()
    show({ onSelectSpan })

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    expect(onSelectSpan).toHaveBeenCalled()
  })

  it('names the run, the model, what Foundry executed, and unattributed time (AC3)', () => {
    show()
    const legend = screen.getByTestId('timeline-legend')

    expect(legend).toHaveTextContent(t('timeline.legendModel', 'en'))
    expect(legend).toHaveTextContent(t('timeline.legendTool', 'en'))
    expect(legend).toHaveTextContent(t('timeline.legendGap', 'en'))
  })

  it('draws the unaccounted time as its own labelled item (AC5)', () => {
    show()

    const gap = screen.getByTestId('timeline-gap')
    expect(gap).toHaveAttribute('aria-label', expect.stringContaining(t('timeline.legendGap', 'en')))
    expect(gap).toHaveAttribute('aria-label', expect.stringContaining('400 ms'))
  })

  it('leaves explaining the gap to the note the panel already carries (§4)', () => {
    // `trace.clientSideNote`, under the span list a few rows below, already says that a tool this
    // app runs leaves no span. The band must not say it again in the same column.
    show()
    expect(screen.queryByText(/leave no span/i)).toBeNull()
  })

  it('says the earlier leg is a separate trace, once, when there was one (AC4)', () => {
    show({ hadRoundTrip: true })
    expect(screen.getAllByText(t('timeline.otherLeg', 'en'))).toHaveLength(1)
  })

  it('says nothing about another leg when the turn had none (AC4)', () => {
    show({ hadRoundTrip: false })
    expect(screen.queryByText(t('timeline.otherLeg', 'en'))).toBeNull()
  })

  it('selects the call behind a segment (AC8)', async () => {
    const onSelectSpan = vi.fn()
    show({ onSelectSpan })

    await userEvent.click(screen.getByRole('button', { name: /execute_tool learn\.search/ }))

    expect(onSelectSpan).toHaveBeenCalledWith('b')
  })

  it('offers nothing to select on a gap, which measured nothing (AC8)', () => {
    show()
    expect(screen.getByTestId('timeline-gap').tagName).not.toBe('BUTTON')
  })

  it('renders nothing at all when there is no run to measure against', () => {
    show({ spans: [] })
    expect(screen.queryByTestId('timeline')).toBeNull()
  })
})

/** AC11 — the component draws the spans' clock, not the browser's. */
describe('the band borrows no wall clock', () => {
  it('never mentions the turn timestamps in its source', () => {
    const text = readFileSync(join(import.meta.dirname, 'Timeline.tsx'), 'utf8')
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

    expect(code).not.toMatch(/\b(startedAt|endedAt|latencyMs|Date\.now)\b/)
  })
})
