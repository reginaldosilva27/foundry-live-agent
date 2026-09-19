/**
 * Code and tables you can take (spec 035).
 *
 * Driven through the real Markdown pipeline, because the overrides are the feature: what is worth
 * asserting is that a `pre` gets a header, a `table` gets a scroller, and a **chart** — which spec
 * 033's `code` override intercepts first — gets neither.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Markdown } from './Markdown'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'

const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

function show(text: string, settled = true) {
  return render(
    <LangContext.Provider value="en">
      <Markdown text={text} settled={settled} />
    </LangContext.Provider>,
  )
}

/** jsdom has no clipboard; this records what would have been written. */
function clipboard() {
  const writeText = vi.fn(async () => {})
  vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText } })
  return writeText
}

afterEach(() => vi.unstubAllGlobals())

describe('a code block (AC1–AC4)', () => {
  it('names the language it was fenced with', () => {
    show(fence('python', 'print("hi")'))
    expect(within(screen.getByTestId('code-block')).getByText('python')).toBeInTheDocument()
  })

  it('names no language when the fence declared none', () => {
    show('```\nplain\n```')
    const block = screen.getByTestId('code-block')
    // Nothing rather than a guess — an undetected language is a fact about the block.
    expect(block.querySelector('.code-block__lang')?.textContent).toBe('')
  })

  it('offers a copy control with an accessible name (AC2)', () => {
    show(fence('python', 'print("hi")'))
    expect(screen.getByRole('button', { name: t('code.copy', 'en') })).toBeInTheDocument()
  })

  it('copies exactly the code — no language line, no trailing newline (AC3)', async () => {
    const writeText = clipboard()
    show(fence('python', 'print("hi")\nprint("bye")'))

    await userEvent.click(screen.getByRole('button', { name: t('code.copy', 'en') }))

    expect(writeText).toHaveBeenCalledWith('print("hi")\nprint("bye")')
  })

  it('reports success with the feedback the rest of the app uses (AC4)', async () => {
    clipboard()
    show(fence('python', 'x = 1'))

    await userEvent.click(screen.getByRole('button', { name: t('code.copy', 'en') }))

    expect(await screen.findByText(t('copy.copied', 'en'))).toBeInTheDocument()
  })

  it('reports failure when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', {
      ...globalThis.navigator,
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) },
    })
    show(fence('python', 'x = 1'))

    await userEvent.click(screen.getByRole('button', { name: t('code.copy', 'en') }))

    expect(await screen.findByText(t('copy.failed', 'en'))).toBeInTheDocument()
  })

  it('issues no request (AC9)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    clipboard()
    show(fence('python', 'x = 1'))

    await userEvent.click(screen.getByRole('button', { name: t('code.copy', 'en') }))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('while the turn is still arriving (AC8, AC12)', () => {
  it('renders no control, even though the fence itself has closed', () => {
    show(fence('python', 'x = 1'), false)

    expect(screen.queryByRole('button', { name: t('code.copy', 'en') })).not.toBeInTheDocument()
  })

  it('renders the control once the turn settles', () => {
    show(fence('python', 'x = 1'), true)
    expect(screen.getByRole('button', { name: t('code.copy', 'en') })).toBeInTheDocument()
  })
})

describe('a chart is not a code block (spec 033 still holds)', () => {
  const chart = fence(
    'foundry-chart',
    '{ "type": "bar", "x": { "label": "h", "categories": ["a"] }, "y": { "label": "ms" }, "series": [{ "label": "p50", "values": [1] }] }',
  )

  it('draws, and gains no code header or copy control', () => {
    const { container } = show(chart)

    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.queryByTestId('code-block')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t('code.copy', 'en') })).not.toBeInTheDocument()
  })
})

describe('a table (AC5, AC7, AC11)', () => {
  const table = ['| h1 | h2 |', '| --- | --- |', '| a | b |', '| c | d |'].join('\n')

  it('scrolls inside its own container', () => {
    show(table)
    expect(screen.getByTestId('table-block').querySelector('.table-block__scroll')).not.toBeNull()
  })

  it('copies the rendered rows and columns as tab-separated text (AC5)', async () => {
    const writeText = clipboard()
    show(table)

    await userEvent.click(screen.getByRole('button', { name: t('table.copy', 'en') }))

    expect(writeText).toHaveBeenCalledWith('h1\th2\na\tb\nc\td')
  })

  it('offers no second control producing Markdown (AC11)', () => {
    show(table)
    const head = screen.getByTestId('table-block').querySelector('.table-block__head')

    // The answer actions already copy the model's own Markdown verbatim. A second version of the
    // same table would be a second source of truth for it (§4).
    expect(head?.querySelectorAll('button')).toHaveLength(1)
  })

  it('renders no control while the turn is still arriving', () => {
    show(table, false)
    expect(screen.queryByRole('button', { name: t('table.copy', 'en') })).not.toBeInTheDocument()
  })
})
