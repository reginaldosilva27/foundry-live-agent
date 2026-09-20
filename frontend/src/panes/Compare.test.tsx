/**
 * Spec 020 — one question, two agents, two streams, rendered.
 *
 * Rendered through `App` rather than the pane alone, because half the spec is about integration:
 * the address, the trace panel addressing the right column's run, voice refusing itself, and
 * leaving the mode finding the chat exactly as it was. A pane test would prove none of those.
 *
 * The two agents are answered with **different** fixtures on purpose. AC2 — no text, tool row or
 * figure under the wrong agent — is not observable when both columns say the same thing.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { t } from '../i18n/strings'
import { asSseStream } from '../test/fixtures'
import type { AgentEvent } from '../types/events'
import type { AgentRow } from '../types/agents'

const CONFIG = {
  harness: 'prompt-agent',
  agent_name: 'prompt-one',
  agent_version: '8',
  model: 'gpt-5.5',
  uses_gateway: true,
  project_name: 'proj',
  voice: { enabled: true, webrtc_api_version: '2026-01-01-preview' },
  tracing: { enabled: true, gateway_logged: false },
  event_types: ['done', 'text_delta', 'tool_call'],
  event_mapping: { total: 16, verified: 5, unverified: [], note: '' },
  pricing: {
    currency: 'USD',
    recorded_at: '2026-09-18',
    per_tokens: 1_000_000,
    rates: { 'gpt-5.5': { input: 2, cached_input: 0.2, output: 10 } },
  },
}

const row = (over: Partial<AgentRow> & { name: string }): AgentRow => ({
  kind: 'prompt',
  version: '1',
  version_status: 'active',
  model: 'gpt-5.5',
  harness: 'prompt-agent',
  suggestions: [],
  selectable: true,
  reason: '',
  ...over,
})

const AGENTS: AgentRow[] = [
  row({ name: 'prompt-one' }),
  row({ name: 'hosted-two', kind: 'hosted', harness: 'langgraph' }),
  // A second prompt agent, so AC11 — two agents of the same kind — has something to choose.
  row({ name: 'prompt-three' }),
  row({ name: 'no-harness-four', selectable: false, reason: 'no_harness' }),
]

/**
 * The left column's turn: an app-executed tool, then an answer.
 *
 * `get_current_datetime` appears in BOTH fixtures, with a different executor in each — that pair is
 * AC5, the difference spec 018 produced made legible.
 */
const LEFT_TURN: AgentEvent[] = [
  { type: 'reasoning_summary', text: 'Checking the clock.' },
  {
    type: 'tool_call',
    call_id: 'call_L',
    name: 'get_current_datetime',
    arguments: '{}',
    executor: 'app',
  },
  { type: 'tool_result', call_id: 'call_L', name: 'get_current_datetime', output: '{}', duration_ms: 3 },
  { type: 'text_delta', text: 'The prompt agent answers.' },
  { type: 'usage', input_tokens: 120, output_tokens: 34 },
  { type: 'trace_ids', response_id: 'resp_left', conversation_id: 'conv_left' },
  { type: 'done', response_id: 'resp_left' },
]

/**
 * The right column's turn: the same tool, run by Foundry, and **no reasoning summary and no
 * `mcp_call`** — which is AC6, a harness that emits neither rendering as a normal turn.
 */
const RIGHT_TURN: AgentEvent[] = [
  {
    type: 'tool_call',
    call_id: 'call_R',
    name: 'get_current_datetime',
    arguments: '{}',
    executor: 'foundry',
  },
  { type: 'tool_result', call_id: 'call_R', name: 'get_current_datetime', output: '{}', duration_ms: 9 },
  { type: 'text_delta', text: 'The hosted agent answers.' },
  { type: 'usage', input_tokens: 900, output_tokens: 700 },
  { type: 'trace_ids', response_id: 'resp_right', conversation_id: 'conv_right' },
  { type: 'done', response_id: 'resp_right' },
]

const SPANS = {
  resp_left: [
    { span_id: 's1', parent_id: null, name: 'invoke_agent left', kind: 'agent', duration_ms: 10, start_ms: 0 },
  ],
  resp_right: [
    { span_id: 's2', parent_id: null, name: 'invoke_agent right', kind: 'agent', duration_ms: 20, start_ms: 0 },
  ],
}

let sent: Array<Record<string, unknown>> = []

function fakeBff({ refuse, hang }: { refuse?: string; hang?: boolean } = {}) {
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
        const id = path.slice(path.lastIndexOf('/') + 1)
        const spans = SPANS[id as keyof typeof SPANS] ?? []
        return new Response(JSON.stringify({ status: 'ok', spans }), { status: 200 })
      }

      const body = JSON.parse(String(init?.body)) as { agent?: string }
      sent.push(body)
      // A turn with no `agent` is the BFF's configured one — which is how the plain chat asks.
      const agent = body.agent ?? CONFIG.agent_name
      if (refuse && agent === refuse) throw new TypeError('Failed to fetch')

      const events = agent === 'prompt-one' ? LEFT_TURN : RIGHT_TURN
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(asSseStream(hang ? events.slice(0, 3) : events)),
            )
            if (hang) {
              // A real `fetch` errors the body on abort; a fake that ignored the signal would let
              // a stop that stops nothing pass.
              init?.signal?.addEventListener('abort', () =>
                controller.error(new DOMException('aborted', 'AbortError')),
              )
              return
            }
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
  window.history.replaceState(null, '', '/compare')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Open `/compare`, choose the second agent, and return the user-event handle. */
