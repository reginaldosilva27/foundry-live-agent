import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ReasoningCard } from './components/ReasoningCard'
import { t, type Lang } from './i18n/strings'
import { DEFAULTS } from './state/preferences'
import { KEYS } from './state/storage'
import { asSseStream, twoToolTurn } from './test/fixtures'
import type { AgentEvent } from './types/events'

const CONFIG = {
  harness: 'prompt-agent', agent_name: 'one', model: 'gpt-5.5', uses_gateway: false,
  project_name: 'project', event_types: [],
  event_mapping: { total: 0, verified: 0, unverified: [], note: '' },
  speech: { enabled: true },
}

function bff(stream?: ReadableStream<Uint8Array>) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).endsWith('/config')) return Response.json(CONFIG)
    if (String(url).endsWith('/agents')) return Response.json({ agents: ['one', 'two'].map((name) => ({
      name, kind: 'prompt', harness: 'prompt-agent', selectable: true, suggestions: [],
    })) })
    if (String(url).endsWith('/chat')) return new Response(stream ?? asSseStream(twoToolTurn))
    return Response.json({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function ask(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox'), 'what time is it')
  await user.click(screen.getByRole('button', { name: /send|enviar/i }))
  await screen.findByTestId('answer')
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/preferences')
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('preferences consumed by App (issue #29)', () => {
  it.each<Lang>(['pt', 'en'])('applies %s strings/document language now and after reload', async (lang) => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([lang === 'pt' ? 'en' : 'pt'])
    bff()
    const user = userEvent.setup()
    let view = render(<App />)
    const prefs = screen.getByRole('region', { name: /preferences|preferências/i })
    await user.click(within(prefs).getByRole('button', { name: lang }))
    expect(screen.getByText(t('prefs.lead', lang))).toBeInTheDocument()
    expect(document.documentElement.lang).toBe(lang)
    view.unmount()
    view = render(<App />)
    expect(screen.getByText(t('prefs.lead', lang))).toBeInTheDocument()
    expect(document.documentElement.lang).toBe(lang)
    view.unmount()
  })

  it('uses browser detection only without a stored choice and persists rail choices', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR'])
    bff()
    const user = userEvent.setup()
    const view = render(<App />)
    expect(document.documentElement.lang).toBe('pt')
    await user.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'en' }))
    expect(JSON.parse(localStorage.getItem(KEYS.preferences)!).lang).toBe('en')
    view.unmount()
    render(<App />)
    expect(document.documentElement.lang).toBe('en')
  })

  it('persists the rail language switch through the same store', async () => {
    bff()
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByRole('group', { name: t('sidebar.language', 'en') })
    const rail = document.getElementById('navigation-rail')!
    await user.click(within(rail).getByRole('button', { name: 'pt' }))
    expect(document.documentElement.lang).toBe('pt')
    expect(JSON.parse(localStorage.getItem(KEYS.preferences)!).lang).toBe('pt')
  })

  it.each([false, true])('reasoning follows %s after reload and respects per-turn toggles', async (open) => {
    bff()
    const user = userEvent.setup()
    let view = render(<App />)
    if (open) await user.click(screen.getByRole('checkbox', { name: t('prefs.reasoningOpen', 'en') }))
    view.unmount()
    window.history.replaceState(null, '', '/')
    view = render(<App />)
    await ask(user)
    const toggle = screen.getByRole('button', { name: t('reasoning.toggle', 'en') })
    expect(toggle).toHaveAttribute('aria-expanded', String(open))
    await user.click(toggle)
    view.rerender(<App />)
    expect(toggle).toHaveAttribute('aria-expanded', String(!open))
  })

  it('updates untouched reasoning when the preference changes', async () => {
    bff()
    window.history.replaceState(null, '', '/')
    const user = userEvent.setup()
    render(<App />)
    await ask(user)
    expect(screen.getByRole('button', { name: t('reasoning.toggle', 'en') })).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: t('sidebar.preferences', 'en') }))
    await user.click(screen.getByRole('checkbox', { name: t('prefs.reasoningOpen', 'en') }))
    await user.click(screen.getByRole('button', { name: t('nav.chat', 'en') }))
    expect(screen.getByRole('button', { name: t('reasoning.toggle', 'en') })).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps a deliberate reasoning choice while more stream frames arrive', async () => {
    let push!: (event: AgentEvent) => void
    let close!: () => void
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      push = (event) => controller.enqueue(new TextEncoder().encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`))
      close = () => controller.close()
    } })
    bff(stream)
    window.history.replaceState(null, '', '/')
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('textbox'), 'question')
    await user.click(screen.getByRole('button', { name: /send/i }))
    await act(async () => push({ type: 'reasoning_summary', text: 'First.' }))
    await user.click(screen.getByRole('button', { name: t('reasoning.toggle', 'en') }))
    await act(async () => { push({ type: 'reasoning_summary', text: ' Second.' }); push({ type: 'done', response_id: 'resp_1' }); close() })
    expect(screen.getByTestId('reasoning-body')).toHaveTextContent('First. Second.')
  })

  it.each<Lang>(['en', 'pt'])('does not promise reading or activity expansion in %s, preserving inert legacy data', async (lang) => {
    localStorage.setItem(KEYS.preferences, JSON.stringify({ ...DEFAULTS, lang, speakAnswers: true, activityOpen: true }))
    const fetchMock = bff()
    const user = userEvent.setup()
    const view = render(<App />)
    expect(screen.queryByRole('checkbox', { name: t('prefs.speakAnswers', lang) })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: t('prefs.activityOpen', lang) })).toBeNull()
    await user.click(screen.getByRole('checkbox', { name: t('prefs.reasoningOpen', lang) }))
    expect(JSON.parse(localStorage.getItem(KEYS.preferences)!)).toMatchObject({ speakAnswers: true, activityOpen: true })
    view.unmount()
    window.history.replaceState(null, '', '/')
    render(<App />)
    await ask(user)
    expect(screen.getAllByTestId('tool-row')).toHaveLength(2)
    expect(screen.queryByTestId('trace-panel')).toBeNull()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/speech'))).toBe(false)
  })

  it('applies language and reasoning for this session when storage refuses writes', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable') })
    bff()
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(screen.getByRole('region', { name: 'Preferences' })).getByRole('button', { name: 'pt' }))
    expect(document.documentElement.lang).toBe('pt')
    await user.click(screen.getByRole('checkbox', { name: t('prefs.reasoningOpen', 'pt') }))
    await user.click(screen.getByRole('button', { name: t('nav.chat', 'pt') }))
    await ask(user)
    await waitFor(() => expect(screen.getByTestId('reasoning-body')).toBeInTheDocument())
  })

  it('applies reasoning to both comparison columns', async () => {
    localStorage.setItem(KEYS.preferences, JSON.stringify({ ...DEFAULTS, reasoningOpen: false }))
    bff()
    window.history.replaceState(null, '', '/compare')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('option', { name: 'two' })
    await user.selectOptions(screen.getByRole('combobox'), 'two')
    await user.type(screen.getByRole('textbox'), 'question')
    await user.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(screen.getAllByTestId('answer')).toHaveLength(2))
    for (const toggle of screen.getAllByRole('button', { name: t('reasoning.toggle', 'en') })) {
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    }
  })
})

it('a deliberate card choice survives preference and stream prop changes', async () => {
  const user = userEvent.setup()
  const view = render(<ReasoningCard text="First" streaming reasoningOpen={false} />)
  await user.click(screen.getByRole('button'))
  view.rerender(<ReasoningCard text="First Second" streaming reasoningOpen />)
  view.rerender(<ReasoningCard text="First Second" streaming={false} reasoningOpen={false} />)
  expect(screen.getByTestId('reasoning-body')).toHaveTextContent('First Second')
})
