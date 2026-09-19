/**
 * A chart the agent wrote, drawn (spec 033).
 *
 * **Hand-drawn SVG, on purpose.** A charting library would be 50–150 kB gzipped for two chart
 * types we fully specify, would bring its own colour defaults to fight, and would render DOM we do
 * not control at exactly the point where "readable without colour" has to be true. Two charts are
 * about a hundred lines of geometry, and writing them is what makes AC8 an assertable property:
 * every fill here is a design-system token this repository validated.
 *
 * **It decides nothing.** It is handed a `ChartSpec` that `parseChart` already accepted, and it has
 * no way to reach the conversation — the fence was found by the Markdown parser, not by a heuristic
 * over the answer (§8, AC9). Swap the harness and the same text draws the same picture.
 *
 * **Colour is never the only channel.** Every series is named in the legend and every mark carries
 * its exact value as an SVG `<title>`, which is both a native tooltip and what a screen reader
 * reads. That is a requirement rather than a nicety: the palette's worst tritan separation is low,
 * and the labels are the secondary encoding that makes it legal.
 *
 * The geometry is a fixed viewBox scaled by CSS, so the chart is crisp at any width without
 * measuring anything — no ResizeObserver, no layout effect, nothing that could loop.
 */
import { useT } from '../i18n/context'
import type { ChartSpec } from '../state/chart'

/** The drawing area, in viewBox units. Scaled by CSS; nothing here is a pixel promise. */
const W = 320
const H = 180
const PAD = { top: 20, right: 8, bottom: 28, left: 34 }
/** Share of a category's slot the bars occupy. The rest is the gap between groups. */
const BAND_FILL = 0.7
const PLOT = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom }

/** The validated categorical order, by token. Fixed — never cycled, never generated. */
const SERIES_TOKEN = (index: number) => `var(--ds-series-${index + 1})`

export function Chart({ spec }: { spec: ChartSpec }) {
  const s = useT()
  const { min, max } = extent(spec)
  const toY = (value: number) => PAD.top + PLOT.h - ((value - min) / (max - min || 1)) * PLOT.h

  const described = spec.title || spec.series.map((series) => series.label).join(', ')

  return (
    <figure className="chart">
      {spec.title && <figcaption className="chart__title">{spec.title}</figcaption>}

      <svg
        className="chart__plot"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={s('chart.described').replace('{what}', described)}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Recessive: the data is the thing, the frame is scaffolding. */}
        <line
          className="chart__axis"
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + PLOT.h}
        />
        <line
          className="chart__axis"
          x1={PAD.left}
          y1={PAD.top + PLOT.h}
          x2={PAD.left + PLOT.w}
          y2={PAD.top + PLOT.h}
        />

        <text className="chart__tick" x={PAD.left - 4} y={toY(max)} textAnchor="end">
          {format(max)}
        </text>
        <text className="chart__tick" x={PAD.left - 4} y={toY(min)} textAnchor="end">
          {format(min)}
        </text>

        {spec.type === 'bar' ? <Bars spec={spec} toY={toY} /> : <Lines spec={spec} toY={toY} />}

        {spec.x.categories.map((category, i) => (
          <text
            key={category}
            className="chart__category"
            x={PAD.left + band(spec, i) + bandWidth(spec) / 2}
            y={H - 12}
            textAnchor="middle"
          >
            {category}
          </text>
        ))}

        {spec.x.label && (
          <text className="chart__axis-label" x={PAD.left + PLOT.w} y={H - 1} textAnchor="end">
            {spec.x.label}
          </text>
        )}
        {/* Above the top tick, not beside it: at `PAD.top - 2` the two collided, which only
            looking at the rendered chart showed. */}
        {spec.y.label && (
          <text className="chart__axis-label" x={0} y={8}>
            {spec.y.label}
          </text>
        )}
      </svg>

      {/* Always rendered, including for one series: AC7 asks every series to carry a text label,
          and the agent may not have written a title for it to borrow. */}
      <ul className="chart__legend" data-testid="chart-legend">
        {spec.series.map((series, i) => (
          <li key={series.label} className="chart__legend-item">
            <span
              className="chart__swatch"
              style={{ background: SERIES_TOKEN(i) }}
              aria-hidden="true"
            />
            {series.label}
          </li>
        ))}
      </ul>
    </figure>
  )
}

function Bars({ spec, toY }: { spec: ChartSpec; toY: (v: number) => number }) {
  const slot = bandWidth(spec)
  // Bars fill part of their slot, not all of it. At full width a single-series chart drew two
  // touching rectangles that read as one solid block — visible only by rendering it and looking.
  const group = slot * BAND_FILL
  const inset = (slot - group) / 2
  // A 2px surface gap between adjacent fills, so two bars never read as one wide one.
  const barWidth = Math.max((group - 2 * (spec.series.length - 1)) / spec.series.length, 1)
  const base = toY(Math.max(0, extent(spec).min))

  return (
    <>
      {spec.series.map((series, si) =>
        series.values.map((value, ci) => {
          const y = toY(value)
          const top = Math.min(y, base)
          return (
            <rect
              key={`${series.label}-${ci}`}
              data-mark="bar"
              x={PAD.left + band(spec, ci) + inset + si * (barWidth + 2)}
              y={top}
              width={barWidth}
              height={Math.max(Math.abs(base - y), 1)}
              rx={2}
              fill={SERIES_TOKEN(si)}
            >
              <title>{`${series.label} · ${spec.x.categories[ci]}: ${value}`}</title>
            </rect>
          )
        }),
      )}
    </>
  )
}

function Lines({ spec, toY }: { spec: ChartSpec; toY: (v: number) => number }) {
  const width = bandWidth(spec)
  const x = (i: number) => PAD.left + band(spec, i) + width / 2

  return (
    <>
      {spec.series.map((series, si) => (
        <polyline
          key={series.label}
          data-mark="line"
          className="chart__line"
          points={series.values.map((v, i) => `${x(i)},${toY(v)}`).join(' ')}
          stroke={SERIES_TOKEN(si)}
        />
      ))}
      {spec.series.map((series, si) =>
        series.values.map((value, ci) => (
          <circle
            key={`${series.label}-${ci}`}
            data-mark="point"
            cx={x(ci)}
            cy={toY(value)}
            r={3}
            fill={SERIES_TOKEN(si)}
          >
            <title>{`${series.label} · ${spec.x.categories[ci]}: ${value}`}</title>
          </circle>
        )),
      )}
    </>
  )
}

/** One slot per category, across the plot. */
function bandWidth(spec: ChartSpec): number {
  return PLOT.w / spec.x.categories.length
}

function band(spec: ChartSpec, index: number): number {
  return bandWidth(spec) * index
}

/**
 * The value range, always including zero for bars.
 *
 * A bar chart whose axis starts at 980 makes a 20% difference look like a tenfold one — the
 * single most misleading thing a chart can do, and not something to leave to whoever wrote the
 * block.
 */
function extent(spec: ChartSpec): { min: number; max: number } {
  const values = spec.series.flatMap((series) => series.values)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (spec.type === 'bar') return { min: Math.min(0, lo), max: Math.max(0, hi) }
  return { min: lo, max: hi }
}

/** Compact, because an axis tick has room for about five characters. */
function format(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${round(value / 1_000_000)}M`
  if (abs >= 1_000) return `${round(value / 1_000)}k`
  return String(round(value))
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
