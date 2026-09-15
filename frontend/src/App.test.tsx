/**
 * Spec 004 AC1, AC2, AC4, AC7, AC9, AC12 — the shell, end to end against a faked BFF.
 *
 * The fake answers `/config` and streams `/chat` as real SSE frames, so the path under test is the
 * production one: `fetch` -> `ReadableStream` -> frame parser -> reducer -> DOM.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react'
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

  it('names the model in the sidebar without printing the Foundry project name', async () => {
    // The project id is a deployment detail nobody reads from a screenshot, and `model` arrives
    // from the BFF as `<connection>/<model>` — in a real project both carry the project's name.
    fakeBff([])
    render(<App />)

    const sidebar = screen.getByRole('complementary')
    await waitFor(() => expect(within(sidebar).getByTestId('sidebar-model')).toHaveTextContent('gpt-4o'))
    expect(sidebar.textContent).not.toContain('proj-default')
    expect(sidebar.textContent).not.toContain('foundry-analytics-demo')
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

    const [appRow, foundryRow] = screen.getAllByTestId('tool-row')
    expect(appRow).toHaveAttribute('data-executor', 'app')
    expect(within(appRow).getByTestId('executor-tag')).toHaveTextContent('bff')
    expect(foundryRow).toHaveAttribute('data-executor', 'foundry')
    expect(within(foundryRow).getByTestId('executor-tag')).toHaveTextContent('microsoft_learn')

    // Spec 009 AC1: the payload is not in the chat any more.
    expect(screen.getByRole('main').textContent).not.toContain('America/Sao_Paulo')

    expect(screen.getByTestId('meta-line')).toHaveTextContent('154')
  })

  it('says the agent is working while the turn has produced nothing yet', async () => {
    // The gap between POST /chat and the first event is not instant — a reasoning model with a
    // tool round trip can sit there for seconds. Until this, the turn drew an avatar and blank
    // space, which reads as a frozen app rather than as waiting (§5).
    let push: (event: AgentEvent) => void = () => {}
    let close: () => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).endsWith('/config')) {
          return new Response(JSON.stringify(CONFIG), { status: 200 })
        }
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            push = (event) =>
              controller.enqueue(new TextEncoder().encode(asSseStream([event])))
            close = () => controller.close()
          },
        })
        return new Response(body, { status: 200 })
      }),
    )
    render(<App />)
    await ask()

    expect(await screen.findByTestId('turn-pending')).toBeInTheDocument()

    await act(async () => {
      push({ type: 'text_delta', text: '13:53' })
    })
    await waitFor(() => expect(screen.getByTestId('answer')).toHaveTextContent('13:53'))
    expect(screen.queryByTestId('turn-pending')).toBeNull()

    await act(async () => {
      push({ type: 'done', response_id: 'resp_1' })
      close()
    })
  })

  it('opens the trace panel on the call whose row was pressed (spec 009, AC4)', async () => {
    fakeBff(twoToolTurn)
    render(<App />)
    const user = await ask()

    await waitFor(() => expect(screen.getAllByTestId('tool-row')).toHaveLength(2))
    expect(screen.queryByTestId('trace-panel')).toBeNull()

    await user.click(screen.getAllByTestId('tool-row')[0])

    const panel = await screen.findByTestId('trace-panel')
    expect(panel.querySelector('[data-call="call_1"]')).not.toBeNull()

    // Spec 010 AC7: and the reader opens on that call, which is where the payload now lives.
    expect(screen.getByTestId('log-viewer')).toHaveTextContent('get_current_datetime')
    expect(screen.getByTestId('log-arguments')).toHaveTextContent('America/Sao_Paulo')
    expect(within(panel).getByTestId('trace-activity').textContent).not.toContain('America/Sao_Paulo')
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
