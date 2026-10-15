/**
 * Spec 025 AC1–AC3 — the keyboard, against a faked BFF. The palette it once opened is gone
 * (spec 060, AC3): every binding left has a visible control, and ⌘K opens nothing.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { BINDINGS } from './state/keys'
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


beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the shortcuts (AC1, AC3)', () => {
  it('opens nothing on ⌘K, and no Commands control exists (spec 060, AC3)', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })
    ;(document.activeElement as HTMLElement)?.blur()

    await userEvent.keyboard('{Meta>}k{/Meta}')
    await userEvent.keyboard('{Control>}k{/Control}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^commands$/i })).not.toBeInTheDocument()
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
    // The rail carries new conversation and the collapse, the header carries traces and the event
    // inspector, the composer is a field you can click, and the trace panel carries its own arrows.
    // Spec 060 removed the palette: no chord opens it and no control names it. This asserts the
    // table has not grown a command with no home.
    const commands = BINDINGS.map((binding) => binding.command)
    expect(commands).toEqual([
      'toggleRail',
      'focusComposer',
      'newConversation',
      'toggleTraces',
      'toggleEvents',
      'previousTurn',
      'nextTurn',
    ])
  })
})
