/**
 * Spec 004 AC1, AC2, AC4, AC7, AC9, AC12 — the shell, end to end against a faked BFF.
 *
 * The fake answers `/config` and streams `/chat` as real SSE frames, so the path under test is the
 * production one: `fetch` -> `ReadableStream` -> frame parser -> reducer -> DOM.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { AgentEvent } from './types/events'
import { asSseStream, failedTurn, twoToolTurn } from './test/fixtures'

const CONFIG = {
  harness: 'prompt-agent',
  agent_name: 'foundry-live-agent',
  agent_version: null,
  model: 'foundry-analytics-demo/gpt-4o',
  uses_gateway: true,
  project_name: 'proj-default',
  event_types: [],
  event_mapping: { total: 16, verified: 5, unverified: [], note: '' },
}

function fakeBff(events: AgentEvent[], config: unknown = CONFIG) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).endsWith('/config')) {
        if (config === null) return new Response('nope', { status: 500 })
        return new Response(JSON.stringify(config), { status: 200 })
      }
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          // One chunk per frame, which is how it actually arrives.
          for (const event of events) {
            controller.enqueue(new TextEncoder().encode(asSseStream([event])))
          }
          controller.close()
        },
      })
      return new Response(body, { status: 200 })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

async function ask(text = 'what time is it') {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox'), text)
  await user.click(screen.getByRole('button', { name: /send|enviar/i }))
  return user
}

describe('App', () => {
  it('lays out the sidebar, the main column and the trace panel', async () => {
    fakeBff([])
    render(<App />)

    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.queryByTestId('trace-panel')).toBeNull()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /traces|rastros/i }))
    expect(screen.getByTestId('trace-panel')).toBeInTheDocument()
  })

  it('shows which harness the BFF is running', async () => {
    fakeBff([])
    render(<App />)
    await waitFor(() =>
      expect(screen.getByTestId('harness-badge')).toHaveTextContent('prompt-agent'),
    )
  })

  it('says so when the BFF is not answering rather than claiming a harness', async () => {
    fakeBff([], null)
    render(<App />)
    await waitFor(() =>
      expect(screen.getByTestId('harness-badge')).toHaveAttribute('data-known', 'false'),
    )
  })

  it('streams a turn: reasoning, both kinds of tool, then the answer', async () => {
    fakeBff(twoToolTurn)
    render(<App />)
    await ask()

    await waitFor(() => expect(screen.getByTestId('answer')).toHaveTextContent('19:00'))

    expect(screen.getByTestId('reasoning-body')).toHaveTextContent('what time it is')

    const [appCard, foundryCard] = screen.getAllByTestId('tool-card')
    expect(appCard).toHaveAttribute('data-executor', 'app')
    expect(within(appCard).getByTestId('executor-tag')).toHaveTextContent('bff')
    expect(foundryCard).toHaveAttribute('data-executor', 'foundry')
    expect(within(foundryCard).getByTestId('executor-tag')).toHaveTextContent('microsoft_learn')

    expect(screen.getByTestId('meta-line')).toHaveTextContent('154')
  })

  it('renders a terminal error as an error, not as a stream that stopped', async () => {
    fakeBff(failedTurn)
    render(<App />)
    await ask()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('model deployment was not found')
    expect(alert).toHaveTextContent('model_not_found')
  })

  it('renders every string in Portuguese when asked', async () => {
    fakeBff([])
    render(<App />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'pt' }))
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Pergunte algo ao agente')
  })
})
