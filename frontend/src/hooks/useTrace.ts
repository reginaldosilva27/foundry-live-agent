/**
 * One run's spans, fetched when the reader opens its trace (spec 005).
 *
 * **It does not poll.** Ingestion into Application Insights is staggered — the second leg of a turn
 * can land a minute after the first — so a panel that polled would query the workspace on a timer
 * for every trace anyone left open. The `pending` answer comes with a button instead, which is the
 * reader deciding to look again.
 *
 * `pending` is also not an error. A turn queried ten seconds after it finished legitimately has no
 * spans yet, and rendering that as a failure would teach something false about the platform (§5).
 */
import { useCallback, useEffect, useState } from 'react'
import { BFF_URL } from '../config'
import type { Trace } from '../types/trace'

export interface TraceState {
  /** Absent until the first answer arrives — which the panel renders as "reading the spans". */
  trace?: Trace
  /** Ask again. The answer to `pending`, and to a `failed` that may not repeat. */
  retry: () => void
}

export function useTrace(responseId?: string): TraceState {
  const [trace, setTrace] = useState<Trace | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!responseId) return

    // A reader who steps to another turn before this lands should not see the previous turn's
    // trace arrive under the new one's heading.
    let current = true

    fetch(`${BFF_URL}/trace/${encodeURIComponent(responseId)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`the BFF answered ${response.status}`)
        return response.json() as Promise<Trace>
      })
      .then((body) => current && setTrace(body))
      .catch((cause) => {
        // A dead BFF produces no status of its own, and a trace panel that silently shows nothing
        // is the failure this whole spec exists to stop.
        if (current)
          setTrace({
            status: 'failed',
            spans: [],
            message: cause instanceof Error ? cause.message : String(cause),
          })
      })

    return () => {
      current = false
    }
  }, [responseId, attempt])

  // Derived, not stored: with no run to ask about there is nothing to show, and clearing state
  // from inside the effect would start a second render to say so.
  return { trace: responseId ? trace : undefined, retry }
}
