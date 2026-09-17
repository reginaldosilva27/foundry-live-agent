/**
 * Spec 026 AC2–AC6 — asking the same question again, and editing one.
 *
 * The distinction this file exists to hold: a person pressing **repeat** is a person asking again,
 * and the app carries the message it is given. Nothing here re-prompts, loops on model output, or
 * decides that an answer was bad enough to ask about twice — that is `noAutoRepeat.test.ts`, and it
 * is a permanent non-goal rather than a feature not yet built.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
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

const field = () => screen.getByRole('textbox', { name: t('composer.placeholder', 'en') })

async function ask(text: string) {
  const user = userEvent.setup()
  await user.type(field(), text)
  await user.click(screen.getByRole('button', { name: t('composer.send', 'en') }))
  return user
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('repeat (AC2, AC3, AC4)', () => {
  it('asks the same question again, on the same conversation', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    const user = await ask('what time is it')
    await waitFor(() => expect(sent).toHaveLength(1))
    await screen.findByTestId('answer-actions')

    await user.click(screen.getByLabelText(t('answer.repeat', 'en')))

    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1].message).toBe('what time is it')
    expect(sent[1].conversation_id).toBe(sent[0].conversation_id ?? 'conv_1')
  })

  it('appends the repeat and leaves the original where it was', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    const user = await ask('what time is it')
    await screen.findByTestId('answer-actions')

    await user.click(screen.getAllByLabelText(t('answer.repeat', 'en'))[0])

    await waitFor(() => expect(screen.getAllByTestId('answer')).toHaveLength(2))
    // The question is on screen twice, because the conversation Foundry holds now contains it twice.
    expect(screen.getAllByLabelText(t('turn.you', 'en'))).toHaveLength(2)
  })

  it('marks the repeated turn, naming who answered it (AC4)', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    const user = await ask('what time is it')
    await screen.findByTestId('answer-actions')

    await user.click(screen.getAllByLabelText(t('answer.repeat', 'en'))[0])

    const mark = await screen.findByTestId('turn-repeat')
    expect(mark).toHaveTextContent('foundry-live-agent')
    // Only the second turn carries it.
    expect(screen.getAllByTestId('turn-repeat')).toHaveLength(1)
  })
})

describe('edit (AC5, AC6)', () => {
  it('puts the question back in the composer, focused, and sends nothing', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    const user = await ask('what time is it')
    await screen.findByTestId('answer-actions')
    const before = sent.length

    await user.click(screen.getByLabelText(t('question.edit', 'en')))

    await waitFor(() => expect(field()).toHaveValue('what time is it'))
    expect(field()).toHaveFocus()
    expect(sent).toHaveLength(before)
  })

  it('sends an edited question as an ordinary turn, original untouched (AC6)', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    const user = await ask('what time is it')
    await screen.findByTestId('answer-actions')

    await user.click(screen.getByLabelText(t('question.edit', 'en')))
    await waitFor(() => expect(field()).toHaveValue('what time is it'))
    await user.type(field(), ' in Tokyo')
    await user.click(screen.getByRole('button', { name: t('composer.send', 'en') }))

    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1].message).toBe('what time is it in Tokyo')
    // No repeat mark: an edited question is a new question, not the same one asked twice.
    expect(screen.queryByTestId('turn-repeat')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(t('turn.you', 'en'))[0]).toHaveTextContent('what time is it')
  })
})

describe('while a turn is in flight (AC10)', () => {
  it('offers neither control', async () => {
    let release!: () => void
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = String(url)
        if (path.endsWith('/config')) return new Response(JSON.stringify(CONFIG), { status: 200 })
        if (path.endsWith('/agents')) {
          return new Response(JSON.stringify({ agents: AGENTS, error: null }), { status: 200 })
        }
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(asSseStream(twoToolTurn.slice(0, 2))))
              release = () => controller.close()
            },
          }),
          { status: 200 },
        )
      }),
    )
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await ask('what time is it')
    await screen.findByLabelText(t('composer.stop', 'en'))

    expect(screen.queryByLabelText(t('answer.repeat', 'en'))).not.toBeInTheDocument()
    expect(screen.queryByLabelText(t('question.edit', 'en'))).not.toBeInTheDocument()

    release()
  })
})
