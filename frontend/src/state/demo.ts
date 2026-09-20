/**
 * Which recorded turn this build is replaying (spec 050).
 *
 * **Nothing happens unless the BFF said it is a demo.** `GET /config` carries the key or it does
 * not, and a build that is not a replay makes no request from here at all — asserted, because a
 * production deployment quietly polling an endpoint that does not exist is a 404 on every load and
 * a puzzle in somebody's logs.
 *
 * The choice deliberately does **not** ride on `POST /chat`. That body has three keys and
 * `App.routing.test.tsx` pins them, to keep this browser's own choices out of the state Foundry
 * owns (spec 021, spec 045); a local convenience is not worth spending that pin on.
 */
import { useCallback, useEffect, useState } from 'react'
import { BFF_URL } from '../config'

export interface DemoRecording {
  /** A **code**. What it demonstrates is a sentence, and a sentence lives in `strings.ts` (§7). */
  id: string
  recorded_at: string
}

export interface DemoState {
  recordedAt: string
  current: string
  recordings: DemoRecording[]
  choose: (id: string) => void
}

/** `null` when this build is not a replay — which is every build but one. */
export function useDemo(enabled: boolean): DemoState | null {
  const [state, setState] = useState<Omit<DemoState, 'choose'> | null>(null)

  useEffect(() => {
    if (!enabled) return
    let live = true
    fetch(`${BFF_URL}/demo`)
      .then((response) => response.json())
      .then((body) => {
        if (!live) return
        setState({
          recordedAt: body.recorded_at ?? '',
          current: body.current ?? '',
          recordings: body.recordings ?? [],
        })
      })
      // Silent on purpose: the banner already renders from `GET /config`, which is the fact that
      // matters. Losing the picker is a smaller thing than an error card over a demo.
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [enabled])

  const choose = useCallback((id: string) => {
    // Optimistic, and then corrected by the answer: the BFF is the one that decides, and it refuses
    // an id it does not know rather than accepting it silently.
    setState((current) => (current ? { ...current, current: id } : current))
    void fetch(`${BFF_URL}/demo/recording`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
      .then((response) => response.json())
      .then((body) => setState((now) => (now ? { ...now, current: body.current } : now)))
      .catch(() => undefined)
  }, [])

  return state ? { ...state, choose } : null
}
