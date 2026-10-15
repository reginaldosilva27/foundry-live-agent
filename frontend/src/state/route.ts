/**
 * The address scheme (spec 024).
 *
 * A handful of addresses, flat rather than nested. This module is their single source
 * of truth (§4): every link in the app is built through `buildPath`, so the scheme has one
 * definition and `route.test.ts` proves the two halves round-trip.
 *
 * **The URL is an address, not state.** Nothing here reads or writes anything the app needs in
 * order to be correct — Foundry's `conversation_id` still comes from this browser's record, and the
 * answering agent still comes from the agents state. A route that carried either would be the
 * duplication constitution §8 exists to prevent, and it would make a link a way to configure
 * somebody else's app.
 *
 * The trace is keyed on Foundry's `response_id` rather than nested under the conversation that
 * produced it, and that is the load-bearing decision: spans live in the workspace, so a trace link
 * has to open for a reader who has never had the conversation.
 */

export type Route =
  | { name: 'chat' }
  | { name: 'agents' }
  /** A conversation **this browser** kept (spec 021). The id is local; it is not Foundry's. */
  | { name: 'conversation'; id: string }
  | { name: 'trace'; responseId: string }
  /** One agent's definition, as the service reports it (spec 030). The name is Foundry's. */
  | { name: 'agent'; agentName: string }
  /**
   * Try an agent beside its definition, compare it with another, or run one function tool
   * (spec 060). Absorbed spec 020's `/compare` and spec 042's `/tools`.
   */
  | { name: 'playground'; tab: PlaygroundTab }
  /** What this deployment is, as `GET /config` reports it (spec 032). Read-only, and linkable. */
  | { name: 'about' }
  /** What THIS BROWSER prefers (spec 036). The editable counterpart to `/about`. */
  | { name: 'preferences' }

/** Every route the app can be at, in the order they are documented. */
export const ROUTES = [
  'chat',
  'agents',
  'conversation',
  'trace',
  'agent',
  'playground',
  'about',
  'preferences',
] as const

export type PlaygroundTab = 'agent' | 'tools'

/**
 * What address is this?
 *
 * Anything unrecognised is the chat. A 404 screen would be a fifth thing to translate and maintain
 * for a scheme with four addresses, and the app is entirely usable from the chat.
 */
export function parseRoute(pathname: string): Route {
  const segments = pathname.split('/').filter(Boolean).map(decode)

  if (segments.length === 0) return { name: 'chat' }
  if (segments.length === 1) {
    if (segments[0] === 'agents') return { name: 'agents' }
    if (segments[0] === 'playground') return { name: 'playground', tab: 'agent' }
    if (segments[0] === 'about') return { name: 'about' }
    if (segments[0] === 'preferences') return { name: 'preferences' }
    // Retired by spec 060, still read so an old bookmark lands somewhere real. Never built again,
    // so the address bar settles on the canonical form.
    if (segments[0] === 'compare') return { name: 'playground', tab: 'agent' }
    if (segments[0] === 'tools') return { name: 'playground', tab: 'tools' }
  }
  if (segments.length === 2) {
    if (segments[0] === 'agents') return { name: 'agent', agentName: segments[1] }
    if (segments[0] === 'c') return { name: 'conversation', id: segments[1] }
    if (segments[0] === 'trace') return { name: 'trace', responseId: segments[1] }
    if (segments[0] === 'playground' && segments[1] === 'tools') return { name: 'playground', tab: 'tools' }
  }

  return { name: 'chat' }
}

/** Where does this route live? The only place a path is spelled. */
export function buildPath(route: Route): string {
  switch (route.name) {
    case 'agents':
      return '/agents'
    case 'agent':
      return `/agents/${encodeURIComponent(route.agentName)}`
    case 'playground':
      return route.tab === 'tools' ? '/playground/tools' : '/playground'
    case 'about':
      return '/about'
    case 'preferences':
      return '/preferences'
    case 'conversation':
      return `/c/${encodeURIComponent(route.id)}`
    case 'trace':
      return `/trace/${encodeURIComponent(route.responseId)}`
    default:
      return '/'
  }
}

/** A malformed escape is not worth throwing over; the raw segment is the honest fallback. */
function decode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
