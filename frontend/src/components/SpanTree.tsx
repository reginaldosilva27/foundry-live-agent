/**
 * The run, as Foundry timed it (spec 005 AC2, AC13).
 *
 * **This one has a real axis**, which is the whole difference from spec 014's bars. Those took only
 * their *lengths* from `duration_ms` and were given no shared clock, because the event stream
 * carries durations and not offsets. Spans carry both, so these bars can say *when* as well as
 * *how long* — and that is the claim the numbers now support.
 *
 * **The gap is the point.** A run whose tools this app executed shows the model call starting
 * seconds in, with nothing drawn before it, because Foundry has no span for work it did not do.
 * That is constitution §8 rendered as empty space, and empty space reads as a bug unless something
 * says otherwise — hence the note, which is not decoration but AC13.
 */
import { useT } from '../i18n/context'
import { formatMs } from './format'
import type { Span } from '../types/trace'

interface Props {
  spans: Span[]
}

interface Placed extends Span {
  depth: number
}

/**
 * Depth-first order, with each span under the parent it names.
 *
 * A span whose parent is not in the set is a root. That is not a defect: `invoke_agent`'s parent is
 * a span Foundry does not expose, so treating an unknown parent as "top level" is what keeps the
 * run visible at all.
 */
function place(spans: Span[]): Placed[] {
  const ids = new Set(spans.map((span) => span.span_id))
  const children = new Map<string, Span[]>()
  const roots: Span[] = []

  for (const span of spans) {
    const parent = ids.has(span.parent_id) ? span.parent_id : undefined
    if (parent === undefined) roots.push(span)
    else children.set(parent, [...(children.get(parent) ?? []), span])
  }

  const out: Placed[] = []
  const walk = (span: Span, depth: number) => {
    out.push({ ...span, depth })
    for (const child of (children.get(span.span_id) ?? []).sort((a, b) => a.start_ms - b.start_ms)) {
      walk(child, depth + 1)
    }
  }
  for (const root of roots.sort((a, b) => a.start_ms - b.start_ms)) walk(root, 0)
  return out
}

/** Three decimals: at a 9-second run, one percent is 89 ms and rounding visibly moves a bar. */
const percent = (value: number, total: number) =>
  `${total > 0 ? Math.round((value / total) * 100000) / 1000 : 0}%`

export function SpanTree({ spans }: Props) {
  const s = useT()
  if (spans.length === 0) return null

  const placed = place(spans)
  // The axis is the whole run: from the first span's start to the last span's end.
  const total = Math.max(...spans.map((span) => span.start_ms + span.duration_ms))

  return (
    <div className="span-tree" data-testid="span-tree">
      {placed.map((span) => (
        <div
          key={span.span_id}
          className="span-row"
          data-testid="span-row"
          data-depth={span.depth}
          data-kind={span.kind}
        >
          <span className="span-row__name" style={{ paddingLeft: `${span.depth * 10}px` }}>
            {span.name}
          </span>
          <span className="span-row__duration">{formatMs(Math.round(span.duration_ms))}</span>
          <span
            className="span-row__bar"
            data-testid="span-bar"
            aria-hidden="true"
            style={
              {
                '--start': percent(span.start_ms, total),
                '--width': percent(span.duration_ms, total),
              } as React.CSSProperties
            }
          />
        </div>
      ))}
      <p className="span-tree__note">{s('trace.clientSideNote')}</p>
    </div>
  )
}
