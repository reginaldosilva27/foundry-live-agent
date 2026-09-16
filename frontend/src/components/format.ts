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

