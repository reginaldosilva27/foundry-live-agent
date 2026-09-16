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
 * (AC10), which matches the session list beside it — also not persisted, and honest about it.
 */
import { useCallback, useEffect, useState } from 'react'
import { BFF_URL } from '../config'
import type { AgentRow, AgentsListing } from '../types/agents'

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

  const clearNotice = useCallback(() => setSwitched(null), [])

  const selectedRow = agents.find((agent) => agent.name === selected) ?? null

  return { agents, error, loading, selected, selectedRow, switched, select, clearNotice }
}
