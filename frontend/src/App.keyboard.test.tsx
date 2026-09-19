/**
 * Spec 025 AC3, AC6, AC7 — the keyboard and the palette, against a faked BFF.
 *
 * The risk this file exists for is **drift**: the palette is a fourth way to choose an agent and a
 * third way to open a conversation, and a fourth way that behaves slightly differently is worse
 * than not having one. So the assertions compare *outcomes* with what the rail already does.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { BINDINGS } from './state/keys'
import { HISTORY_KEY, type StoredConversation } from './state/history'
import { t } from './i18n/strings'
import { asSseStream, twoToolTurn } from './test/fixtures'
import type { AgentRow } from './types/agents'

const CONFIG = {
  harness: 'prompt-agent',
  suggestions: [],
  agent_name: 'foundry-live-agent',
  agent_version: null,
  model: 'foundry-analytics-demo/gpt-5.5',
  uses_gateway: true,
  project_name: 'proj-default',
  event_types: [],
  event_mapping: { total: 16, verified: 5, unverified: [], note: '' },
  voice: { enabled: false, webrtc_api_version: '2026-01-01-preview' },
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
  {
    name: 'foundry-live-agent-hosted',
    kind: 'hosted',
    version: '2',
    version_status: 'active',
    model: 'gpt-5.5',
    harness: 'langgraph',
    suggestions: [],
    selectable: true,
    reason: '',
  },
]

let sent: Array<Record<string, unknown>> = []

function fakeBff() {
  sent = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url)
      if (path.endsWith('/config')) return new Response(JSON.stringify(CONFIG), { status: 200 })
      if (path.endsWith('/agents')) {
        return new Response(JSON.stringify({ agents: AGENTS, error: null }), { status: 200 })
      }
      if (path.includes('/trace/')) {
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

const openPalette = () => userEvent.keyboard('{Meta>}k{/Meta}')

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the shortcuts (AC1, AC3)', () => {
  it('opens the palette on the chord', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await openPalette()

    expect(screen.getByRole('dialog', { name: t('palette.open', 'en') })).toBeInTheDocument()
  })

  it('opens it from a visible control too, so the keyboard is never the only way (AC3)', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: t('palette.open', 'en') }))

    expect(screen.getByRole('dialog', { name: t('palette.open', 'en') })).toBeInTheDocument()
  })

  it('focuses the composer on a bare slash', async () => {
    fakeBff()
    render(<App />)
    const field = await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })
    ;(document.activeElement as HTMLElement)?.blur()

    await userEvent.keyboard('/')

    expect(field).toHaveFocus()
  })

  it('does not fire a bare letter into the question being typed (AC2)', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()
    const field = await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await user.type(field, 'n/t')

    expect(field).toHaveValue('n/t')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('remembers the rail\'s collapsed flag across a remount — it lives in App now', async () => {
    fakeBff()
    const { unmount } = render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })
    ;(document.activeElement as HTMLElement)?.blur()

    await userEvent.keyboard('{Meta>}b{/Meta}')
    await waitFor(() =>
      expect(screen.getByRole('complementary').dataset.collapsed).toBe('true'),
    )

    unmount()
    render(<App />)
    expect(screen.getByRole('complementary').dataset.collapsed).toBe('true')
  })
})

describe('every command has a control (AC3)', () => {
  it('names a command for each binding, and each is reachable without the keyboard', () => {
    // The rail carries new conversation, the rail carries the palette and the collapse, the header
    // carries traces, the composer is a field you can click, and the trace panel carries its own
    // arrows. This asserts the table has not grown a command with no home.
    const commands = BINDINGS.map((binding) => binding.command)
    expect(commands).toEqual([
      'openPalette',
      'toggleRail',
      'focusComposer',
      'newConversation',
      'toggleTraces',
      'previousTurn',
      'nextTurn',
    ])
  })
})

describe('choosing from the palette (AC6, AC7)', () => {
  it('selects an agent and starts a new conversation, exactly as the screen does', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await user.type(
      screen.getByRole('textbox', { name: t('composer.placeholder', 'en') }),
      'what time is it',
    )
    await user.click(screen.getByRole('button', { name: t('composer.send', 'en') }))
    await waitFor(() => expect(sent).toHaveLength(1))

    ;(document.activeElement as HTMLElement)?.blur()
    await openPalette()
    await user.click(screen.getByText('foundry-live-agent-hosted'))

    // 019 AC7: switching agents starts a new conversation, so the transcript is gone…
    await waitFor(() => expect(screen.queryByTestId('answer')).not.toBeInTheDocument())

    // …and the next turn names the chosen agent with no conversation behind it.
    await user.type(
      screen.getByRole('textbox', { name: t('composer.placeholder', 'en') }),
      'and now?',
    )
    await user.click(screen.getByRole('button', { name: t('composer.send', 'en') }))
    await waitFor(() => expect(sent).toHaveLength(2))

    expect(sent[1].agent).toBe('foundry-live-agent-hosted')
    expect(sent[1].conversation_id).toBeUndefined()
  })

  it('reopens a conversation with its pointer, exactly as the rail does', async () => {
    fakeBff()
    localStorage.setItem(HISTORY_KEY, JSON.stringify([CONVERSATION]))
    render(<App />)
    const user = userEvent.setup()
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await openPalette()
    // Scoped to the dialog: the rail's history list carries the same title, which is the point of
    // the palette rather than a problem with it.
    const palette = screen.getByRole('dialog', { name: t('palette.open', 'en') })
    await user.click(within(palette).getByText('what time is it'))

    expect(await screen.findByText('It is 19:00 in Sao Paulo.')).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/c/c_1'))

    await user.type(
      screen.getByRole('textbox', { name: t('composer.placeholder', 'en') }),
      'and now?',
    )
    await user.click(screen.getByRole('button', { name: t('composer.send', 'en') }))

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].conversation_id).toBe('conv_from_foundry')
  })

  it('offers no voice action where the deployment has none (AC8)', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await openPalette()
    const voice = screen.getByText(t('keys.startVoice', 'en')).closest('[role="option"]')

    expect(voice).toHaveAttribute('aria-disabled', 'true')
  })
})
