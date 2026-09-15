/**
 * Where the BFF is.
 *
 * The browser talks to the BFF and to nothing else — never to Foundry, and it holds no Azure
 * credential (constitution, `frontend/README.md`). In development the two are separate origins,
 * which is why `backend/app/main.py` names this one in its CORS allow-list.
 */
export const BFF_URL: string = import.meta.env.VITE_BFF_URL ?? 'http://localhost:8000'

/** What `GET /config` reports. Mirrors `backend/app/routers/config.py`. */
export interface BffConfig {
  harness: string
  agent_name: string
  agent_version: string | null
  model: string
  uses_gateway: boolean
  project_name: string
  voice: {
    enabled: boolean
    webrtc_api_version: string
  }
  event_types: string[]
  event_mapping: {
    total: number
    verified: number
    unverified: string[]
    note: string
  }
}
