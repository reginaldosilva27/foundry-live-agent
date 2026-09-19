/**
 * Going back to a version (spec 031) — **the only request this browser makes that changes state.**
 *
 * Everything else this app persists is local: the conversation history, the favourites, the rail's
 * collapsed flag. This one reaches Foundry and changes what the project serves for *everyone*, and
 * two rules follow from that.
 *
 * **It is read back, never assumed.** `promote` resolves with the agent the BFF answered, which the
 * BFF got from a fresh read after the write. Returning the version that was requested would make a
 * promotion that silently failed look exactly like one that worked (AC7).
 *
 * **One at a time.** A second call while one is in flight is dropped rather than queued. The button
 * is disabled too, but a disabled button is a rendering detail and this is the rule (AC6).
 *
 * Not an agent loop (§8): a person chose a version, and nothing here reads model output or decides
 * anything on its own.
 */
import { useCallback, useRef, useState } from 'react'
import { BFF_URL } from '../config'
import type { AgentDetail, AgentDetailResponse } from '../types/agents'

export interface PromoteState {
  /** Resolves with the freshly-read agent, or `null` when the promotion failed. */
  promote: (name: string, version: string) => Promise<AgentDetail | null>
  /** The version currently being promoted, or `null`. */
  promoting: string | null
  /** A failure CODE the UI translates, or `null`. Never prose (§7). */
  error: string | null
}

export function usePromote({ bffUrl = BFF_URL }: { bffUrl?: string } = {}): PromoteState {
  const [promoting, setPromoting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // A ref, not the state: two clicks in the same tick would both read a stale `promoting`.
  const inFlight = useRef(false)

  const promote = useCallback(
    async (name: string, version: string): Promise<AgentDetail | null> => {
      if (inFlight.current) return null
      inFlight.current = true
      setPromoting(version)
      setError(null)

      try {
        const url = `${bffUrl}/agents/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}/promote`
        // No body. There is nothing to send — the agent and the version are in the path, and that
        // is what keeps this from ever becoming a way to author an agent (AC14).
        const response = await fetch(url, { method: 'POST' })
        // The BODY decides, not `response.ok`: a 403 carrying `forbidden` and a 502 carrying
        // `unavailable` are different facts the screen renders differently (§5).
        const body = (await response.json()) as AgentDetailResponse
        if (body.agent) return body.agent
        setError(body.error ?? 'unavailable')
        return null
      } catch {
        setError('unavailable')
        return null
      } finally {
        inFlight.current = false
        setPromoting(null)
      }
    },
    [bffUrl],
  )

  return { promote, promoting, error }
}
