/**
 * The language a fence declared (spec 035).
 *
 * Its own module so `CodeBlock.tsx` exports components and nothing else. `language-python` becomes
 * `python`; a fence that declared nothing yields the empty string, and the header renders nothing
 * rather than guessing a language — an undetected one is a fact about the block.
 */
export function languageOf(className: string | undefined): string {
  const match = (className ?? '').split(/\s+/).find((c) => c.startsWith('language-'))
  return match ? match.slice('language-'.length) : ''
}
