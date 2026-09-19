/**
 * Spec 029 — where a turn's time actually went.
 *
 * Every number here comes from a span's own `start_ms`/`duration_ms`. The tests are mostly about
 * what the layout must NOT do: derive a position from arrival order, stretch a neighbour over a
 * gap, or borrow the browser's clock. Spec 014 refused to draw a time axis from durations alone,
 * and this is the file that keeps that refusal true now that there is an axis to draw.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { layout } from './timeline'
import type { Span } from '../types/trace'

function span(over: Partial<Span> = {}): Span {
  return {
    name: 'chat gpt-5.5',
    span_id: 's1',
    parent_id: 'root',
    duration_ms: 100,
    start_ms: 0,
    kind: 'model',
    ...over,
  }
}

const ROOT = span({
  name: 'invoke_agent foundry-live-agent:8',
  span_id: 'root',
  parent_id: 'outside',
  kind: 'agent',
  start_ms: 0,
  duration_ms: 1000,
})

describe('layout', () => {
  it('makes the run the extent, and its descendants the segments (AC1)', () => {
    const band = layout([ROOT, span({ span_id: 'a', start_ms: 0, duration_ms: 400 })])

    expect(band?.extentMs).toBe(1000)
    expect(band?.items.filter((i) => i.type === 'segment')).toHaveLength(1)
  })

  it('positions and sizes each segment from its own timestamps (AC2)', () => {
    const band = layout([ROOT, span({ span_id: 'a', start_ms: 250, duration_ms: 500 })])
    const segment = band?.items.find((i) => i.type === 'segment')

    expect(segment?.offset).toBeCloseTo(0.25, 10)
    expect(segment?.width).toBeCloseTo(0.5, 10)
    expect(segment?.durationMs).toBe(500)
  })

  it('lays spans out identically whatever order they arrive in (AC9)', () => {
    const a = span({ span_id: 'a', start_ms: 0, duration_ms: 200 })
    const b = span({ span_id: 'b', start_ms: 500, duration_ms: 200, kind: 'tool' })

    const ordered = layout([ROOT, a, b])
    const shuffled = layout([b, ROOT, a])

    expect(shuffled).toEqual(ordered)
  })

  it('returns the time no child covered as a gap, not as a stretched neighbour (AC5)', () => {
    const band = layout([
      ROOT,
      span({ span_id: 'a', start_ms: 0, duration_ms: 300 }),
      span({ span_id: 'b', start_ms: 700, duration_ms: 300 }),
    ])

    const gaps = band?.items.filter((i) => i.type === 'gap') ?? []
    expect(gaps).toHaveLength(1)
    expect(gaps[0].offset).toBeCloseTo(0.3, 10)
    expect(gaps[0].width).toBeCloseTo(0.4, 10)
    expect(gaps[0].durationMs).toBe(400)

    // The neighbours kept their own measured widths.
    const segments = band?.items.filter((i) => i.type === 'segment') ?? []
    expect(segments.map((s) => s.durationMs)).toEqual([300, 300])
  })

  it('reports no gap when the children cover the run', () => {
    const band = layout([
      ROOT,
      span({ span_id: 'a', start_ms: 0, duration_ms: 500 }),
      span({ span_id: 'b', start_ms: 500, duration_ms: 500 }),
    ])

    expect(band?.items.filter((i) => i.type === 'gap')).toEqual([])
  })

  it('treats overlapping children as covered, rather than inventing a gap between them', () => {
    // Concurrent calls are normal; a gap must mean "nobody accounted for this", not "these two
    // ran at the same time".
    const band = layout([
      ROOT,
      span({ span_id: 'a', start_ms: 0, duration_ms: 800 }),
      span({ span_id: 'b', start_ms: 200, duration_ms: 800 }),
    ])

    expect(band?.items.filter((i) => i.type === 'gap')).toEqual([])
  })

  it('carries the kind, so the band can colour and name it (AC3)', () => {
    const band = layout([
      ROOT,
      span({ span_id: 'a', kind: 'model' }),
      span({ span_id: 'b', kind: 'tool', start_ms: 200, name: 'execute_tool learn.search' }),
    ])

    const kinds = band?.items.filter((i) => i.type === 'segment').map((i) => i.kind)
    expect(kinds).toEqual(['model', 'tool'])
  })

  it('keeps the span id, so selecting a segment can reach its call (AC8)', () => {
    const band = layout([ROOT, span({ span_id: 'abc' })])
    expect(band?.items.find((i) => i.type === 'segment')?.spanId).toBe('abc')
  })

  it('has nothing to draw with no spans at all', () => {
    expect(layout([])).toBeUndefined()
  })

  it('roots the band at the span whose parent is outside the store', () => {
    // Recorded 2026-09-16: `invoke_agent`'s `operation_ParentId` names a span the project cannot
    // read, so "the root" means "the topmost span we were given", not a name we match on.
    const band = layout([span({ span_id: 'a', parent_id: 'not-in-this-trace', duration_ms: 100 })])

    expect(band?.extentMs).toBe(100)
  })

  it('has nothing to draw for a run of no duration, rather than dividing by zero', () => {
    expect(layout([{ ...ROOT, duration_ms: 0 }])).toBeUndefined()
  })

  it('draws a run whose only span is itself, with the whole of it unattributed', () => {
    const band = layout([ROOT])

    expect(band?.items).toHaveLength(1)
    expect(band?.items[0].type).toBe('gap')
    expect(band?.items[0].durationMs).toBe(1000)
  })
})

/** AC11 — the axis is the spans' clock. The browser's is a different machine's. */
describe('the band borrows no wall clock', () => {
  it('takes spans and nothing else', () => {
    expect(layout.length).toBe(1)
  })

  it('never mentions the turn timestamps in its source', () => {
    const text = readFileSync(join(import.meta.dirname, 'timeline.ts'), 'utf8')
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

    expect(code).not.toMatch(/\b(startedAt|endedAt|latencyMs|Date\.now)\b/)
  })
})
