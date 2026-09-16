/**
 * Spec 021 AC1 · AC6 · AC16 · AC17 · AC18 · AC20 — the shell, against a faked BFF.
 *
 * The pieces are tested where they live; this is about the wiring between them, which is where a
 * feature like history actually goes wrong: a conversation stored under the wrong agent, a restored
 * transcript that quietly opens a *new* Foundry conversation, a private window that takes the app
 * down with it.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { HISTORY_KEY, type StoredConversation } from './state/history'
import { t } from './i18n/strings'
import { asSseStream, twoToolTurn } from './test/fixtures'
import type { AgentEvent } from './types/events'
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

function row(name: string, overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    name,
    kind: 'prompt',
    version: '8',
    version_status: 'active',
    model: 'gpt-5.5',
    harness: 'prompt-agent',
    selectable: true,
    reason: '',
    ...overrides,
  }
}

const AGENTS = [
  row('foundry-live-agent'),
  row('foundry-live-agent-hosted', { kind: 'hosted', harness: 'langgraph' }),
]

let sent: Array<Record<string, unknown>> = []

function fakeBff(events: AgentEvent[] = twoToolTurn, agents: AgentRow[] = AGENTS) {
  sent = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url)
      if (path.endsWith('/config')) return new Response(JSON.stringify(CONFIG), { status: 200 })
      if (path.endsWith('/agents')) {
        return new Response(JSON.stringify({ agents, error: null }), { status: 200 })
      }
      sent.push(JSON.parse(String(init?.body)))
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(asSseStream(events)))
            controller.close()
          },
        }),
        { status: 200 },
      )
    }),
  )
}

async function ask(text = 'what time is it') {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: t('composer.placeholder', 'en') }), text)
  await user.click(screen.getByRole('button', { name: t('composer.send', 'en') }))
  return user
}

/** The card's selectable control — the star beside it matches a name query too (spec 022). */
const card = (name: string) =>
  document.querySelector<HTMLButtonElement>(`button[data-agent="${name}"]`)

/** Who the header says is answering. Two `h2`s exist while the agents screen is open. */
const headerAgent = () => document.querySelector('.header__agent')?.textContent

function stored(): StoredConversation[] {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the two views (AC1, AC6)', () => {
  it('swaps the main column between the conversation and the agents screen', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()

    expect(screen.getByRole('textbox', { name: t('composer.placeholder', 'en') })).toBeVisible()

    await user.click(screen.getByRole('button', { name: t('nav.agents', 'en') }))

    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: t('composer.placeholder', 'en') }),
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: t('nav.chat', 'en') }))
    expect(screen.getByRole('textbox', { name: t('composer.placeholder', 'en') })).toBeVisible()
  })

  it('choosing an agent starts a new conversation and puts the reader back in it', async () => {
    fakeBff()
    render(<App />)
    const user = await ask()
    await screen.findByTestId('answer')

    await user.click(screen.getByRole('button', { name: t('nav.agents', 'en') }))
    await waitFor(() => expect(card('foundry-live-agent-hosted')).not.toBeNull())
    await user.click(card('foundry-live-agent-hosted')!)

    // Back in the chat, empty, and the header names who is answering now.
    expect(screen.getByRole('textbox', { name: t('composer.placeholder', 'en') })).toBeVisible()
    expect(screen.queryByTestId('answer')).toBeNull()
    expect(headerAgent()).toBe('foundry-live-agent-hosted')
  })
})

describe('history (AC16, AC17)', () => {
  it('stores the conversation when the turn settles, and lists it', async () => {
    fakeBff()
    render(<App />)
    await ask('what time is it')
    await screen.findByTestId('answer')

    await waitFor(() => expect(stored()).toHaveLength(1))
    expect(stored()[0].title).toBe('what time is it')
    expect(stored()[0].conversationId).toBe('conv_1')

    const sidebar = screen.getByRole('complementary')
    expect(within(sidebar).getByText(t('history.today', 'en'))).toBeInTheDocument()
    expect(within(sidebar).getByRole('button', { name: 'what time is it' })).toBeInTheDocument()
  })

  it('reopens one and keeps talking to the same Foundry conversation', async () => {
    fakeBff()
    render(<App />)
    const user = await ask('what time is it')
    await screen.findByTestId('answer')
    await waitFor(() => expect(stored()).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: t('sidebar.newSession', 'en') }))
    expect(screen.queryByTestId('answer')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'what time is it' }))
    expect(await screen.findByTestId('answer')).toBeInTheDocument()

    await ask('and now?')

    // The first turn opened a conversation; the third message continues that same one.
    expect(sent.at(-1)?.conversation_id).toBe('conv_1')
    expect(sent.at(-1)?.message).toBe('and now?')
  })

  it('refuses to continue a conversation whose agent the project no longer offers (AC18)', async () => {
    const conversation: StoredConversation = {
      id: 'c1',
      conversationId: 'conv_old',
      agent: 'retired-agent',
      title: 'an old thread',
      updatedAt: Date.now(),
      messages: [{ role: 'user', id: 'turn_0_user', text: 'an old question' }],
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify([conversation]))
    fakeBff(twoToolTurn, [
      ...AGENTS,
      row('retired-agent', { selectable: false, reason: 'disabled', harness: '' }),
    ])
    render(<App />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'an old thread' }))

    expect(screen.getByText('an old question')).toBeInTheDocument()
    expect(screen.getByText(t('agents.blocked', 'en'))).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: t('composer.placeholder', 'en') })).toBeDisabled()
  })
})

describe('a browser that refuses storage (AC20)', () => {
  it('still renders, still streams, and says history is not being kept', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    fakeBff()
    render(<App />)

    await ask()

    expect(await screen.findByTestId('answer')).toHaveTextContent('19:00 in Sao Paulo')
    expect(screen.getByText(t('history.unavailable', 'en'))).toBeInTheDocument()
  })
})

/**
 * Spec 022 AC5 — starring on the agents screen, choosing from the rail.
 *
 * The two surfaces are one rule: both call the same `select`, so switching from a favourite starts
 * a new conversation exactly as choosing a card does (019 AC7).
 */
describe('favourites (AC5)', () => {
  it('puts a starred agent in the rail and switches to it from there', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()
    await ask('what time is it')
    await screen.findByTestId('answer')

    await user.click(screen.getByRole('button', { name: t('nav.agents', 'en') }))
    await user.click(
      await screen.findByRole('button', {
        name: t('agents.favourite', 'en').replace('{name}', 'foundry-live-agent-hosted'),
      }),
    )

    // Starred, not selected: the header still names the agent that was answering.
    expect(headerAgent()).toBe('foundry-live-agent')

    const sidebar = screen.getByRole('complementary')
    expect(within(sidebar).getByText(t('favourites.title', 'en'))).toBeInTheDocument()

    await user.click(
      within(sidebar).getByRole('button', { name: /foundry-live-agent-hosted/ }),
    )

    expect(headerAgent()).toBe('foundry-live-agent-hosted')
    expect(screen.queryByTestId('answer')).toBeNull()
  })
})
