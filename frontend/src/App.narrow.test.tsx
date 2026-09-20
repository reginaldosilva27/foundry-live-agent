/**
 * Spec 047 — the app on a narrow screen.
 *
 * **What this file can and cannot prove.** jsdom applies no stylesheet, so it cannot tell a 320px
 * viewport from a 1440px one: the breakpoint itself is measured in a browser and recorded in the
 * spec (AC8). What *is* testable here is the behaviour the breakpoint switches on — a control that
 * opens the navigation, a rail that knows it is an overlay, and the fact that choosing something
 * inside it runs the same handler the always-open rail runs.
 *
 * That last one is the point of the spec. Below 760px the rail was `display: none`, which took the
 * only route to five of the seven screens out of the page *and* out of the accessibility tree. The
 * fix is not a second navigation — it is the same `Sidebar`, rendered over the conversation.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { t } from './i18n/strings'
import { asSseStream, twoToolTurn } from './test/fixtures'

const CONFIG = {
  harness: 'prompt-agent',
  agent_name: 'foundry-live-agent',
  agent_version: '8',
  model: 'gpt-5.5',
  uses_gateway: true,
  project_name: 'proj',
  speech: { enabled: false },
  voice: { enabled: false, webrtc_api_version: '' },
  tracing: { enabled: true, gateway_logged: false },
  event_types: ['done'],
  event_mapping: { total: 16, verified: 5, unverified: [], note: '' },
}

const AGENTS = [
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
]

function fakeBff() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = String(url)
      if (path.endsWith('/config')) return new Response(JSON.stringify(CONFIG), { status: 200 })
      if (path.endsWith('/agents')) {
        return new Response(JSON.stringify({ agents: AGENTS, error: null }), { status: 200 })
      }
      if (path.includes('/trace/')) {
        return new Response(JSON.stringify({ status: 'pending', spans: [] }), { status: 200 })
      }
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

const rail = () => screen.getByRole('complementary')
const openMenu = () => screen.getByRole('button', { name: t('nav.openMenu', 'en') })

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the way back to the navigation (AC1)', () => {
  it('offers a control that opens it, named in the active language', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    expect(openMenu()).toBeInTheDocument()
  })

  it('marks the rail as an overlay while it is open, and not before', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    // The attribute is what the stylesheet keys off; the boolean lives in `App`.
    expect(rail().dataset.overlay).toBe('false')

    await user.click(openMenu())

    expect(rail().dataset.overlay).toBe('true')
  })
})

describe('it is the same navigation, not a second one (AC3)', () => {
  it('reaches every screen the rail reaches', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })
    await user.click(openMenu())

    // The four screens, the palette and a new session — what the rail carries, unchanged.
    const nav = within(rail())
    for (const key of ['nav.chat', 'nav.agents', 'nav.compare', 'nav.history', 'palette.open'] as const) {
      expect(nav.getByRole('button', { name: t(key, 'en') }), key).toBeInTheDocument()
    }
  })

  it('navigates through the handler the rail already used, and closes behind itself', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })
    await user.click(openMenu())

    await user.click(within(rail()).getByRole('button', { name: t('nav.agents', 'en') }))

    // The same navigation the rail does: the address changes…
    await waitFor(() => expect(window.location.pathname).toBe('/agents'))
    // …and the overlay gets out of the way rather than sitting over the screen it just opened.
    await waitFor(() => expect(rail().dataset.overlay).toBe('false'))
  })
})

describe('closing it (AC4)', () => {
  it('closes on Escape', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })
    await user.click(openMenu())

    await user.keyboard('{Escape}')

    await waitFor(() => expect(rail().dataset.overlay).toBe('false'))
  })

  it('closes from a visible control, so the backdrop is not the only way out', async () => {
    // A backdrop is a fine way to dismiss something and a poor way to discover how. The rail
    // already has a control that puts it away — the one that collapses it on a wide screen — so
    // while it is an overlay that control closes it instead of collapsing it.
    fakeBff()
    render(<App />)
    const user = userEvent.setup()
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })
    await user.click(openMenu())

    await user.click(within(rail()).getByRole('button', { name: t('nav.closeMenu', 'en') }))

    await waitFor(() => expect(rail().dataset.overlay).toBe('false'))
  })

  it('closes on the backdrop', async () => {
    fakeBff()
    render(<App />)
    const user = userEvent.setup()
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })
    await user.click(openMenu())

    await user.click(screen.getByTestId('rail-backdrop'))

    await waitFor(() => expect(rail().dataset.overlay).toBe('false'))
  })
})

describe('what a swapped harness still says (spec 004 AC9)', () => {
  it('names the harness inside the rail, so it survives the header giving it up', async () => {
    // At 320px the badge does not fit the header, so it moves here — beside the model and the
    // gateway line, which is the same family of fact. The claim spec 004 makes, that a harness swap
    // is visible on screen, has to hold at every width or it is not a claim.
    fakeBff()
    render(<App />)
    const user = userEvent.setup()
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    // Only while the rail is the overlay: on a laptop the header carries it, and two copies of one
    // fact on one screen is the duplication §4 exists to prevent.
    expect(within(rail()).queryByTestId('harness-badge')).toBeNull()

    await user.click(openMenu())

    await waitFor(() =>
      expect(within(rail()).getByTestId('harness-badge')).toHaveTextContent('prompt-agent'),
    )
  })
})
