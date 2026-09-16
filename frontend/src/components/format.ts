/** Durations, formatted the same way everywhere. Locale-independent: it is a number, not prose. */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/** mm:ss — mono, like every other number on this screen. Locale-independent for the same reason. */
export function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * The model half of a `<connection>/<model>` deployment name; a plain name is returned as is.
 *
 * A BYOM deployment is named after the connection it routes through, and the connection is usually
 * the project again — so the raw name is the project id twice over, which wraps to four lines in a
 * 320px column and tells a reader nothing. Whether the connection routes through the gateway is the
 * part worth showing, and the sidebar says that in words.
 */
export function modelName(model?: string): string {
  if (!model) return ''
  return model.slice(model.lastIndexOf('/') + 1)
}

/**
 * What a call asked for, in one value — the part that distinguishes two calls to the same tool.
 *
 * The rule is generic on purpose: parse the arguments and take the first string. It covers every
 * tool we have (`query`, `timezone`, `url`) and the one nobody has written yet, and it keeps the
 * frontend from growing a second opinion about the tools, whose definitions live in
 * `ai/harness/_shared/tools/` (§4).
 *
 * It never throws. Arguments arrive as a raw JSON *string* that is still being assembled while the
 * call streams, so half an object is a normal thing to be handed, not an error — and a row with an
 * empty cell is worth more than a turn that fails to render.
 */
export function callSubject(args: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(args)
  } catch {
    return ''
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return ''
  for (const value of Object.values(parsed)) {
    if (typeof value === 'string' && value) return value
  }
  return ''
}
