/**
 * The band: where a turn's time went (spec 029).
 *
 * **A list of buttons, not an SVG.** A segment has to take focus, carry an accessible name and
 * select the call behind it; a `<button>` with a percentage width gets all three from the platform,
 * and an SVG would need every one rebuilt. The band is a bar chart, not a drawing.
 *
 * It draws **one leg**. A turn with a function-call round trip is two OTel traces, one
 * `gen_ai.response.id` each, and the turn holds the id of the leg that produced the answer — so
 * that is the leg with spans. Saying so is `timeline.otherLeg`, and it is the one piece of this
 * component that is prose rather than geometry, because a band that looked like the whole turn
 * would be exactly the §5 failure this spec exists to avoid.
 *
 * **Why the gaps are not explained here.** A function tool *this app* runs leaves no span, so its
 * time can only appear as unattributed — and `SpanTree`, a few rows below in the same section,
 * already says exactly that (`trace.clientSideNote`). Saying it twice in one 320px column would be
 * one fact with two spellings, which is the §4 drift. The legend names the class; the existing note
 * explains it.
 *
 * Spec 015 measured those calls at about a millisecond against seconds of model time, so the
 * hairline gaps between long segments are the finding, not a defect in the picture.
 */
import { formatMs } from './format'
import { useT } from '../i18n/context'
import { layout } from '../state/timeline'
import type { StringKey } from '../i18n/strings'
import type { Span, SpanKind } from '../types/trace'

interface Props {
  spans: readonly Span[]
  /** The turn's stream contained a tool round trip, so there is an earlier leg we cannot draw. */
  hadRoundTrip?: boolean
  onSelectSpan: (spanId: string) => void
}

const LEGEND: { kind: SpanKind | 'gap'; label: StringKey }[] = [
  { kind: 'agent', label: 'timeline.legendRun' },
  { kind: 'model', label: 'timeline.legendModel' },
  { kind: 'tool', label: 'timeline.legendTool' },
  { kind: 'gap', label: 'timeline.legendGap' },
]

/**
 * Below this a segment is invisible at any sensible band width.
 *
 * Only the PAINT is clamped. The layout's fraction and the label's duration stay true, which is
 * what `timeline.test.ts` asserts — a clamp that reached the data would be the app drawing rather
 * than measuring.
 */
const MIN_VISIBLE = 0.004

export function Timeline({ spans, hadRoundTrip, onSelectSpan }: Props) {
  const s = useT()
  const band = layout(spans)
  if (!band) return null

  return (
    <section className="timeline" data-testid="timeline">
      <header className="timeline__head">
        <h3 className="timeline__title">{s('timeline.title')}</h3>
        <p className="timeline__axis-note">{s('timeline.axisNote')}</p>
      </header>

      <div className="timeline__axis" data-testid="timeline-axis">
        <span>0</span>
        <span>{formatMs(Math.round(band.extentMs / 2))}</span>
        <span>{formatMs(Math.round(band.extentMs))}</span>
      </div>

      <div className="timeline__band">
        {band.items.map((item, index) =>
          item.type === 'gap' ? (
            <span
              key={`gap-${index}`}
              className="timeline__item timeline__item--gap"
              data-testid="timeline-gap"
              aria-label={`${s('timeline.legendGap')} — ${formatMs(Math.round(item.durationMs))}`}
              style={style(item.offset, item.width)}
            />
          ) : (
            <button
              key={item.spanId}
              type="button"
              className="timeline__item timeline__item--segment"
              data-kind={item.kind}
              aria-label={`${item.name} — ${formatMs(Math.round(item.durationMs))}`}
              style={style(item.offset, item.width)}
              onClick={() => item.spanId && onSelectSpan(item.spanId)}
            />
          ),
        )}
      </div>

      <ul className="timeline__legend" data-testid="timeline-legend">
        {LEGEND.map(({ kind, label }) => (
          <li key={kind} className="timeline__legend-item">
            <span className="timeline__swatch" data-kind={kind} />
            {s(label)}
          </li>
        ))}
      </ul>

      {hadRoundTrip && <p className="timeline__note">{s('timeline.otherLeg')}</p>}
    </section>
  )
}

function style(offset: number, width: number): React.CSSProperties {
  return { left: `${offset * 100}%`, width: `${Math.max(width, MIN_VISIBLE) * 100}%` }
}
