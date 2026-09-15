/** Durations, formatted the same way everywhere. Locale-independent: it is a number, not prose. */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/** mm:ss — mono, like every other number on this screen. Locale-independent for the same reason. */
export function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
