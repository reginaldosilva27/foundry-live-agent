/**
 * The contract, made watchable (spec 038).
 *
 * Nine event types, closed, with the argument for each written into `contract.py`. A reader can see
 * the effects — a tool row, a reasoning card, a usage figure — and never the events themselves, and
 * reading an SSE body by hand in the browser's network inspector is precisely what this project
 * exists not to require.
 *
 * Pure, because the summarising and the collapsing are the parts worth testing and none of them
 * needs a DOM.
 *
 * **The types are not enumerated here.** The panel's filter comes from `GET /config`'s
 * `event_types`, which comes from `contract.py` — a list in the frontend would be a fourth place
 * the contract is written down (§4).
 */

/** Types that arrive hundreds of times a turn and would drown the list within a second. */
const COLLAPSED = new Set(['text_delta', 'reasoning_summary'])

export interface EventRun {
  /** Arrival position of the first event in this run, counting from 1. */
  at: number
  type: string
  /** How many consecutive events of this type. `1` for everything that is not collapsed. */
  count: number
  /** A one-line summary, or the accumulated text for a collapsed run. */
  summary: string
  /** The raw events, so selecting a row can show exactly what crossed the wire. */
  raw: unknown[]
}

export function typeOf(event: unknown): string {
  const type = (event as { type?: unknown })?.type
  return typeof type === 'string' ? type : 'unknown'
}

/**
 * Group consecutive high-frequency events into runs.
 *
 * Only *consecutive* ones: a `text_delta` run interrupted by a `tool_call` is two runs, because
 * the order is the thing a reader is reading. Collapsing across the interruption would hide the
 * shape of the turn, which is what the panel is for.
 */
export function runsOf(events: readonly unknown[]): EventRun[] {
  const runs: EventRun[] = []

  events.forEach((event, index) => {
    const type = typeOf(event)
    const previous = runs[runs.length - 1]

    if (previous && previous.type === type && COLLAPSED.has(type)) {
      previous.count += 1
      previous.raw.push(event)
      previous.summary += textOf(event)
      return
    }

    runs.push({
      at: index + 1,
      type,
      count: 1,
      summary: COLLAPSED.has(type) ? textOf(event) : summarise(event, type),
      raw: [event],
    })
  })

  return runs
}

/** The accumulated text of a collapsed run — the deltas are the answer, so they are kept. */
function textOf(event: unknown): string {
  const text = (event as { text?: unknown })?.text
  return typeof text === 'string' ? text : ''
}

/**
 * One line about an event.
 *
 * Deliberately shallow. This names the field a reader is looking for — which tool, which call, how
 * many tokens — and leaves everything else to the full payload, which is one click away. A summary
 * that tried to be complete would be the payload again, in a worse format.
 */
function summarise(event: unknown, type: string): string {
  const e = (event ?? {}) as Record<string, unknown>
  switch (type) {
    case 'tool_call':
      return `${str(e.name)} · ${str(e.executor)} · ${str(e.call_id)}`
    case 'tool_result':
      return `${str(e.call_id)}${e.error ? ` · ${str(e.error)}` : ''}`
    case 'mcp_call':
      return `${str(e.server_label)} · ${str(e.name)}`
    case 'usage':
      return `in ${str(e.input_tokens)} · out ${str(e.output_tokens)}`
    case 'trace_ids':
      return `${str(e.response_id)}${e.conversation_id ? ` · ${str(e.conversation_id)}` : ''}`
    case 'error':
      return `${str(e.code)} · ${str(e.message)}`
    default:
      return ''
  }
}

function str(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}
