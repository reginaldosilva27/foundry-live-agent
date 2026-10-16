/**
 * Images in an answer (spec 044), loaded only on request (spec 063).
 *
 * The clarify step split this spec in two and shipped one half. What is tested here is the
 * rendering: no contract change, no new tool, no unverified API. The generation half is deferred in
 * `docs/REFERENCES.md`, because building it would mean guessing a Foundry API nobody here could
 * check — which is the failure this repository exists to demonstrate the avoidance of.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Markdown } from './Markdown'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'

const URL = 'https://learn.microsoft.com/media/foundry/architecture.png'

function show(markdown: string, lang: 'en' | 'pt' = 'en') {
  return render(
    <LangContext.Provider value={lang}>
      <Markdown text={markdown} settled />
    </LangContext.Provider>,
  )
}

/** Spec 063: the reader asks for the image before the browser fetches it. */
async function load() {
  await userEvent.click(screen.getByRole('button', { name: t('image.load', 'en') }))
}

describe('before the reader asks (spec 063)', () => {
  it('makes no image element at all, so the browser requests nothing (AC1)', () => {
    // A prompt injection can make the agent write an image URL that carries the conversation in
    // its query string. Rendering the <img> would send it, with nobody pressing anything.
    const { container } = show(`![The architecture](${URL})`)

    expect(container.querySelector('img')).toBeNull()
  })

  it('names the host it would load from (AC2)', () => {
    show(`![The architecture](${URL})`)
    expect(screen.getByTestId('answer-image-pending')).toHaveTextContent('learn.microsoft.com')
  })

  it('shows the description, or says there is none (AC3)', () => {
    show(`![The architecture](${URL})\n\n![](${URL}?b)`)
    const pending = screen.getAllByTestId('answer-image-pending')

    expect(pending[0]).toHaveTextContent('The architecture')
    expect(pending[1]).toHaveTextContent(t('image.noDescription', 'en'))
  })

  it('offers a named control in English and in Portuguese (AC4)', () => {
    show(`![x](${URL})`)
    expect(screen.getByRole('button', { name: t('image.load', 'en') })).toBeInTheDocument()
  })

  it('names it in Portuguese too (AC4)', () => {
    show(`![x](${URL})`, 'pt')
    expect(screen.getByRole('button', { name: t('image.load', 'pt') })).toBeInTheDocument()
  })

  it('renders an address the browser cannot parse as text, with nothing to load (AC6)', () => {
    const { container } = show('![x](http://[not-a-host/a.png)')

    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByRole('button', { name: t('image.load', 'en') })).not.toBeInTheDocument()
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('an image the answer carried (AC1, AC2, AC12)', () => {
  it('renders it once asked, lazily and without a referrer (spec 063 AC5)', async () => {
    // The one request in this app that does not go to the BFF. A proxy would be worse: it would
    // make the BFF a machine that fetches arbitrary URLs on request.
    const { container } = show(`![The architecture](${URL})`)
    await load()
    const image = container.querySelector('img')!

    expect(image).toHaveAttribute('src', URL)
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('uses the description the answer gave it (AC3)', async () => {
    show(`![The architecture](${URL})`)
    await load()
    expect(screen.getByAltText('The architecture')).toBeInTheDocument()
  })

  it('states that there is no description rather than inventing one (AC3)', async () => {
    // An image the answer did not describe HAS no description. Saying so is more useful to a
    // screen-reader user than a guess, and §5 forbids the guess anyway.
    show(`![](${URL})`)
    await load()
    expect(screen.getByAltText(t('image.noDescription', 'en'))).toBeInTheDocument()
  })
})

describe('an image that will not load (AC6)', () => {
  it('shows the URL, visible and selectable (spec 063 AC7)', async () => {
    const { container } = show(`![x](${URL})`)
    await load()

    // Usually an expired link, which is exactly the thing worth being able to read.
    fireEvent.error(container.querySelector('img')!)

    expect(screen.getByRole('note')).toHaveTextContent(t('image.failed', 'en'))
    expect(screen.getByText(URL)).toBeInTheDocument()
  })
})

describe('an inlined image (AC11)', () => {
  it('never reaches the page, because the renderer drops it first', () => {
    // MEASURED, not assumed: `react-markdown` sanitises a `data:` source to the empty string
    // before this component sees it. That is a stronger guarantee than a size check of our own,
    // which would have been dead code pretending to do the work.
    //
    // It matters because an inlined image would cross the SSE stream as a multi-megabyte string
    // and then be written into this browser's record, which keeps 25 conversations.
    const huge = `data:image/png;base64,${'A'.repeat(9000)}`
    const { container } = show(`![x](${huge})`)

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).not.toContain('base64')
  })

  it('drops a small one too — the rule is the scheme, not the size', () => {
    const tiny = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='
    const { container } = show(`![x](${tiny})`)

    expect(container.querySelector('img')).toBeNull()
  })
})

describe('opening it larger (AC4)', () => {
  it('opens an overlay that names the image', async () => {
    show(`![The architecture](${URL})`)
    await load()

    await userEvent.click(screen.getByTestId('answer-image'))

    expect(screen.getByRole('dialog', { name: 'The architecture' })).toBeInTheDocument()
  })

  it('closes again', async () => {
    show(`![The architecture](${URL})`)
    await load()
    await userEvent.click(screen.getByTestId('answer-image'))

    await userEvent.click(screen.getByRole('button', { name: t('image.close', 'en') }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('the guards (AC8, AC9)', () => {
  it('issues no request of its own', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    show(`![x](${URL})`)

    // The app never asks anything to PRODUCE an image (§8); the browser merely loads one.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('introduces no event type — an image is text', () => {
    // The tempting wrong answer was a tenth AgentEvent, spent transporting a URL that `text_delta`
    // already transports. `contract-parity.test.ts` holds the nine; this states the reason.
    show(`Here it is.\n\n![x](${URL})`)

    expect(screen.getByText('Here it is.')).toBeInTheDocument()
    expect(screen.getByTestId('answer-image-pending')).toBeInTheDocument()
  })
})
