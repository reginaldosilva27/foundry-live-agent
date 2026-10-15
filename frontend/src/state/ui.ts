/**
 * What this browser remembers about its own chrome (spec 021).
 *
 * Separate key from the history, so clearing conversations does not reset the furniture — and so a
 * quota failure on one cannot take the other with it. This is the only kind of state a browser
 * legitimately keeps on its own: how the reader left the window, not what the agent said.
 */
import { useCallback, useState } from 'react'
import { KEYS, readJson, writeJson } from './storage'

export const UI_KEY = KEYS.ui

interface UiState {
  collapsed?: boolean
  /** How the agents screen lays out its listing (spec 061). Absent means cards. */
  agentsView?: AgentsView
}

export type AgentsView = 'grid' | 'list'

function readUi(): UiState {
  const stored = readJson<unknown>(UI_KEY, {})
  return typeof stored === 'object' && stored !== null ? (stored as UiState) : {}
}

/** One field changes, the others stay: the rail and the agents screen share this key. */
function writeUi(patch: UiState): void {
  writeJson(UI_KEY, { ...readUi(), ...patch })
}

export function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => readUi().collapsed === true)

  const toggle = useCallback(
    () =>
      setCollapsed((previous) => {
        writeUi({ collapsed: !previous })
        return !previous
      }),
    [],
  )

  return [collapsed, toggle]
}

export function useAgentsView(): [AgentsView, (view: AgentsView) => void] {
  const [view, setView] = useState<AgentsView>(() =>
    readUi().agentsView === 'list' ? 'list' : 'grid',
  )

  const choose = useCallback((next: AgentsView) => {
    writeUi({ agentsView: next })
    setView(next)
  }, [])

  return [view, choose]
}
