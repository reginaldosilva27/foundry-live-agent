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
  collapsed: boolean
}

export function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(
    () => readJson<UiState>(UI_KEY, { collapsed: false }).collapsed === true,
  )

  const toggle = useCallback(
    () =>
      setCollapsed((previous) => {
        writeJson(UI_KEY, { collapsed: !previous })
        return !previous
      }),
    [],
  )

  return [collapsed, toggle]
}