async function compareWith(second = 'hosted-two') {
  const user = userEvent.setup()
  render(<App />)
  const picker = await screen.findByLabelText(t('compare.with', 'en'))
  await user.selectOptions(picker, second)
  return user
}

const columns = () => screen.getAllByTestId('compare-column')
const columnFor = (agent: string) =>
  screen.getByRole('region', { name: t('compare.column', 'en').replace('{agent}', agent) })

async function ask(user: ReturnType<typeof userEvent.setup>, text = 'what time is it') {
  await user.type(screen.getByRole('textbox', { name: t('composer.placeholder', 'en') }), text)
  await user.click(screen.getByRole('button', { name: t('composer.send', 'en') }))
}

describe('one question, both agents (AC1, AC10)', () => {
  it('sends the same text to each, naming a different agent and sharing no conversation', async () => {
    fakeBff()
    const user = await compareWith()

    await ask(user)
    await waitFor(() => expect(sent).toHaveLength(2))

    expect(sent.map((b) => b.message)).toEqual(['what time is it', 'what time is it'])
    expect(sent.map((b) => b.agent).sort()).toEqual(['hosted-two', 'prompt-one'])
    expect(sent.every((b) => b.conversation_id === undefined)).toBe(true)
  })

  it('will not send until a second agent is chosen, and says why', async () => {
    fakeBff()
    render(<App />)
    await screen.findByLabelText(t('compare.with', 'en'))

    expect(screen.getByText(t('compare.needsSecond', 'en'))).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: t('composer.placeholder', 'en') })).toBeDisabled()
  })
})

describe('what lands in which column (AC2, AC3, AC5, AC6)', () => {
  it('keeps each agent’s answer under its own heading', async () => {
    fakeBff()
    const user = await compareWith()
    await ask(user)

    await waitFor(() => expect(columns()).toHaveLength(2))
    await waitFor(() =>
      expect(within(columnFor('prompt-one')).getByTestId('answer')).toHaveTextContent(
        'The prompt agent answers.',
      ),
    )

    expect(within(columnFor('prompt-one')).queryByText(/hosted agent answers/)).toBeNull()
    expect(within(columnFor('hosted-two')).getByTestId('answer')).toHaveTextContent(
      'The hosted agent answers.',
    )
    expect(within(columnFor('hosted-two')).queryByText(/prompt agent answers/)).toBeNull()
  })

  it('carries its own activity inline, and no shared activity pane exists (AC3)', async () => {
    fakeBff()
    const user = await compareWith()
    await ask(user)
    await waitFor(() => expect(columns()).toHaveLength(2))

    // Each column holds its own tool rows. The count is the assertion: a shared pane would put
    // both turns' rows in one place, and neither column would hold exactly its own.
    await waitFor(() =>
      expect(within(columnFor('prompt-one')).getAllByTestId('tool-row')).toHaveLength(1),
    )
    expect(within(columnFor('hosted-two')).getAllByTestId('tool-row')).toHaveLength(1)
    expect(screen.getAllByTestId('tool-row')).toHaveLength(2)
  })

  it('shows the same tool run by two different executors (AC5)', async () => {
    fakeBff()
    const user = await compareWith()
    await ask(user)
    await waitFor(() => expect(screen.getAllByTestId('tool-row')).toHaveLength(2))

    const left = within(columnFor('prompt-one'))
    const right = within(columnFor('hosted-two'))
    expect(left.getByText('get_current_datetime')).toBeInTheDocument()
    expect(right.getByText('get_current_datetime')).toBeInTheDocument()
    expect(left.getByTestId('executor-tag')).not.toHaveTextContent(
      right.getByTestId('executor-tag').textContent ?? '',
    )
  })

  it('renders a column whose harness emits no reasoning and no mcp_call, with no error (AC6)', async () => {
    fakeBff()
    const user = await compareWith()
    await ask(user)

    const right = within(columnFor('hosted-two'))
    await waitFor(() => expect(right.getByTestId('answer')).toBeInTheDocument())
    expect(right.queryByRole('alert')).toBeNull()
  })
})

