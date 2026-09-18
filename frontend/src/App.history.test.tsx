/**
 * Spec 027 AC4, AC6, AC9 — the record's screen, wired.
 *
 * The two assertions that matter most here are about the *absence* of a request. Search reads what
 * this browser drew, and import writes a pointer Foundry gave some other browser: neither may ask
 * the service anything, because either would be this app deriving a decision from its own storage
 * (§8, spec 021's second rule).
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { t } from './i18n/strings'
import { HISTORY_KEY, toExportFile, type StoredConversation } from './state/history'
import { writeJson } from './state/storage'

const NOW = new Date('2026-09-16T15:00:00Z').getTime()

function conversation(over: Partial<StoredConversation> = {}): StoredConversation {
  return {
    id: 'c1',
    conversationId: 'conv_1',
    agent: null,
    title: 'Deploying to Container Apps',
    updatedAt: NOW,
    messages: [
      { role: 'user', id: 'u1', text: 'How do I deploy?' },
      {
        role: 'agent',
        id: 'a1',
        startedAt: 0,
        turn: {
          reasoning: '',
          activities: [],
          text: 'With azd up.',
          status: 'done',
          unknownEvents: {},
        },
      },
    ],
    ...over,
  }
}

/** `GET /config` and `GET /agents` are the only calls a quiet app makes. */
function stubBff() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/config')) {
      return new Response(
        JSON.stringify({
          harness: 'prompt-agent',
          agent_name: 'foundry-live-agent',
          model: 'foundry-analytics-demo/gpt-5.5',
          uses_gateway: true,
        }),
        { headers: { 'content-type': 'application/json' } },
      )
    }
    if (url.includes('/agents')) {
      return new Response(JSON.stringify({ agents: [] }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new Error(`unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Calls that are not the two a quiet app makes. */
const chatty = (mock: ReturnType<typeof stubBff>) =>
  mock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => !url.endsWith('/config') && !url.includes('/agents'))

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('the history screen, in the app', () => {
  it('renders at its own address (AC6)', async () => {
    writeJson(HISTORY_KEY, [conversation()])
    stubBff()
    window.history.pushState({}, '', '/history')

    render(<App />)

    expect(await screen.findByText(/conversations this browser drew/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('history.exportAll', 'en') })).toBeInTheDocument()
  })

  it('is reachable from the command palette (AC6)', async () => {
    writeJson(HISTORY_KEY, [conversation()])
    stubBff()
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: t('palette.open', 'en') }))
    await userEvent.click(await screen.findByText(t('keys.openHistory', 'en')))

    expect(await screen.findByText(/conversations this browser drew/)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/history')
  })

  it('searches the record without asking the BFF anything (AC4)', async () => {
    writeJson(HISTORY_KEY, [conversation(), conversation({ id: 'c2', title: 'Delta Lake vacuum' })])
    const fetchMock = stubBff()
    render(<App />)

    const field = await screen.findByLabelText(t('history.search', 'en'))
    await userEvent.type(field, 'vacuum')

    expect(screen.queryByText('Deploying to Container Apps')).toBeNull()
    expect(chatty(fetchMock)).toEqual([])
  })

  it('imports a record and keeps the pointer Foundry gave it, asking nothing (AC9)', async () => {
    const fetchMock = stubBff()
    window.history.pushState({}, '', '/history')
    render(<App />)

    const file = new File(
      [JSON.stringify(toExportFile([conversation({ id: 'imported', conversationId: 'conv_from_a_file' })], 0))],
      'record.json',
      { type: 'application/json' },
    )
    await userEvent.upload(await screen.findByLabelText(t('history.import', 'en')), file)

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/1/))
    expect(chatty(fetchMock)).toEqual([])

    // The pointer survived the round trip, which is what makes reopening a resumption (spec 021).
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as StoredConversation[]
    expect(stored.find((c) => c.id === 'imported')?.conversationId).toBe('conv_from_a_file')
  })

  it('opens an imported conversation as the record it was, still asking nothing (AC9)', async () => {
    writeJson(HISTORY_KEY, [conversation({ id: 'imported', conversationId: 'conv_from_a_file' })])
    const fetchMock = stubBff()
    window.history.pushState({}, '', '/history')
    render(<App />)

    // Scoped to the main column: the rail lists the same conversation, and clicking the rail's row
    // would prove nothing about the screen.
    const main = within(screen.getByRole('main'))
    await userEvent.click(await main.findByRole('button', { name: /Deploying to Container Apps/ }))

    expect(await screen.findByText('With azd up.')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/c/imported')
    expect(chatty(fetchMock)).toEqual([])
  })
})
