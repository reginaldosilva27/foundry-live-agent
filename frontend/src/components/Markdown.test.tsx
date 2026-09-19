/**
 * A chart and a diagram, in an answer (spec 033).
 *
 * These go through the **real** Markdown pipeline rather than calling the renderer directly,
 * because the thing worth testing is the part §8 governs: the fence is found by `react-markdown`'s
 * parser, and nothing in this app looks at the answer text to decide anything. A test that called
 * `Chart` with a spec would prove the drawing and miss the design.
 *
 * The streaming case is the subtle one. A fenced block is invalid for most of its life — it arrives
 * a token at a time — so an open fence must render as what it is, and must never flash a
 * half-parsed chart or claim a stopped turn failed.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown } from './Markdown'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'

const VALID = `{
  "type": "bar",
  "title": "Latency by harness",
  "x": { "label": "Harness", "categories": ["prompt-agent", "hosted"] },
  "y": { "label": "ms" },
  "series": [{ "label": "p50", "values": [1240, 980] }]
}`

function show(text: string) {
  return render(
    <LangContext.Provider value="en">
      <Markdown text={text} />
    </LangContext.Provider>,
  )
}

const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

describe('a chart block (AC1)', () => {
  it('draws when the fence has closed', () => {
    const { container } = show(`Here is the comparison.\n\n${fence('foundry-chart', VALID)}\n`)

    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('Latency by harness')).toBeInTheDocument()
  })

  it('leaves the prose around it alone', () => {
    show(`Here is the comparison.\n\n${fence('foundry-chart', VALID)}\n`)
    expect(screen.getByText('Here is the comparison.')).toBeInTheDocument()
  })

  it('does not touch an ordinary code block', () => {
    const { container } = show(fence('python', 'print("hello")'))

    expect(container.querySelector('svg')).not.toBeInTheDocument()
    expect(container.querySelector('code')).toBeInTheDocument()
  })
})

describe('while it is still arriving (AC3)', () => {
  it('draws nothing from an unclosed fence', () => {
    const partial = '```foundry-chart\n{\n  "type": "bar",\n  "x": { "label'
    const { container } = show(partial)

    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('does not call an unfinished answer a failure', () => {
    // A stopped turn (spec 023) ends mid-fence. That is an unfinished answer, not a broken block,
    // and saying "could not be drawn" would be the app reporting its own impatience as an error.
    const partial = '```foundry-chart\n{\n  "type": "bar",'
    show(partial)

    // A regex, not the bare string: the failure line is rendered as "<headline> — <reason>", and
    // `queryByText` with a string matches the WHOLE text of an element. This assertion passed
    // vacuously until that was noticed.
    expect(
      screen.queryByText(new RegExp(t('chart.couldNotDraw', 'en'))),
    ).not.toBeInTheDocument()
  })

  it('shows what has arrived so far, as a code block', () => {
    const { container } = show('```foundry-chart\n{ "type": "bar"')
    expect(container.textContent).toContain('"type": "bar"')
  })
})

describe('a block that will not draw (AC4, AC5)', () => {
  it('says so, and keeps the content visible', () => {
    const { container } = show(fence('foundry-chart', '{ "type": "pie" }'))

    expect(screen.getByText(new RegExp(t('chart.couldNotDraw', 'en')))).toBeInTheDocument()
    expect(container.textContent).toContain('"type": "pie"')
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('says WHICH rule failed, because the reader is debugging their instructions', () => {
    show(fence('foundry-chart', '{ "type": "pie" }'))
    expect(
      screen.getByText(new RegExp(t('chart.reason.unknown_type', 'en'))),
    ).toBeInTheDocument()
  })

  it('names bad JSON as bad JSON', () => {
    show(fence('foundry-chart', '{ not json at all'))
    expect(screen.getByText(new RegExp(t('chart.reason.bad_json', 'en')))).toBeInTheDocument()
  })

  it('refuses a fifth series rather than dropping one (AC12)', () => {
    const five = JSON.stringify({
      type: 'bar',
      x: { label: 'x', categories: ['a'] },
      y: { label: 'y' },
      series: [1, 2, 3, 4, 5].map((n) => ({ label: `s${n}`, values: [n] })),
    })
    const { container } = show(fence('foundry-chart', five))

    expect(container.querySelector('svg')).not.toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(t('chart.reason.too_many_series', 'en'))),
    ).toBeInTheDocument()
  })

  it('keeps the failed block copyable, so the reader can see exactly what the agent wrote', () => {
    const { container } = show(fence('foundry-chart', '{ "type": "pie" }'))
    expect(container.querySelector('code')).toBeInTheDocument()
  })
})

describe('a diagram block (AC2)', () => {
  it('renders the diagram container once the fence closes', () => {
    show(fence('mermaid', 'graph TD;\n  A-->B;'))
    expect(screen.getByTestId('diagram')).toBeInTheDocument()
  })

  it('renders nothing from an unclosed mermaid fence', () => {
    show('```mermaid\ngraph TD;')
    expect(screen.queryByTestId('diagram')).not.toBeInTheDocument()
  })
})
