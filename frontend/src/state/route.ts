/**
 * The address scheme (spec 024).
 *
 * Four addresses and one reservation, flat rather than nested. This module is their single source
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
  /** The record this browser kept, and the controls that move it (spec 027). */
  | { name: 'history' }
  /** One agent's definition, as the service reports it (spec 030). The name is Foundry's. */
  | { name: 'agent'; agentName: string }
  /** One question, two agents, two streams (spec 020). Reserved here first, then built. */
  | { name: 'compare' }
  /** What this deployment is, as `GET /config` reports it (spec 032). Read-only, and linkable. */
  | { name: 'about' }
  /** What THIS BROWSER prefers (spec 036). The editable counterpart to `/about`. */
  | { name: 'preferences' }
  /** Run one function tool, outside any conversation (spec 042). */
  | { name: 'tools' }

/** Every route the app can be at, in the order they are documented. */
export const ROUTES = [
  'chat',
  'agents',
  'conversation',
  'trace',
  'history',
  'agent',
  'compare',
  'about',
  'preferences',
  'tools',
] as const

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
    if (segments[0] === 'history') return { name: 'history' }
    if (segments[0] === 'compare') return { name: 'compare' }
    if (segments[0] === 'about') return { name: 'about' }
    if (segments[0] === 'preferences') return { name: 'preferences' }
    if (segments[0] === 'tools') return { name: 'tools' }
  }
  if (segments.length === 2) {
    if (segments[0] === 'agents') return { name: 'agent', agentName: segments[1] }
    if (segments[0] === 'c') return { name: 'conversation', id: segments[1] }
    if (segments[0] === 'trace') return { name: 'trace', responseId: segments[1] }
  }

  return { name: 'chat' }
}

/** Where does this route live? The only place a path is spelled. */
export function buildPath(route: Route): string {
  switch (route.name) {
    case 'agents':
      return '/agents'
    case 'history':
      return '/history'
    case 'agent':
      return `/agents/${encodeURIComponent(route.agentName)}`
    case 'compare':
      return '/compare'
    case 'about':
      return '/about'
    case 'preferences':
      return '/preferences'
    case 'tools':
      return '/tools'
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
