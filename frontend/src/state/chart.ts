/**
 * The chart block's schema (spec 033).
 *
 * An agent writes a fenced `foundry-chart` block and this reads it. That is the whole design, and
 * it is what keeps the feature inside constitution §8: the app never decides to draw a chart, it
 * renders text the agent wrote, exactly as it renders the Markdown around it. Any harness emitting
 * the same text produces the same picture.
 *
 * **A parser with named failures, not a validator returning true.** A reader whose block did not
 * draw is debugging their agent's instructions, and "invalid" tells them nothing; `length_mismatch`
 * tells them what to fix. The codes are translated by the view — nothing here is prose (§7).
 *
 * **It repairs nothing.** A series one value short is a failure, not a chart with a gap. A fifth
 * series is a failure, not four series and a silent omission. Both would be this app deciding what
 * the data meant, which is the §5 line, and the second is also why the cap exists at all: the
 * palette was validated for four hues and no fifth passed.
 *
 * Pure, so the same function that guards the renderer also checks the examples in
 * `ai/harness/_shared/agent_core.yaml` in CI — one contract, tested from both ends (§4, AC10).
 */

/** The closed set. Adding one is a spec, a renderer and a validated hue — never a quiet edit. */
export const CHART_TYPES = ['bar', 'line'] as const
export type ChartType = (typeof CHART_TYPES)[number]

/** The palette was validated for four series, all pairs. See `specs/033-.../plan.md`. */
export const MAX_SERIES = 4

export interface ChartSeries {
  label: string
  values: number[]
}

export interface ChartSpec {
  type: ChartType
  title: string
  x: { label: string; categories: string[] }
  y: { label: string }
  series: ChartSeries[]
}

/** Why a block did not draw. A CODE the view translates, never a sentence (§7). */
export type ChartFailure =
  | 'bad_json'
  | 'unknown_type'
  | 'no_categories'
  | 'no_series'
  | 'too_many_series'
  | 'length_mismatch'
  | 'bad_value'
  | 'missing_label'

export type ChartResult = { ok: true; spec: ChartSpec } | { ok: false; reason: ChartFailure }

export function parseChart(source: string): ChartResult {
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    return fail('bad_json')
  }
  if (!isObject(raw)) return fail('bad_json')

  const type = raw.type
  if (typeof type !== 'string' || !CHART_TYPES.includes(type as ChartType)) {
    return fail('unknown_type')
  }

  const x = isObject(raw.x) ? raw.x : {}
  const categories = Array.isArray(x.categories) ? x.categories : []
  if (categories.length === 0 || !categories.every((c) => typeof c === 'string')) {
    return fail('no_categories')
  }

  const rawSeries = Array.isArray(raw.series) ? raw.series : []
  if (rawSeries.length === 0) return fail('no_series')
  // Checked BEFORE the per-series rules so a block with five bad series reports the fact that
  // matters — the reader has to cut one either way.
  if (rawSeries.length > MAX_SERIES) return fail('too_many_series')

  const series: ChartSeries[] = []
  for (const entry of rawSeries) {
    if (!isObject(entry)) return fail('missing_label')

    const label = entry.label
    if (typeof label !== 'string' || label.trim() === '') return fail('missing_label')

    const values = entry.values
    if (!Array.isArray(values)) return fail('bad_value')
    if (values.length !== categories.length) return fail('length_mismatch')
    // `typeof NaN === 'number'`, and a NaN would render as a mark at no height — which is a chart
    // with a gap, the thing §5 forbids. So the check is finiteness, not type.
    if (!values.every((v) => typeof v === 'number' && Number.isFinite(v))) return fail('bad_value')

    series.push({ label, values })
  }

  return {
    ok: true,
    spec: {
      type: type as ChartType,
      title: typeof raw.title === 'string' ? raw.title : '',
      x: { label: typeof x.label === 'string' ? x.label : '', categories: categories as string[] },
      y: { label: isObject(raw.y) && typeof raw.y.label === 'string' ? raw.y.label : '' },
      series,
    },
  }
}

function fail(reason: ChartFailure): ChartResult {
  return { ok: false, reason }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
