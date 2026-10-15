/**
 * The keyboard and screen-reader pass (spec 040).
 *
 * The point of this file is that it does **not** decay. A checklist in a document describes the
 * app as it was on the day somebody walked it; this walks it on every commit, so a control added
 * three specs from now without a name fails here rather than shipping.
 *
 * It renders the whole app, in the states a reader actually meets, and asserts properties over
 * everything it finds — never per component, which would need remembering.
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
  agents: { can_promote: false },
  event_types: ['done', 'text_delta', 'tool_call'],
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
    suggestions: [{ en: 'Ask something', pt: 'Pergunte algo' }],
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
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      )
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/')
})
afterEach(() => vi.unstubAllGlobals())

const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [tabindex]'

/**
 * The name a screen reader would read.
 *
 * An approximation of the accessible-name computation, deliberately generous: it accepts anything
 * that would produce a name at all. A control failing this has **no** name by any route, which is
 * the only thing worth failing on.
 */
function accessibleName(element: Element): string {
  const labelled = element.getAttribute('aria-labelledby')
  if (labelled) {
    const target = element.ownerDocument.getElementById(labelled)
    if (target?.textContent?.trim()) return target.textContent.trim()
  }
  return (
    element.getAttribute('aria-label')?.trim() ||
    element.getAttribute('title')?.trim() ||
    (element as HTMLElement).textContent?.trim() ||
    (element as HTMLInputElement).value?.trim() ||
    ''
  )
}

function unnamed(container: HTMLElement): string[] {
  return [...container.querySelectorAll(INTERACTIVE)]
    .filter((element) => !element.hasAttribute('aria-hidden'))
    .filter((element) => accessibleName(element) === '')
    .map((element) => `${element.tagName.toLowerCase()}.${element.className || '(no class)'}`)
}

describe('every control says what it does (AC8)', () => {
  it('on the chat, with its suggestions', async () => {
    fakeBff()
    const { container } = render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    const missing = unnamed(container)
    expect(missing, `controls with no accessible name: ${missing.join(', ')}`).toEqual([])
  })

  it('on the agents screen', async () => {
    fakeBff()
    window.history.pushState({}, '', '/agents')
    const { container } = render(<App />)
    await screen.findByRole('searchbox')

    const missing = unnamed(container)
    expect(missing, `controls with no accessible name: ${missing.join(', ')}`).toEqual([])
  })

  it('on what this build is', async () => {
    fakeBff()
    window.history.pushState({}, '', '/about')
    const { container } = render(<App />)
    await screen.findByText(t('about.lead', 'en'))

    const missing = unnamed(container)
    expect(missing, `controls with no accessible name: ${missing.join(', ')}`).toEqual([])
  })

  it('on the preferences', async () => {
    fakeBff()
    window.history.pushState({}, '', '/preferences')
    const { container } = render(<App />)
    await screen.findByText(t('prefs.lead', 'en'))

    const missing = unnamed(container)
    expect(missing, `controls with no accessible name: ${missing.join(', ')}`).toEqual([])
  })

  it('on the playground, with its tabs and second-agent picker (specs 020, 060)', async () => {
    fakeBff()
    window.history.pushState({}, '', '/playground')
    const { container } = render(<App />)
    await screen.findByLabelText(t('compare.with', 'en'))
    expect(screen.getByRole('tablist', { name: t('playground.title', 'en') })).toBeInTheDocument()

    const missing = unnamed(container)
    expect(missing, `controls with no accessible name: ${missing.join(', ')}`).toEqual([])
  })

  it('on the playground’s tools tab (spec 060)', async () => {
    fakeBff()
    window.history.pushState({}, '', '/playground/tools')
    const { container } = render(<App />)
    await screen.findByRole('tab', { name: t('playground.tab.tools', 'en'), selected: true })

    const missing = unnamed(container)
    expect(missing, `controls with no accessible name: ${missing.join(', ')}`).toEqual([])
  })

  it('with the navigation open over the conversation (spec 047)', async () => {
    // The state a narrow screen is in. jsdom applies no stylesheet, so this cannot be a 320px
    // viewport — the width itself is measured in a browser and recorded in the spec. What it can
    // walk is the state the breakpoint switches on, which is where the new controls live.
    fakeBff()
    const { container } = render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await userEvent.click(screen.getByRole('button', { name: t('nav.openMenu', 'en') }))

    const missing = unnamed(container)
    expect(missing, `controls with no accessible name: ${missing.join(', ')}`).toEqual([])
  })

  it('after a turn, with its answer actions', async () => {
    fakeBff()
    const { container } = render(<App />)
    const box = await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await userEvent.type(box, 'hello{Enter}')
    await waitFor(() => expect(screen.getByTestId('answer')).toBeInTheDocument())

    const missing = unnamed(container)
    expect(missing, `controls with no accessible name: ${missing.join(', ')}`).toEqual([])
  })
})

describe('the way in, without a mouse (AC1, AC2)', () => {
  it('offers a skip link as the very first focusable element', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await userEvent.tab()

    expect(document.activeElement).toHaveAccessibleName(t('a11y.skipToConversation', 'en'))
  })

  it('never uses a positive tabindex, which would reorder the page unpredictably', async () => {
    fakeBff()
    const { container } = render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    const positive = [...container.querySelectorAll('[tabindex]')]
      .map((el) => Number(el.getAttribute('tabindex')))
      .filter((value) => value > 0)

    expect(positive).toEqual([])
  })
})

describe('what a screen reader is told (AC5, AC6)', () => {
  it('announces that the answer is ready when the turn settles', async () => {
    fakeBff()
    render(<App />)
    const box = await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await userEvent.type(box, 'hello{Enter}')

    const region = await screen.findByTestId('announcer')
    await waitFor(() => expect(region).toHaveTextContent(t('a11y.answerReady', 'en')))
  })

  it('does not put the streaming answer itself in a live region', async () => {
    // Announcing the text token by token would read the whole answer into the queue as it arrives,
    // which is worse than silence. The ANSWER is visible; the completion is the part that is not.
    fakeBff()
    render(<App />)
    const box = await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    await userEvent.type(box, 'hello{Enter}')
    await waitFor(() => expect(screen.getByTestId('answer')).toBeInTheDocument())

    const answer = screen.getByTestId('answer')
    expect(answer.closest('[aria-live]')).toBeNull()
  })
})

describe('the language the page declares (AC7)', () => {
  it('matches the interface language', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    expect(document.documentElement.lang).toBe('en')
  })

  it('follows a change, so pronunciation follows the reader', async () => {
    fakeBff()
    render(<App />)
    await screen.findByRole('textbox', { name: t('composer.placeholder', 'en') })

    const rail = screen.getByRole('complementary')
    await userEvent.click(within(rail).getByRole('button', { name: 'pt' }))

    await waitFor(() => expect(document.documentElement.lang).toBe('pt'))
  })
})
