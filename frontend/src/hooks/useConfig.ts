/** Reads `GET /config` once. The harness badge and the sidebar footer are built from it. */
import { useEffect, useState } from 'react'
import { BFF_URL, type BffConfig } from '../config'

export interface ConfigState {
  config: BffConfig | null
  failed: boolean
}

export function useConfig(): ConfigState {
  const [state, setState] = useState<ConfigState>({ config: null, failed: false })

  useEffect(() => {
    let live = true
    fetch(`${BFF_URL}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((config: BffConfig) => live && setState({ config, failed: false }))
      .catch(() => live && setState({ config: null, failed: true }))
    return () => {
      live = false
    }
  }, [])

  return state
}
