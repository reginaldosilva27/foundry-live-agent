/**
 * The chart, drawn (spec 033).
 *
 * Hand-drawn SVG rather than a charting library, and the guards below are why that was worth it:
 * every fill is a token this repository chose and validated, so "no colour literal" is a property
 * the test can actually assert. A library would have brought its own defaults to fight.
 *
 * The negative assertions carry the weight. No colour literal (AC8), no request (AC9), no static
 * mermaid import anywhere in the app (AC14) — each is the kind of thing that decays silently.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Chart } from './Chart'
import { LangContext } from '../i18n/context'
import type { ChartSpec } from '../state/chart'

const BAR: ChartSpec = {
  type: 'bar',
  title: 'Latency by harness',
  x: { label: 'Harness', categories: ['prompt-agent', 'hosted'] },
  y: { label: 'ms' },
  series: [{ label: 'p50', values: [1240, 980] }],
}

const TWO: ChartSpec = {
  ...BAR,
  series: [
    { label: 'p50', values: [1240, 980] },
    { label: 'p95', values: [2100, 1600] },
  ],
}

function show(spec: ChartSpec) {
  return render(
    <LangContext.Provider value="en">
      <Chart spec={spec} />
    </LangContext.Provider>,
  )
}

describe('a bar chart (AC1)', () => {
  it('draws one mark per value', () => {
    const { container } = show(TWO)
    // two series x two categories
    expect(container.querySelectorAll('[data-mark="bar"]')).toHaveLength(4)
  })

  it('names the chart and both axes', () => {
    show(BAR)

    expect(screen.getByText('Latency by harness')).toBeInTheDocument()
    expect(screen.getByText('Harness')).toBeInTheDocument()
    expect(screen.getByText('ms')).toBeInTheDocument()
  })

  it('renders every category', () => {
    show(BAR)
    expect(screen.getByText('prompt-agent')).toBeInTheDocument()
    expect(screen.getByText('hosted')).toBeInTheDocument()
  })
})

describe('a line chart (AC1)', () => {
  const LINE: ChartSpec = { ...TWO, type: 'line' }

  it('draws one path per series and one marker per value', () => {
    const { container } = show(LINE)

    expect(container.querySelectorAll('[data-mark="line"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-mark="point"]')).toHaveLength(4)
  })
})

describe('readable without colour (AC7)', () => {
  it('carries a text label for every series', () => {
    show(TWO)
    const legend = screen.getByTestId('chart-legend')

    expect(within(legend).getByText('p50')).toBeInTheDocument()
    expect(within(legend).getByText('p95')).toBeInTheDocument()
  })

  it('labels a single series too, since the agent may not have written a title', () => {
    show({ ...BAR, title: '' })
    expect(within(screen.getByTestId('chart-legend')).getByText('p50')).toBeInTheDocument()
  })

  it('gives every mark an accessible exact value, so the shape is not the only reading', () => {
    const { container } = show(BAR)
    const titles = [...container.querySelectorAll('[data-mark="bar"] title')].map(
      (t) => t.textContent,
    )

    expect(titles.join(' ')).toContain('1240')
    expect(titles.join(' ')).toContain('980')
  })

  it('describes the whole figure for a screen reader', () => {
    show(BAR)
    expect(screen.getByRole('img', { name: /Latency by harness/ })).toBeInTheDocument()
  })
})

describe('the guards that decay silently', () => {
  const source = readFileSync(join(import.meta.dirname, 'Chart.tsx'), 'utf8')

  it('holds no colour literal — every fill is a design-system token (AC8)', () => {
    const literals = [
      ...(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []),
      ...(source.match(/\b(?:rgba?|hsla?)\(/g) ?? []),
      ...(source.match(/\b(?:red|blue|green|orange|purple|teal|magenta|cyan)\b/g) ?? []),
    ]
    expect(literals, `Chart.tsx must name tokens, not colours: ${literals}`).toEqual([])
  })

  it('draws from the four validated series tokens', () => {
    // The palette was validated all-pairs with the dataviz checker; see the spec's plan.md. If a
    // fifth ever appears here it has not been through that, and the parser caps series at four.
    const ds = readFileSync(
      join(import.meta.dirname, '..', '..', 'public', 'ds', 'colors_and_type.css'),
      'utf8',
    )
    for (const n of [1, 2, 3, 4]) expect(ds).toContain(`--ds-series-${n}`)
    expect(ds).not.toContain('--ds-series-5')
  })

  it('issues no request as a result of rendering (AC9)', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    show(TWO)

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('inspects no answer text — it is handed a parsed spec and nothing else (AC9)', () => {
    // The §8 guard in its structural form, asserted on the IMPORTS rather than on the prose: this
    // module cannot reach the conversation, the stream or the BFF, because nothing here imports
    // them. The fence was found by react-markdown's parser, not by a heuristic over the answer.
    const imports = [...source.matchAll(/^\s*import\s[^\n]*from\s+['"]([^'"]+)['"]/gm)].map(
      (m) => m[1],
    )

    expect(imports.sort()).toEqual(['../i18n/context', '../state/chart'])
    expect(source).not.toMatch(/\bfetch\s*\(/)
  })

  it('imports mermaid nowhere statically, so the main bundle does not carry it (AC14)', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.tsx?$/.test(entry)) {
          const text = readFileSync(path, 'utf8')
          if (/^\s*import\s[^\n]*from\s+['"]mermaid['"]/m.test(text)) offenders.push(path)
        }
      }
    }
    walk(join(import.meta.dirname, '..'))

    expect(offenders, `mermaid must be imported dynamically: ${offenders}`).toEqual([])
  })
})
