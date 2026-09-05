/** Durations, formatted the same way everywhere. Locale-independent: it is a number, not prose. */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}
