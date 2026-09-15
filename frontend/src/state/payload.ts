/**
 * A tool payload, formatted for reading (spec 010).
 *
 * Tool output arrives as one line of JSON, which is right for a wire and wrong for a person. This
 * indents it so the structure is visible — and does nothing else.
 *
 * **Best-effort, never lossy.** What does not parse as JSON is returned byte for byte: the reader
 * shows what the tool returned, and a payload reformatted around a guessed shape would be showing
 * something else (constitution §5). A bare scalar is left alone too — indenting `42` produces `42`
 * and pretending otherwise just adds a round trip through the parser.
 */
export function formatPayload(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return text

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return text
  }
}
