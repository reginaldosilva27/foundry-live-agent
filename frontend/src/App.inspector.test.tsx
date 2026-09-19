/**
 * Spec 030 AC1, AC9, AC10 — the inspector, wired.
 *
 * The assertion that carries the spec's promise is the last one: this screen only ever reads. The
 * definition's source of truth is the repository's YAML, and a browser that could write to Foundry
 * would be a second source drifting from the first (§4). Editing is spec 041's, out of the browser.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { t } from './i18n/strings'

const ROW = {
  name: 'foundry-live-agent',
  kind: 'prompt',
  version: '8',
  version_status: 'active',
  model: 'gpt-5.5',
  harness: 'prompt-agent',
  selectable: true,
  reason: '',
}

const DETAIL = {
  ...ROW,
  instructions: 'You are the reference agent for the foundry-live-agent project.',
  tools: [
    {
      kind: 'mcp',
      name: 'microsoft_learn',
      executor: 'foundry',
      description: '',
      parameters: null,
      server_label: 'microsoft_learn',
      server_url: 'https://learn.microsoft.com/api/mcp',
      require_approval: 'never',
    },
  ],
  reasoning: { summary: 'detailed' },
  container: null,
}

function stubBff() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

    if (url.endsWith('/config')) {
      return json({
        harness: 'prompt-agent',
        agent_name: 'foundry-live-agent',
        model: 'gpt-5.5',
        uses_gateway: false,
      })
    }
    if (url.includes('/agents/')) return json({ agent: DETAIL, error: null })
    if (url.includes('/agents')) return json({ agents: [ROW], error: null })
    throw new Error(`unexpected ${init?.method ?? 'GET'} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => window.history.pushState({}, '', '/'))
afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('inspecting an agent', () => {
  it('renders at its own address, and survives a reload (AC1)', async () => {
    stubBff()
    window.history.pushState({}, '', '/agents/foundry-live-agent')

    render(<App />)

    expect(await screen.findByText(/You are the reference agent/)).toBeInTheDocument()
  })

  it('is reached from the card, without the card losing its own action (AC1)', async () => {
    stubBff()
    window.history.pushState({}, '', '/agents')
    render(<App />)

    await userEvent.click(
      await screen.findByRole('button', { name: `${t('agent.inspect', 'en')}: foundry-live-agent` }),
    )

    expect(window.location.pathname).toBe('/agents/foundry-live-agent')
    expect(await screen.findByText(/You are the reference agent/)).toBeInTheDocument()
  })

  it('shows what Foundry executes, which is the whole lesson (AC4)', async () => {
    stubBff()
    window.history.pushState({}, '', '/agents/foundry-live-agent')
    render(<App />)

    const tool = await screen.findByTestId('agent-tool-microsoft_learn')
    expect(within(tool).getByText(t('agent.executedByFoundry', 'en'))).toBeInTheDocument()
  })

  it('selects the agent and returns to the chat, exactly as the card does (AC9)', async () => {
    stubBff()
    window.history.pushState({}, '', '/agents/foundry-live-agent')
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: t('agent.choose', 'en') }))

    await waitFor(() => expect(window.location.pathname).toBe('/'))
  })

  it('issues nothing but reads (AC10)', async () => {
    const fetchMock = stubBff()
    window.history.pushState({}, '', '/agents/foundry-live-agent')
    render(<App />)

    await screen.findByText(/You are the reference agent/)

    const writes = fetchMock.mock.calls.filter(
      ([, init]) => init?.method && init.method.toUpperCase() !== 'GET',
    )
    expect(writes).toEqual([])
  })
})