describe('each column’s own numbers (AC4, AC12)', () => {
  it('shows time to first token, duration, tokens and cost once it settles', async () => {
    fakeBff()
    const user = await compareWith()
    await ask(user)

    const left = within(columnFor('prompt-one'))
    await waitFor(() => expect(left.getByTestId('meta-line')).toBeInTheDocument())
    expect(left.getByTestId('first-token')).toBeInTheDocument()
    expect(left.getByTestId('meta-line')).toHaveTextContent(`154 ${t('meta.tokens', 'en')}`)
    expect(left.getByTestId('turn-cost')).toBeInTheDocument()
  })

  it('says what the hosted column’s cost leaves out, and does not say it of the other (AC12)', async () => {
    fakeBff()
    const user = await compareWith()
    await ask(user)

    await waitFor(() =>
      expect(within(columnFor('hosted-two')).getByTestId('turn-cost')).toBeInTheDocument(),
    )
    expect(within(columnFor('hosted-two')).getByText(t('cost.excludesContainer', 'en'))).toBeInTheDocument()
    expect(within(columnFor('prompt-one')).queryByText(t('cost.excludesContainer', 'en'))).toBeNull()
  })
})

describe('no control that does nothing', () => {
  it('offers neither repeat nor edit in a column — there is no one conversation to repeat into', () => {
    // Seen in a browser: both rendered, because the screen handed `Conversation` a no-op rather
    // than nothing. A control that is there and does nothing is worse than one that is absent, and
    // repeat here is genuinely undefined — asking again would have to ask BOTH agents, which is
    // what the composer already does.
    fakeBff()
    return (async () => {
      const user = await compareWith()
      await ask(user)
      await waitFor(() => expect(columns()).toHaveLength(2))
      await waitFor(() =>
        expect(within(columnFor('prompt-one')).getByTestId('meta-line')).toBeInTheDocument(),
      )

      expect(screen.queryByRole('button', { name: t('answer.repeat', 'en') })).toBeNull()
      expect(screen.queryByRole('button', { name: t('question.edit', 'en') })).toBeNull()
    })()
  })
})

describe('the trace of one run (AC7)', () => {
  it('opens the spans of the column that was asked, not of the other', async () => {
    fakeBff()
    const user = await compareWith()
    await ask(user)

    const right = within(columnFor('hosted-two'))
    await waitFor(() => expect(right.getByTestId('meta-line')).toBeInTheDocument())
    await user.click(right.getAllByRole('button', { name: t('meta.viewTrace', 'en') })[0])

    expect(await screen.findByText('invoke_agent right')).toBeInTheDocument()
    expect(screen.queryByText('invoke_agent left')).toBeNull()
  })
})

describe('failure and stopping (AC8, AC9)', () => {
  it('lets one column fail while the other finishes', async () => {
    fakeBff({ refuse: 'hosted-two' })
    const user = await compareWith()
    await ask(user)

    await waitFor(() =>
      expect(within(columnFor('hosted-two')).getByRole('alert')).toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(within(columnFor('prompt-one')).getByTestId('answer')).toHaveTextContent(
        'The prompt agent answers.',
      ),
    )
  })

  it('stops both columns at once', async () => {
    fakeBff({ hang: true })
    const user = await compareWith()
    await ask(user)

    await user.click(await screen.findByRole('button', { name: t('composer.stop', 'en') }))

    await waitFor(() => expect(screen.getAllByTestId('turn-stopped')).toHaveLength(2))
  })
})

describe('any two agents (AC11)', () => {
  it('offers every selectable agent and refuses none of them for its kind', async () => {
    fakeBff()
    render(<App />)
    const picker = await screen.findByLabelText(t('compare.with', 'en'))

    const offered = within(picker)
      .getAllByRole('option')
      .filter((option) => (option as HTMLOptionElement).value !== '')
    expect(offered.map((o) => (o as HTMLOptionElement).value)).toEqual([
      'prompt-one',
      'hosted-two',
      'prompt-three',
    ])
    expect(offered.every((o) => !(o as HTMLOptionElement).disabled)).toBe(true)
  })

  it('compares two agents of the same kind', async () => {
    fakeBff()
    const user = await compareWith('prompt-three')
    await ask(user)

    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent.map((b) => b.agent).sort()).toEqual(['prompt-one', 'prompt-three'])
    expect(columnFor('prompt-three')).toBeInTheDocument()
  })
})

describe('what comparison mode refuses (AC13) and what it leaves alone (AC14)', () => {
  it('disables voice and names the reason in the active language', async () => {
    fakeBff()
    render(<App />)
    const mic = await screen.findByRole('button', { name: t('composer.voiceInput', 'en') })

    expect(mic).toBeDisabled()
    expect(mic).toHaveAttribute('title', t('compare.voiceUnavailable', 'en'))
  })

  it('leaves the chat’s own conversation exactly where it was', async () => {
    fakeBff()
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/')
    render(<App />)

    await ask(user, 'a question in the chat')
    await waitFor(() => expect(screen.getByTestId('answer')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: t('nav.compare', 'en') }))
    await screen.findByLabelText(t('compare.with', 'en'))
    expect(screen.queryByTestId('answer')).toBeNull()

    await user.click(screen.getByRole('button', { name: t('nav.chat', 'en') }))

    expect(await screen.findByTestId('answer')).toHaveTextContent('The prompt agent answers.')
  })
})
