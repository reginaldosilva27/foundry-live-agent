/**
 * Where the BFF is.
 *
 * The browser talks to the BFF and to nothing else — never to Foundry, and it holds no Azure
 * credential (constitution, `frontend/README.md`). In development the two are separate origins,
 * which is why `backend/app/main.py` names this one in its CORS allow-list.
 */
import type { Pricing } from './state/cost'

export const BFF_URL: string = import.meta.env.VITE_BFF_URL ?? 'http://localhost:8000'

/** What `GET /config` reports. Mirrors `backend/app/routers/config.py`. */
export interface BffConfig {
  harness: string
  agent_name: string
  agent_version: string | null
  model: string
  uses_gateway: boolean
  /** Whether this BFF can read spans, and whether the gateway writes any (spec 005). */
  tracing?: { enabled: boolean; gateway_logged: boolean }
  /**
   * The declared rate table (spec 028). **Absent when nothing is configured** — which is the
   * out-of-the-box state of this repository, and why the type is optional rather than an empty
   * table. The frontend holds no prices of its own; a test asserts it.
   */
  pricing?: Pricing
  /**
   * Whether this deployment may roll an agent back to an earlier version (spec 031).
   *
   * Optional because a BFF older than spec 031 does not send it, and absent must read as **no**:
   * the one setting in this app that changes what other people's turns get defaults to off, and a
   * control the server would refuse must never render (AC9).
   */
  agents?: { can_promote: boolean }
  project_name: string
  speech: {
    enabled: boolean
  }
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
