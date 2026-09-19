/**
 * The chart block's schema (spec 033).
 *
 * This is a **public contract** between an agent's instructions and this renderer, which is why it
 * is a parser with named failures rather than a `try { JSON.parse }`. A reader whose agent wrote a
 * block that did not draw is debugging their instructions, and "invalid" tells them nothing.
 *
 * Nothing is defaulted and nothing is dropped. A series one value short is a failure, not a chart
 * with a gap; a fifth series is a failure, not four series and a silent omission. Both would be the
 * app deciding what the data meant (§5).
 */
import { describe, expect, it } from 'vitest'
import { parseChart } from './chart'

const BAR = {
  type: 'bar',
  title: 'Latency by harness',
  x: { label: 'Harness', categories: ['prompt-agent', 'hosted'] },
  y: { label: 'ms' },
  series: [{ label: 'p50', values: [1240, 980] }],
}

const json = (value: unknown) => JSON.stringify(value)

function failure(value: unknown) {
  const result = parseChart(json(value))
  if (result.ok) throw new Error(`expected a failure, parsed as ${result.spec.type}`)
  return result.reason
}

describe('a block that parses', () => {
  it('reads a bar chart', () => {
    const result = parseChart(json(BAR))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.spec.type).toBe('bar')
    expect(result.spec.title).toBe('Latency by harness')
    expect(result.spec.x.categories).toEqual(['prompt-agent', 'hosted'])
    expect(result.spec.series[0].values).toEqual([1240, 980])
  })

  it('reads a line chart', () => {
    const result = parseChart(json({ ...BAR, type: 'line' }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.spec.type).toBe('line')
  })

  it('reads up to four series, which is what the palette was validated for', () => {
    const four = {
      ...BAR,
      series: [1, 2, 3, 4].map((n) => ({ label: `s${n}`, values: [n, n + 1] })),
    }
    const result = parseChart(json(four))

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.spec.series).toHaveLength(4)
  })

  it('accepts a chart with no title, which is optional', () => {
    const { title: _dropped, ...untitled } = BAR
    expect(parseChart(json(untitled)).ok).toBe(true)
  })

  it('accepts zero as a value, which is data and not absence', () => {
    const result = parseChart(json({ ...BAR, series: [{ label: 'p50', values: [0, 0] }] }))
    expect(result.ok).toBe(true)
  })

  it('accepts a negative value', () => {
    const result = parseChart(json({ ...BAR, series: [{ label: 'delta', values: [-5, 12] }] }))
    expect(result.ok).toBe(true)
  })
})

describe('every rule has its own name (AC4, AC6)', () => {
  it('names bad JSON', () => {
    const result = parseChart('{ "type": "bar", ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('bad_json')
  })

  it('names a chart type outside the closed set (AC5)', () => {
    expect(failure({ ...BAR, type: 'pie' })).toBe('unknown_type')
    expect(failure({ ...BAR, type: 'scatter' })).toBe('unknown_type')
  })

  it('names a missing type', () => {
    const { type: _dropped, ...typeless } = BAR
    expect(failure(typeless)).toBe('unknown_type')
  })

  it('names missing categories', () => {
    expect(failure({ ...BAR, x: { label: 'Harness', categories: [] } })).toBe('no_categories')
    expect(failure({ ...BAR, x: { label: 'Harness' } })).toBe('no_categories')
  })

  it('names missing series', () => {
    expect(failure({ ...BAR, series: [] })).toBe('no_series')
  })

  it('names more than four series (AC12)', () => {
    const five = { ...BAR, series: [1, 2, 3, 4, 5].map((n) => ({ label: `s${n}`, values: [n, n] })) }
    expect(failure(five)).toBe('too_many_series')
  })

  it('names a series with fewer values than there are categories', () => {
    expect(failure({ ...BAR, series: [{ label: 'p50', values: [1240] }] })).toBe('length_mismatch')
  })

  it('names a series with more values than there are categories', () => {
    expect(failure({ ...BAR, series: [{ label: 'p50', values: [1, 2, 3] }] })).toBe(
      'length_mismatch',
    )
  })

  it('names a value that is not a number', () => {
    expect(failure({ ...BAR, series: [{ label: 'p50', values: [1240, '980'] }] })).toBe('bad_value')
    expect(failure({ ...BAR, series: [{ label: 'p50', values: [1240, null] }] })).toBe('bad_value')
    expect(failure({ ...BAR, series: [{ label: 'p50', values: [1240, NaN] }] })).toBe('bad_value')
  })

  it('names a series with no label, because AC7 has nothing to render without one', () => {
    expect(failure({ ...BAR, series: [{ values: [1, 2] }] })).toBe('missing_label')
    expect(failure({ ...BAR, series: [{ label: '  ', values: [1, 2] }] })).toBe('missing_label')
  })

  it('refuses a JSON document that is not an object at all', () => {
    expect(parseChart('[1, 2, 3]').ok).toBe(false)
    expect(parseChart('"a string"').ok).toBe(false)
    expect(parseChart('null').ok).toBe(false)
  })
})

describe('it never repairs what it was given (§5)', () => {
  it('does not truncate a fifth series into four', () => {
    const five = { ...BAR, series: [1, 2, 3, 4, 5].map((n) => ({ label: `s${n}`, values: [n, n] })) }
    const result = parseChart(json(five))
    expect(result.ok).toBe(false)
  })

  it('does not pad a short series with zeroes', () => {
    const result = parseChart(json({ ...BAR, series: [{ label: 'p50', values: [1240] }] }))
    expect(result.ok).toBe(false)
  })

  it('does not coerce a numeric string into a number', () => {
    const result = parseChart(json({ ...BAR, series: [{ label: 'p50', values: ['1240', '980'] }] }))
    expect(result.ok).toBe(false)
  })
})
