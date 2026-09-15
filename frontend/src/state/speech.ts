/**
 * Preparing a streaming answer to be read aloud (spec 008).
 *
 * Two pure functions, and they are where the interesting decisions live:
 *
 * - `nextSentences` cuts the answer at sentence boundaries as it grows, returning each sentence
 *   exactly once. Speaking starts while the answer is still being written, and the cursor is what
 *   stops a sentence from being synthesised twice as more tokens arrive.
 * - `flatten` removes markdown. Backticks, asterisks and link targets are instructions to a reader,
 *   not words; a voice that pronounces them is worse than no voice at all.
 *
 * Sentence cutting is a heuristic in any language — an abbreviation will occasionally split early.
 * That is stated rather than solved: the alternative is a sentence tokeniser per locale.
 */

/** Terminators that end a spoken sentence. A line break counts: lists and headings need it. */
const BOUNDARY = /[.!?\n]/

export interface NextSentences {
  /** Sentences that closed since `from`, in order. */
  sentences: string[]
  /** Where to resume. Pass it back on the next call. */
  cursor: number
}

/**
 * Sentences completed in `text` after character `from`.
 *
 * With `settled`, the turn is over and whatever is left is flushed even without a terminator —
 * otherwise a final sentence with no full stop would never be spoken.
 */
export function nextSentences(
  text: string,
  from: number,
  options: { settled?: boolean } = {},
): NextSentences {
  const sentences: string[] = []
  let cursor = from
  let rest = text.slice(from)

  for (;;) {
    const at = rest.search(BOUNDARY)
    if (at === -1) break

    const sentence = clean(rest.slice(0, at + 1))
    if (sentence) sentences.push(sentence)
    cursor += at + 1
    rest = rest.slice(at + 1)
  }

  if (options.settled) {
    const tail = clean(rest)
    if (tail) sentences.push(tail)
    cursor = text.length
  }

  return { sentences, cursor }
}

/** Markdown as words: syntax removed, the prose kept, whitespace collapsed. */
export function flatten(markdown: string): string {
  return clean(
    markdown
      .replace(/```[\s\S]*?```/g, ' ') // fenced code: not prose
      .replace(/`([^`]*)`/g, '$1') // inline code: the name, not the backticks
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images: the words, not the target
      .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
      .replace(/^\s*[-*+]\s+/gm, '') // list bullets
      .replace(/^\s*>\s?/gm, '') // block quotes
      // Emphasis, only where it is emphasis: `get_current_datetime` keeps its underscores,
      // which matters because tool names are exactly what a reader reads out loud.
      .replace(/(^|[\s(])\*\*([^*]+)\*\*(?=$|[\s).,!?:;])/g, '$1$2')
      .replace(/(^|[\s(])__([^_]+)__(?=$|[\s).,!?:;])/g, '$1$2')
      .replace(/(^|[\s(])\*([^*]+)\*(?=$|[\s).,!?:;])/g, '$1$2')
      .replace(/(^|[\s(])_([^_]+)_(?=$|[\s).,!?:;])/g, '$1$2')
      .replace(/~~([^~]+)~~/g, '$1'),
  )
}

/** Trim and collapse every run of whitespace, line breaks included, into single spaces. */
function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
