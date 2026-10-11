import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { t } from './i18n/strings'
import { HISTORY_KEY } from './state/history'
import { KEYS } from './state/storage'
import { emptyTurn } from './state/turn'

const CONFIG = { harness: 'prompt-agent', agent_name: 'reference', event_types: ['done', 'text_delta'] }
const ROW = { name: 'reference', kind: 'prompt', selectable: true, harness: 'prompt-agent', suggestions: [] }

function bff(failed = false, pending = false) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (pending) return new Promise<Response>(() => {})
    if (failed) throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(String(input).endsWith('/config') ? CONFIG : { agents: [ROW], error: null }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => { localStorage.clear(); window.history.replaceState(null, '', '/') })
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

describe('spec 056 observation integration', () => {
  for (const lang of ['en', 'pt'] as const) {
    it(`opens Events by keyboard, identifies restored turns and distinguishes capture in ${lang}`, async () => {
      localStorage.setItem(KEYS.preferences, JSON.stringify({ lang }))
      localStorage.setItem(HISTORY_KEY, JSON.stringify([{
        id: 'restored', agent: 'reference', title: 'Recorded question', updatedAt: Date.now(),
        messages: [
          { role: 'agent', id: 'turn_0', turn: emptyTurn() },
          { role: 'agent', id: 'turn_1', turn: emptyTurn(), events: [] },
        ],
      }]))
      window.history.replaceState(null, '', '/c/restored')
      const fetchMock = bff()
      const user = userEvent.setup()
      render(<App />)
      const entry = await screen.findByRole('button', { name: t('events.title', lang) })
      entry.focus()
      await user.keyboard('{Enter}')
      let inspector = screen.getByRole('complementary', { name: t('events.title', lang) })
      expect(within(inspector).getByText(t('events.context', lang).replace('{turn}', '2').replace('{total}', '2').replace('{agent}', 'reference'))).toBeInTheDocument()
      expect(within(inspector).getByText(t('events.empty', lang))).toBeInTheDocument()
      await user.click(within(inspector).getByRole('button', { name: t('events.previous', lang) }))
      inspector = screen.getByRole('complementary', { name: t('events.title', lang) })
      expect(within(inspector).getByText(t('events.unretained', lang))).toBeInTheDocument()
      expect(within(inspector).getByText(t('events.context', lang).replace('{turn}', '1').replace('{total}', '2').replace('{agent}', 'reference'))).toBeInTheDocument()
      expect(fetchMock.mock.calls.every(([input]) => /\/(config|agents)$/.test(String(input)))).toBe(true)
      await user.click(within(inspector).getByRole('button', { name: t('events.close', lang) }))
      expect(entry).toHaveFocus()
    })
  }

  it('reports configuration loading, not Ready, before any result', () => {
    bff(false, true)
    render(<App />)
    expect(screen.getByText(t('header.statusLoading', 'en'))).toBeInTheDocument()
  })

  it('reports unavailable information and a manual next action after a failed read', async () => {
    bff(true)
    render(<App />)
    expect(await screen.findByText(t('header.statusUnavailable', 'en'))).toBeInTheDocument()
    expect(screen.getByText(t('header.readUnavailable', 'en'))).toBeInTheDocument()
  })

  it('reports idle without claiming service health and opens a no-turn inspector by mouse', async () => {
    bff()
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText(t('header.status', 'en'))).toHaveTextContent('Idle'))
    await user.click(screen.getByRole('button', { name: t('events.title', 'en') }))
    expect(screen.getByText(t('events.noTurn', 'en'))).toBeInTheDocument()
  })
})
