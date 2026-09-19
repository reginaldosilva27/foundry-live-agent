/**
 * The event inspector (spec 038).
 *
 * The refusals carry the weight: it opens no connection, it enumerates no event names of its own,
 * and it cannot inject or replay anything — an app that could inject an event would be an app that
 * could fake a run.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EventInspector } from './EventInspector'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'

const TYPES = ['done', 'error', 'mcp_call', 'reasoning_summary', 'text_delta', 'tool_call', 'tool_result', 'trace_ids', 'usage']

const MAPPING = { total: 25, verified: 21, unverified: ['response.mcp_call.failed', 'response.refusal.done'], note: '' }

const EVENTS: unknown[] = [
  { type: 'trace_ids', response_id: 'resp_1' },
  { type: 'text_delta', text: 'Let me ' },
  { type: 'text_delta', text: 'check.' },
  { type: 'tool_call', name: 'search_web', executor: 'bff', call_id: 'c1' },
  { type: 'usage', input_tokens: 1200, output_tokens: 300 },
]

function show(over: Partial<React.ComponentProps<typeof EventInspector>> = {}) {
  const onClose = vi.fn()
  const view = render(
    <LangContext.Provider value="en">
      <EventInspector events={EVENTS} types={TYPES} mapping={MAPPING} onClose={onClose} {...over} />
    </LangContext.Provider>,
  )
  return { ...view, onClose }
}

describe('the list (AC1, AC2)', () => {
  it('renders each event in arrival order with its type', () => {
    show()
    const list = within(screen.getByTestId('events-list'))

    expect(list.getByText('trace_ids')).toBeInTheDocument()
    expect(list.getByText('tool_call')).toBeInTheDocument()
  })

  it('collapses the deltas into one run with a count', () => {
    show()

    const list = within(screen.getByTestId('events-list'))
    expect(list.getByText('text_delta')).toBeInTheDocument()
    expect(list.getByText(t('events.runOf', 'en').replace('{count}', '2'))).toBeInTheDocument()
  })

  it('shows the accumulated text of the run', () => {
    show()
    expect(screen.getByText('Let me check.')).toBeInTheDocument()
  })

  it('says so when nothing has arrived', () => {
    show({ events: [] })
    expect(screen.getByText(t('events.empty', 'en'))).toBeInTheDocument()
  })
})

describe('one event in full (AC3)', () => {
  it('renders its JSON when selected', async () => {
    show()

    await userEvent.click(within(screen.getByTestId('events-list')).getByRole('button', { name: /tool_call/ }))

    const payload = screen.getByTestId('event-payload')
    expect(payload).toHaveTextContent('search_web')
    expect(payload).toHaveTextContent('call_id')
  })

  it('offers it copyable', async () => {
    show()
    await userEvent.click(
      within(screen.getByTestId('events-list')).getByRole('button', { name: /tool_call/ }),
    )

    expect(screen.getByRole('button', { name: t('events.copy', 'en') })).toBeInTheDocument()
  })
})

describe('the filter comes from the config (AC4)', () => {
  it('offers exactly the types it was given', () => {
    show()
    const filter = screen.getByTestId('events-filter')

    for (const type of TYPES) {
      expect(within(filter).getByRole('button', { name: type })).toBeInTheDocument()
    }
  })

  it('offers none when the config has not answered, rather than a built-in list', () => {
    show({ types: [] })
    const filter = screen.getByTestId('events-filter')

    // The contract lives in `contract.py`; a fallback list here would be a fourth copy of it (§4).
    expect(within(filter).queryByRole('button', { name: 'tool_call' })).not.toBeInTheDocument()
  })

  it('narrows the list to the chosen type', async () => {
    show()

    await userEvent.click(within(screen.getByTestId('events-filter')).getByRole('button', { name: 'usage' }))

    const list = within(screen.getByTestId('events-list'))
    expect(list.getByText('usage')).toBeInTheDocument()
    expect(list.queryByText('trace_ids')).not.toBeInTheDocument()
  })
})

describe('the contract’s own honesty (AC5)', () => {
  it('renders the verified count and the total', () => {
    show()
    expect(
      screen.getByText(
        t('events.verified', 'en').replace('{verified}', '21').replace('{total}', '25'),
      ),
    ).toBeInTheDocument()
  })

  it('names each unverified event individually', () => {
    show()
    const unverified = within(screen.getByTestId('events-unverified'))
    for (const name of MAPPING.unverified) expect(unverified.getByText(name)).toBeInTheDocument()
  })
})

describe('what it will not do (AC6, AC12)', () => {
  it('opens no connection of its own', () => {
    const fetchMock = vi.fn()
    const sse = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('EventSource', sse)
    show()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(sse).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('says when a turn produced more events than are kept', () => {
    show({ truncated: true })
    expect(screen.getByText(t('events.truncated', 'en'))).toBeInTheDocument()
  })

  it('does not imply completeness when it is complete', () => {
    show({ truncated: false })
    expect(screen.queryByText(t('events.truncated', 'en'))).not.toBeInTheDocument()
  })
})
