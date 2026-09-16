/**
 * Seconds since `key` last changed — a stopwatch for the live status line (spec 015).
 *
 * This is the one number on a turn that the event stream did not supply. Events carry no
 * timestamps, so elapsed time is a fact about *our observation*, and keeping it here is what lets
 * `state/turn.ts` stay a pure function of the log: nothing the agent is credited with saying comes
 * from a clock.
 *
 * `null` means there is nothing to time — the turn settled, or the answer took over — and then no
 * interval runs at all.
 */
import { useEffect, useState } from 'react'

export function useElapsed(key: string | null): number {
  // The key is held in state beside the count so a new state resets it *during* the render that
  // brought it, not in an effect afterwards: an effect would paint the previous state's seconds
  // once before correcting itself.
  const [timing, setTiming] = useState({ key, seconds: 0 })
  if (timing.key !== key) setTiming({ key, seconds: 0 })

  useEffect(() => {
    if (key === null) return

    const started = Date.now()
    // Wall clock rather than a counter: a backgrounded tab throttles intervals, and a counter would
    // quietly under-report the wait it exists to report.
    const id = setInterval(
      () => setTiming({ key, seconds: Math.floor((Date.now() - started) / 1000) }),
      1000,
    )
    return () => clearInterval(id)
  }, [key])

  return timing.key === key ? timing.seconds : 0
}
