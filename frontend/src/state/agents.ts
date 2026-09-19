/**
 * Which agents the Foundry project has, and which of them is answering (spec 019).
 *
 * The hook fetches the listing and holds the choice. It holds nothing else — in particular it does
 * not decide whether a row can be chosen. That depends on which harnesses the build has, which is
 * the BFF's knowledge, and it arrives as `selectable` + `reason`. Re-deriving it here would give
 * the rule two homes and let the screen offer an agent the server then refuses (§4, §5).
 *
 * Selecting is **configuration, not an agent loop** (§8): a person picks who answers. Nothing here
 * reads model output, and nothing switches agents on its own.
 *
 * The choice lives in React state and nowhere else. A reload returns to the BFF's configured agent
 * (AC10). Spec 021 added one way back into a past choice — reopening a stored conversation adopts
 * the agent it was held with — and `adopt` is deliberately not `select`: restoring a conversation
 * is not switching away from one.
 */
import { useCallback, useEffect, useState } from 'react'
import { BFF_URL } from '../config'
import type { AgentRow, AgentsListing, AgentDetail, AgentDetailResponse } from '../types/agents'

export interface AgentsState {
  agents: AgentRow[]
  /** A failure CODE the UI translates, or `null`. Never an empty list standing in for one (AC3). */
  error: string | null
  loading: boolean
  /** The chosen agent, or `null` for the one the BFF is configured with (AC12). */
  selected: string | null
  /** The chosen agent's row, so the header can name the harness that is actually driving it. */
  selectedRow: AgentRow | null
  /** The agent the last selection switched to, so the screen can say so (AC7). */
  switched: string | null
  select: (name: string) => void
  /**
   * Take on an agent without treating it as a switch (spec 021).
   *
   * Reopening a stored conversation restores the agent it was held with. That is not a person
   * changing their mind, so it must not start a new conversation — which is exactly what `select`
   * does, and rightly. Same field, different event.
   */
  adopt: (name: string | null) => void
  clearNotice: () => void
}

export interface AgentsOptions {
  /**
   * Called when the answering agent changes. A Foundry conversation belongs to one agent, so
   * carrying it across would be a state leak — the app starts a new conversation instead (AC7).
   */
  onSwitch: () => void
  bffUrl?: string
}

export function useAgents({ onSwitch, bffUrl = BFF_URL }: AgentsOptions): AgentsState {
  const [listing, setListing] = useState<AgentsListing>({ agents: [], error: null })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [switched, setSwitched] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch(`${bffUrl}/agents`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: AgentsListing) => live && setListing(body))
      // A dead BFF is not a project with no agents. The screen renders the same honest failure it
      // renders for a refused listing, rather than an empty list that reads like an answer (AC3).
      .catch(() => live && setListing({ agents: [], error: 'unavailable' }))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [bffUrl])

  const { agents, error } = listing

  const select = useCallback(
    (name: string) => {
      if (name === selected) return
      // Checked against what the SERVER said about the row. The picker disables these rows, so
      // this is the second line: a listing that changed under the reader must not become a turn
      // the BFF refuses after the message was sent.
      if (!agents.some((agent) => agent.name === name && agent.selectable)) return
      setSelected(name)
      setSwitched(name)
      onSwitch()
    },
    [agents, onSwitch, selected],
  )

  const adopt = useCallback((name: string | null) => {
    setSelected(name)
    setSwitched(null)
  }, [])

  const clearNotice = useCallback(() => setSwitched(null), [])

  const selectedRow = agents.find((agent) => agent.name === selected) ?? null

  return { agents, error, loading, selected, selectedRow, switched, select, adopt, clearNotice }
}

export interface AgentDetailState {
  agent: AgentDetail | null
  /** A failure CODE, translated by the view — never prose from the BFF (§7). */
  error: string | null
  loading: boolean
  /** Adopt an agent the app has just been handed a fresh read of (spec 031, AC7). */
  replace: (agent: AgentDetail) => void
}

/**
 * One agent's definition, read (spec 030).
 *
 * Separate from `useAgents` because it answers a different question about a different scope: the
 * listing is ten cheap rows the rail and the screen both want, and this is one rich row carrying
 * two thousand characters of instructions that nothing else needs.
 *
 * **A read, and only a read.** Nothing here writes, and nothing in the detail view does either —
 * editing an agent is spec 041's, and it stays out of the browser because the definition's source
 * of truth is the repository's YAML (§4).
 *
 * A dead BFF becomes `unavailable`, the same code a refused listing produces, because both are
 * "we could not read it" — and neither may come back as an empty detail that reads like an answer
 * (AC8, and spec 019 AC3's rule).
 */
export function useAgentDetail(name: string | null, bffUrl = BFF_URL): AgentDetailState {
  // What arrived, and which name it arrived for. `loading` is DERIVED from the two rather than
  // stored: setting it inside the effect would start a second render on every name change, and it
  // would also be a second place that has to remember to turn it off.
  const [answered, setAnswered] = useState<{
    name: string | null
    agent: AgentDetail | null
    error: string | null
  }>({ name: null, agent: null, error: null })

  useEffect(() => {
    if (!name) return

    let live = true
    fetch(`${bffUrl}/agents/${encodeURIComponent(name)}`)
      // A 404 carries `unknown_agent` in its body, so the body is read whatever the status: the
      // code is the point, and throwing on the status would replace it with `unavailable`.
      .then((r) => r.json())
      .then(
        (body: AgentDetailResponse) =>
          live && setAnswered({ name, agent: body.agent, error: body.error }),
      )
      .catch(() => live && setAnswered({ name, agent: null, error: 'unavailable' }))

    return () => {
      live = false
    }
  }, [name, bffUrl])

  // Put a freshly-read agent on screen without re-fetching it (spec 031, AC7). A promotion already
  // answered with what the service says *now*; re-reading would be a second request asking a
  // question this app has just been told the answer to.
  const replace = (agent: AgentDetail) => setAnswered({ name: agent.name, agent, error: null })

  if (!name) return { agent: null, error: null, loading: false, replace }
  // A stale answer is not this agent's answer: while the name has moved on, the screen is loading.
  if (answered.name !== name) return { agent: null, error: null, loading: true, replace }

  return { agent: answered.agent, error: answered.error, loading: false, replace }
}
