/**
 * Spec 024 — the app has addresses.
 *
 * What is under test is the *direction of flow*. The route is an input: it selects what is already
 * in memory or in this browser's storage. It is never a way to fetch, and nothing the app needs in
 * order to be correct lives only in it — Foundry's `conversation_id` still comes from the stored
 * record and the answering agent still comes from the agents state (§8, AC8).
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { HISTORY_KEY, type StoredConversation } from './state/history'
import { t } from './i18n/strings'
import { asSseStream, twoToolTurn } from './test/fixtures'
import type { AgentRow } from './types/agents'

const CONFIG = {
  harness: 'prompt-agent',
  suggestions: [],
  agent_name: 'foundry-live-agent',
  agent_version: null,
  model: 'example-analytics/gpt-5.5',
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
    suggestions: [],
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

  it('opens what this build is at /about, and survives a reload (spec 032 AC10)', async () => {
    fakeBff()
    at('/about')
    render(<App />)

    // Rendered from the address alone — no click got it here, which is what "survives a reload"
    // means for a screen that keeps no state of its own.
    expect(await screen.findByText(t('about.lead', 'en'))).toBeInTheDocument()
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

/** A spoken turn, as a replayed voice session leaves it: no response id, an id under `voice_`. */
const SPOKEN: StoredConversation = {
  id: 'c_v',
  agent: null,
  title: 'oi',
  updatedAt: 2,
  messages: [
    { role: 'voice-session', id: 'voice_9_session', seconds: 9 },
    { role: 'user', id: 'voice_9_u0', text: 'que horas são' },
    {
      role: 'agent',
      id: 'voice_9_a1',
      startedAt: 0,
      endedAt: 0,
      turn: { reasoning: '', activities: [], text: 'São 19h.', status: 'done', unknownEvents: {} },
    },
  ],
} as unknown as StoredConversation

describe('a turn\u2019s flow (spec 066)', () => {
  it('opens from the turn, takes the turn\u2019s address, and gives it back on close (AC13)', async () => {
    fakeBff()
    store(CONVERSATION)
    at('/c/c_1')
    render(<App />)
    await screen.findByText('It is 19:00 in Sao Paulo.')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: t('flow.open', 'en') }))

    expect(await screen.findByTestId('turn-flow')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/trace/resp_1/flow')
    await user.click(screen.getByRole('button', { name: t('flow.close', 'en') }))
    await waitFor(() => expect(window.location.pathname).toBe('/c/c_1'))
    expect(screen.queryByTestId('turn-flow')).toBeNull()
  })

  it('reopens the stored conversation that holds the turn its address names (AC15)', async () => {
    fakeBff()
    store(CONVERSATION)
    at('/trace/resp_1/flow')
    render(<App />)

    expect(await screen.findByTestId('flow-steps')).toBeInTheDocument()
    expect(screen.getByText('It is 19:00 in Sao Paulo.')).toBeInTheDocument()
  })

  it('says a turn this browser does not hold cannot be drawn, and reads no spans for it (AC15, AC20)', async () => {
    fakeBff()
    at('/trace/resp_elsewhere/flow')
    render(<App />)

    expect(await screen.findByText(t('flow.notInBrowser', 'en'))).toBeInTheDocument()
    expect(screen.queryByTestId('flow-steps')).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(traceRequests).toEqual([])
  })

  it('draws a spoken turn with no address, and reads no spans for it (AC8, AC13, AC20)', async () => {
    fakeBff()
    store(SPOKEN)
    at('/c/c_v')
    render(<App />)
    await screen.findByText('São 19h.')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: t('flow.open', 'en') }))

    expect(await screen.findByTestId('turn-flow')).toBeInTheDocument()
    expect(screen.getByText(t('flow.noIdSpoken', 'en'), { exact: false })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/c/c_v')
    expect(traceRequests).toEqual([])
  })

  it('moves its address with the turn it steps to, and drops it for a turn with none (AC13)', async () => {
    const second = {
      role: 'agent',
      id: 'turn_1',
      startedAt: 2,
      endedAt: 3,
      turn: { reasoning: '', activities: [], text: 'Still 19:00.', status: 'done', unknownEvents: {}, trace: { responseId: 'resp_2' } },
    }
    const third = {
      role: 'agent',
      id: 'turn_2',
      startedAt: 4,
      endedAt: 5,
      turn: { reasoning: '', activities: [], text: 'Stopped early', status: 'stopped', unknownEvents: {} },
    }
    fakeBff()
    store({
      ...CONVERSATION,
      messages: [
        ...CONVERSATION.messages,
        { role: 'user', id: 'turn_1_user', text: 'and now?' },
        second,
        { role: 'user', id: 'turn_2_user', text: 'and now?' },
        third,
      ],
    } as StoredConversation)
    at('/trace/resp_1/flow')
    render(<App />)
    const flow = await screen.findByTestId('turn-flow')
    const user = userEvent.setup()

    await user.click(within(flow).getByRole('button', { name: t('trace.nextTurn', 'en') }))
    await waitFor(() => expect(window.location.pathname).toBe('/trace/resp_2/flow'))

    await user.click(within(screen.getByTestId('turn-flow')).getByRole('button', { name: t('trace.nextTurn', 'en') }))
    await waitFor(() => expect(window.location.pathname).toBe('/c/c_1'))
    expect(screen.getByTestId('turn-flow')).toBeInTheDocument()
    expect(screen.getByText(t('flow.noId', 'en'))).toBeInTheDocument()
  })

  it('reads the spans once when the panel was already open on the turn (AC20)', async () => {
    fakeBff()
    store(CONVERSATION)
    at('/c/c_1')
    render(<App />)
    await screen.findByText('It is 19:00 in Sao Paulo.')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: t('answer.trace', 'en') }))
    await waitFor(() => expect(traceRequests).toHaveLength(1))
    const panel = await screen.findByTestId('trace-panel')
    await user.click(within(panel).getByRole('button', { name: t('flow.open', 'en') }))

    expect(await screen.findByTestId('turn-flow')).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(traceRequests).toHaveLength(1)
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
