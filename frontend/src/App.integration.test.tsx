import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { Playground } from './panes/Playground'
import { LangContext } from './i18n/context'
import { t } from './i18n/strings'

const ROW = { name: 'reference', kind: 'prompt', version: '1', version_status: 'active', model: 'model', harness: 'prompt-agent', suggestions: [], selectable: true, reason: '' }
const DEFINITION = { path: 'ai/harness/_shared/agent_core.yaml', yaml: 'instructions: Be useful.', instructions: 'Be useful.', served_instructions: 'Different.', drifted: true, shared_with: ['reference', 'hosted'] }
const TOOLS = [{ name: 'first', description: 'First tool', schema: { first: true } }, { name: 'second', description: 'Second tool', schema: { second: true } }]
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function stub({ tools = Promise.resolve(json({ tools: TOOLS })), definition = json({ definition: DEFINITION, error: null }), enabled = true, lang = 'en' }: { tools?: Promise<Response> | (() => Promise<Response>); definition?: Response; enabled?: boolean | null; lang?: 'en' | 'pt' } = {}) {
  localStorage.setItem('fla.prefs.v1', JSON.stringify({ lang }))
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/config')) return json({ harness: 'prompt-agent', agent_name: 'reference', model: 'model', suggestions: [], playground: { enabled }, agents: { can_promote: false, can_propose: enabled ?? undefined } })
    if (url.endsWith('/tools')) return typeof tools === 'function' ? tools() : tools
    if (url.endsWith('/definition/proposal')) return json({ ok: true, diff: '--- a/agent_core.yaml\n+ Be brief.', yaml: 'instructions: Be brief.', error: '' })
    if (url.endsWith('/definition')) return definition.clone()
    if (url.endsWith('/agents/reference')) return json({ agent: { ...ROW, instructions: 'Different.', tools: [], reasoning: null, container: null, versions: null }, error: null })
    if (url.endsWith('/agents')) return json({ agents: [ROW], error: null })
    throw new Error(`unexpected ${init?.method ?? 'GET'} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => { localStorage.clear(); window.history.pushState({}, '', '/tools') })
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })

describe('App playground listing', () => {
  it('shows loading then selects the first arriving tool and its raw arguments', async () => {
    let resolve!: (response: Response) => void
    stub({ tools: new Promise((r) => { resolve = r }) })
    render(<App />)
    expect(await screen.findByText(t('tools.loading', 'en'))).toBeInTheDocument()
    await act(async () => resolve(json({ tools: TOOLS })))
    expect(await screen.findByRole('button', { name: 'first' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('tool-schema')).toHaveTextContent('first')
    expect(screen.getByRole('textbox', { name: t('tools.arguments', 'en') })).toHaveValue('{}')
  })
  it('distinguishes a successful empty listing', async () => {
    stub({ tools: Promise.resolve(json({ tools: [] })) }); render(<App />)
    expect(await screen.findByText(t('tools.empty', 'en'))).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it.each(['http', 'network'])('reports %s failure rather than empty', async (failure) => {
    stub({ tools: failure === 'http' ? Promise.resolve(json({ tools: [] }, 503)) : async () => { throw new Error('offline') } })
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent(t('tools.listFailed', 'en'))
    expect(screen.queryByText(t('tools.empty', 'en'))).not.toBeInTheDocument()
  })
})

it('preserves a valid user selection across refresh and replaces an invalid one', async () => {
  const view = render(<LangContext.Provider value="en"><Playground tools={TOOLS} /></LangContext.Provider>)
  await userEvent.click(screen.getByRole('button', { name: 'second' }))
  view.rerender(<LangContext.Provider value="en"><Playground tools={[...TOOLS]} /></LangContext.Provider>)
  expect(screen.getByRole('button', { name: 'second' })).toHaveAttribute('aria-pressed', 'true')
  view.rerender(<LangContext.Provider value="en"><Playground tools={[TOOLS[0]]} /></LangContext.Provider>)
  expect(screen.getByRole('button', { name: 'first' })).toHaveAttribute('aria-pressed', 'true')
})

describe('App definition proposal', () => {
  beforeEach(() => window.history.pushState({}, '', '/agents/reference'))
  it.each(['en', 'pt'] as const)('opens from detail with provenance and warnings in %s and produces only a proposal', async (lang) => {
    const fetchMock = stub({ lang }); render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: t('propose.title', lang) }))
    const editor = screen.getByTestId('propose')
    expect(within(editor).getByText(t('propose.fromThisBuild', lang))).toBeInTheDocument()
    expect(within(editor).getByTestId('propose-drift')).toHaveTextContent(t('propose.drift', lang))
    expect(within(editor).getByTestId('propose-shared')).toHaveTextContent('hosted')
    const field = within(editor).getByRole('textbox', { name: t('propose.instructions', lang) })
    await userEvent.clear(field); await userEvent.type(field, 'Be brief.')
    await userEvent.click(within(editor).getByRole('button', { name: t('propose.produce', lang) }))
    expect(await screen.findByTestId('propose-diff')).toHaveTextContent('+ Be brief.')
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(writes).toHaveLength(1)
    expect(String(writes[0][0])).toMatch(/\/agents\/reference\/definition\/proposal$/)
    expect(JSON.parse(writes[0][1]!.body as string)).toEqual({ instructions: 'Be brief.' })
    await userEvent.click(screen.getByRole('button', { name: t('agent.back', lang) }))
    expect(screen.queryByTestId('propose')).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: t('nav.agents', lang) }))
    await userEvent.click(await screen.findByRole('button', { name: `${t('agent.inspect', lang)}: reference` }))
    await userEvent.click(await screen.findByRole('button', { name: t('propose.title', lang) }))
    expect(screen.getByRole('textbox', { name: t('propose.instructions', lang) })).toHaveValue('Be useful.')
    expect(screen.queryByTestId('propose-diff')).not.toBeInTheDocument()
  })
  it.each([false, null])('offers nothing and reads no definition with proposals disabled or absent (%s)', async (enabled) => {
    const fetchMock = stub({ enabled }); render(<App />)
    await screen.findByText('Different.')
    expect(screen.queryByRole('button', { name: t('propose.title', 'en') })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/definition'))).toBe(false)
  })
  it('offers no editor for a non-owned agent', async () => {
    const fetchMock = stub({ definition: json({ definition: null, error: 'not_owned' }, 403) }); render(<App />)
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/definition'))).toBe(true))
    expect(screen.queryByRole('button', { name: t('propose.title', 'en') })).not.toBeInTheDocument()
    expect(screen.queryByTestId('propose')).not.toBeInTheDocument()
  })
  it('reports definition failure without opening an editor', async () => {
    stub({ definition: json({ definition: null, error: 'unavailable' }, 502) }); render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent(t('propose.unavailable', 'en'))
    expect(screen.queryByTestId('propose')).not.toBeInTheDocument()
  })
})
