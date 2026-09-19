/**
 * Where a turn's time went, laid out from spans and nothing else (spec 029).
 *
 * Spec 014 refused to draw a time axis because all it had were durations, and a bar positioned by
 * arrival order is a drawing, not a measurement. Spec 005 connected Application Insights, and a span
 * has a start: `start_ms` is milliseconds after the run's earliest span, computed by the BFF. That
 * is the axis, and this module is the only place it is turned into geometry.
 *
 * **Three rules this module exists to keep:**
 *
 * - **The run is the extent, not a segment.** `invoke_agent` contains every other span, so drawing
 *   it beside its own children would stack the run on top of itself. Its duration becomes the band.
 * - **Unaccounted time is a first-class item.** A gap is returned, not left as background showing
 *   through — so "time nobody accounted for" is data a test can assert, and the picture cannot
 *   drift from it.
 * - **No wall clock.** The turn's `startedAt`/`endedAt` are the browser's clock, on a different
 *   machine, including the network. Laying spans over them would put two clocks on one axis, which
 *   is the drawn-but-not-measured picture spec 014 refused. A test asserts this file never learns
 *   about them.
 *
 * What is *missing* from the band is itself a finding. A function tool **this app** executes leaves
 * no span — Foundry traces what Foundry runs, the §8 boundary showing up in telemetry — so its time
 * appears as unattributed. Spec 015 measured those calls answering in about a millisecond while the
 * model spent the seconds, and a band of long model segments separated by hairline gaps is that
 * measurement, drawn.
 */
import type { Span, SpanKind } from '../types/trace'

export interface BandItem {
  type: 'segment' | 'gap'
  /** Fraction of the band, from its left edge. */
  offset: number
  /** Fraction of the band. The true one — any minimum visible width is the renderer's business. */
  width: number
  durationMs: number
  kind: SpanKind | 'gap'
  name: string
  /** Absent on a gap: nothing was measured to select. */
  spanId?: string
}

export interface Band {
  extentMs: number
  /** Segments and gaps interleaved, in measured order. */
  items: BandItem[]
}

/** The run that contains the others: the span nothing else in this trace is the parent of. */
function rootOf(spans: readonly Span[]): Span | undefined {
  const ids = new Set(spans.map((span) => span.span_id))
  return spans.find((span) => !ids.has(span.parent_id))
}

export function layout(spans: readonly Span[]): Band | undefined {
  const root = rootOf(spans)
  if (!root || root.duration_ms <= 0) return undefined

  const extentMs = root.duration_ms
  const children = spans
    .filter((span) => span.span_id !== root.span_id)
    // Sorted by measured start, never by arrival order (AC9). Application Insights returns rows in
    // query order and a trace can be read back mid-ingestion, so arrival order means nothing.
    .slice()
    .sort((a, b) => a.start_ms - b.start_ms || a.span_id.localeCompare(b.span_id))

  const items: BandItem[] = []
  // How far the children have covered the run so far. It only ever moves forward, so two concurrent
  // calls close one stretch of time between them rather than opening a gap that was never idle.
  let covered = root.start_ms

  for (const child of children) {
    if (child.start_ms > covered) {
      items.push(gap(covered, child.start_ms - covered, root.start_ms, extentMs))
    }
    items.push({
      type: 'segment',
      offset: (child.start_ms - root.start_ms) / extentMs,
      width: child.duration_ms / extentMs,
      durationMs: child.duration_ms,
      kind: child.kind,
      name: child.name,
      spanId: child.span_id,
    })
    covered = Math.max(covered, child.start_ms + child.duration_ms)
  }

  const end = root.start_ms + extentMs
  if (covered < end) items.push(gap(covered, end - covered, root.start_ms, extentMs))

  return { extentMs, items }
}

function gap(startMs: number, durationMs: number, originMs: number, extentMs: number): BandItem {
  return {
    type: 'gap',
    offset: (startMs - originMs) / extentMs,
    width: durationMs / extentMs,
    durationMs,
    kind: 'gap',
    name: '',
  }
}
