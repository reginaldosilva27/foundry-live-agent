/**
 * Spec 027 AC4 and spec 060 AC4/AC10 — the record, wired.
 *
 * Spec 060 removed the History screen and its export/import; what stays is the rail's list and its
 * search, which must still ask the service nothing (§8, spec 021's second rule).
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { t } from './i18n/strings'
import { HISTORY_KEY, type StoredConversation } from './state/history'
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

describe('the record lives in the rail only (spec 060)', () => {
  it('offers no History screen in the rail (AC4)', async () => {
    writeJson(HISTORY_KEY, [conversation()])
    stubBff()
    render(<App />)

    await screen.findByText('Deploying to Container Apps')
    expect(screen.queryByRole('button', { name: /^history$/i })).toBeNull()
  })

  it('lands an old /history bookmark on the chat, not a blank screen (AC10)', async () => {
    writeJson(HISTORY_KEY, [conversation()])
    stubBff()
    window.history.pushState({}, '', '/history')

    render(<App />)

    expect(await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })).toBeInTheDocument()
    expect(screen.queryByText(/conversations this browser drew/)).toBeNull()
  })

  it('searches the record without asking the BFF anything (spec 027 AC4)', async () => {
    writeJson(HISTORY_KEY, [conversation(), conversation({ id: 'c2', title: 'Delta Lake vacuum' })])
    const fetchMock = stubBff()
    render(<App />)

    const field = await screen.findByLabelText(t('history.search', 'en'))
    await userEvent.type(field, 'vacuum')

    expect(screen.queryByText('Deploying to Container Apps')).toBeNull()
    expect(chatty(fetchMock)).toEqual([])
  })

  it('reopens a conversation from the rail with its pointer (spec 021)', async () => {
    writeJson(HISTORY_KEY, [conversation()])
    stubBff()
    render(<App />)

    await userEvent.click(await screen.findByText('Deploying to Container Apps'))

    expect(await screen.findByText('With azd up.')).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/c/c1'))
  })
})
