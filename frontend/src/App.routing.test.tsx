/**
 * Spec 024 — the app has addresses.
 *
 * What is under test is the *direction of flow*. The route is an input: it selects what is already
 * in memory or in this browser's storage. It is never a way to fetch, and nothing the app needs in
 * order to be correct lives only in it — Foundry's `conversation_id` still comes from the stored
 * record and the answering agent still comes from the agents state (§8, AC8).
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { HISTORY_KEY, type StoredConversation } from './state/history'
import { t } from './i18n/strings'
import { asSseStream, twoToolTurn } from './test/fixtures'
import type { AgentRow } from './types/agents'

const CONFIG = {
  harness: 'prompt-agent',
  agent_name: 'foundry-live-agent',
  agent_version: null,
  model: 'foundry-analytics-demo/gpt-5.5',
  uses_gateway: true,
  project_name: 'proj-default',
  event_types: [],
  event_mapping: { total: 16, verified: 5, unverified: [], note: '' },
}

const AGENTS: AgentRow[] = [
  {
    name: 'foundry-live-agent',
    kind: 'prompt',
    version: '8',
    version_status: 'active',
    model: 'gpt-5.5',
    harness: 'prompt-agent',
    selectable: true,
    reason: '',
  },
]

let sent: Array<Record<string, unknown>> = []
let traceRequests: string[] = []

function fakeBff() {
  sent = []
  traceRequests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url)
      if (path.endsWith('/config')) return new Response(JSON.stringify(CONFIG), { status: 200 })
      if (path.endsWith('/agents')) {
        return new Response(JSON.stringify({ agents: AGENTS, error: null }), { status: 200 })
      }
      if (path.includes('/trace/')) {
        traceRequests.push(path)
        return new Response(JSON.stringify({ status: 'pending', spans: [] }), { status: 200 })
      }
      sent.push(JSON.parse(String(init?.body)))
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(asSseStream(twoToolTurn)))
            controller.close()
          },
        }),
        { status: 200 },
      )
    }),
  )
}

const CONVERSATION: StoredConversation = {
  id: 'c_1',
  conversationId: 'conv_from_foundry',
  agent: 'foundry-live-agent',
  title: 'what time is it',
  updatedAt: 1,
  messages: [
    { role: 'user', id: 'turn_0_user', text: 'what time is it' },
    {
      role: 'agent',
      id: 'turn_0',
      startedAt: 0,
      endedAt: 1,
      turn: {
        reasoning: '',
        activities: [],
        text: 'It is 19:00 in Sao Paulo.',
        status: 'done',
        unknownEvents: {},
        trace: { responseId: 'resp_1', conversationId: 'conv_from_foundry' },
      },
    },
  ],
}

function at(path: string) {
  window.history.replaceState(null, '', path)
}

function store(...conversations: StoredConversation[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(conversations))
}

beforeEach(() => {
  localStorage.clear()
  at('/')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('loading the app at an address (AC1)', () => {
  it('opens the chat at the root', async () => {
    fakeBff()
    at('/')
    render(<App />)

    expect(
      await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') }),
    ).toBeVisible()
  })

  it('opens the agents screen at /agents', async () => {
    fakeBff()
    at('/agents')
    render(<App />)

    expect(await screen.findByRole('searchbox')).toBeInTheDocument()
  })

  it('renders the chat at the reserved /compare, which spec 020 has not built yet', async () => {
    fakeBff()
    at('/compare')
    render(<App />)

    expect(
      await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') }),
    ).toBeVisible()
  })
})

describe('navigating inside the app (AC2, AC3)', () => {
  it('writes the address without a page load', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: t('nav.agents', 'en') }))

    await waitFor(() => expect(window.location.pathname).toBe('/agents'))
  })

  it('goes back to where the reader was', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: t('nav.agents', 'en') }))
    await waitFor(() => expect(window.location.pathname).toBe('/agents'))

    // jsdom's `back()` is asynchronous and does not fire `popstate` for a `pushState` of its own,
    // which is the browser's behaviour too — the event is what the app listens to.
    at('/')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(
      await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') }),
    ).toBeVisible()
  })
})

describe('a conversation by address (AC4, AC7)', () => {
  it('restores the drawing and the pointer, exactly as the rail does', async () => {
    fakeBff()
    store(CONVERSATION)
    at('/c/c_1')
    render(<App />)

    expect(await screen.findByText('It is 19:00 in Sao Paulo.')).toBeInTheDocument()

    // The pointer is the half that matters: the next turn must continue the Foundry conversation.
    const user = userEvent.setup()
    await user.type(
      screen.getByRole('textbox', { name: t('composer.placeholder', 'en') }),
      'and now?',
    )
    await user.click(screen.getByRole('button', { name: t('composer.send', 'en') }))

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].conversation_id).toBe('conv_from_foundry')
  })

  it('says so when this browser does not have it, and does not redirect', async () => {
    fakeBff()
    at('/c/c_nothing')
    render(<App />)

    expect(await screen.findByTestId('conversation-notice')).toHaveTextContent(
      t('route.conversationMissing', 'en'),
    )
    expect(window.location.pathname).toBe('/c/c_nothing')
  })

  it('creates no conversation out of an address that names none', async () => {
    fakeBff()
    at('/c/c_nothing')
    render(<App />)

    await screen.findByTestId('conversation-notice')
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
  })
})

describe('a trace by address (AC5, AC6)', () => {
  it('opens the panel on the response the address names', async () => {
    fakeBff()
    store(CONVERSATION)
    at('/trace/resp_1')
    render(<App />)

    expect(await screen.findByTestId('trace-panel')).toBeInTheDocument()
    await waitFor(() => expect(traceRequests.some((p) => p.includes('resp_1'))).toBe(true))
  })

  it('opens for a response this browser has no conversation for, and says which half is missing', async () => {
    fakeBff()
    at('/trace/resp_elsewhere')
    render(<App />)

    expect(await screen.findByTestId('trace-panel')).toBeInTheDocument()
    expect(screen.getByTestId('trace-detached')).toHaveTextContent(
      t('trace.conversationElsewhere', 'en'),
    )
    await waitFor(() => expect(traceRequests.some((p) => p.includes('resp_elsewhere'))).toBe(true))
  })
})

describe('leaving a conversation (AC2)', () => {
  it('takes the address with it, so the route does not put the conversation straight back', async () => {
    fakeBff()
    store(CONVERSATION)
    at('/c/c_1')
    render(<App />)
    await screen.findByText('It is 19:00 in Sao Paulo.')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: t('sidebar.newSession', 'en') }))

    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(screen.queryByText('It is 19:00 in Sao Paulo.')).not.toBeInTheDocument()
  })

  it('gives a new conversation its own address once it has one', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()

    await user.type(
      await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') }),
      'what time is it',
    )
    await user.click(screen.getByRole('button', { name: t('composer.send', 'en') }))

    await waitFor(() => expect(window.location.pathname).toMatch(/^\/c\/c_\d+$/))
  })
})

describe('the address is not state (AC8)', () => {
  it('still posts exactly message, conversation_id and agent after navigating', async () => {
    fakeBff()
    store(CONVERSATION)
    at('/c/c_1')
    render(<App />)
    await screen.findByText('It is 19:00 in Sao Paulo.')

    const user = userEvent.setup()
    await user.type(
      screen.getByRole('textbox', { name: t('composer.placeholder', 'en') }),
      'and now?',
    )
    await user.click(screen.getByRole('button', { name: t('composer.send', 'en') }))

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(Object.keys(sent[0]).sort()).toEqual(['agent', 'conversation_id', 'message'])
  })
})
