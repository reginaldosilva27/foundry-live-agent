/**
 * The letters and the tint behind an agent's mark (spec 021).
 *
 * Pure, and in their own module so `Monogram.tsx` exports a component and nothing else — which is
 * what keeps fast refresh working on it.
 */
const TINTS = 4

/** Up to two letters from the name: one per word, or the first two of a single word. */
export function initials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (words.length === 0) return ''
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)
  return letters.toUpperCase()
}

/** Which tint this name gets. A small, stable hash — nothing here needs to be unpredictable. */
export function tintOf(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) % 100_003
  return hash % TINTS
}
