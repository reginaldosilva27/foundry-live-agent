/**
 * Splitting a streaming answer into blocks that stop changing.
 *
 * A markdown renderer re-parses whatever you hand it. Handing it the whole answer on every token
 * makes the cost of a turn quadratic in its length, and the visible symptom is a caret that
 * stutters near the end of a long answer.
 *
 * Markdown blocks are separated by a blank line, and a block before a blank line can no longer
 * change — so everything up to the last blank line is *settled* and only the tail is live. The
 * component memoises the settled blocks and re-renders the tail alone.
 *
 * The exception is a fenced code block: blank lines inside one are content, not separators, so an
 * open fence suppresses splitting until it closes.
 */
export function splitBlocks(text: string): string[] {
  if (!text) return ['']

  const blocks: string[] = []
  const lines = text.split('\n')
  let current = ''
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isLast = i === lines.length - 1

    if (/^\s*```/.test(line)) inFence = !inFence
    current += isLast ? line : line + '\n'

    if (!isLast && !inFence && line === '' && current.endsWith('\n\n') && current.trim() !== '') {
      blocks.push(current)
      current = ''
    }
  }

  blocks.push(current)
  return blocks
}
