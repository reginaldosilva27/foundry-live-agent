/**
 * Turning a `fetch` response body into events.
 *
 * `EventSource` cannot be used here: it is GET-only and `/chat` is a POST, so the client reads the
 * response body itself. That means owning the framing — which is three rules deep:
 *
 * 1. Records are separated by a blank line.
 * 2. The payload is on a `data: ` line.
 * 3. A chunk boundary can fall anywhere, including mid-record, so the tail must be buffered.
 *
 * The BFF encodes every payload as single-line JSON precisely so rule 1 can never be tripped by
 * content — see `backend/app/sse.py`.
 */

/**
 * Create a stateful parser. Feed it decoded chunks; it returns the events completed by each one.
 *
 * A frame whose payload will not parse is dropped rather than thrown: one malformed record should
 * cost the frame it arrived in, not the rest of the turn.
 */
export function createFrameParser(): (chunk: string) => unknown[] {
  let buffer = ''

  return (chunk: string): unknown[] => {
    buffer += chunk
    const events: unknown[] = []

    let split = buffer.indexOf('\n\n')
    while (split !== -1) {
      const frame = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          events.push(JSON.parse(line.slice(6)))
        } catch {
          // Malformed payload. Dropping the frame keeps the stream readable.
        }
      }
      split = buffer.indexOf('\n\n')
    }

    return events
  }
}
