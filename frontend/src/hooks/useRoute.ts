/**
 * Where the app is, as an address (spec 024).
 *
 * Hand-rolled on purpose. The scheme is four addresses with one parameter each and no nesting;
 * a router library would be twenty kilobytes for a `switch`, and its loader API would invite
 * exactly the thing this scheme must not become — a second way to fetch. Everything the app needs
 * in order to be correct still comes from where it came from before: Foundry's `conversation_id`
 * from this browser's record, the answering agent from the agents state (§8).
 *
 * History API rather than hash, so the URLs are the ones that end up in documentation. The price is
 * a requirement on whatever eventually hosts this — serve `index.html` for unknown paths — recorded
 * in `infra/README.md` rather than guessed at in Bicep that nobody can verify (§5).
 */
import { useCallback, useEffect, useState } from 'react'
import { buildPath, parseRoute, type Route } from '../state/route'

export interface Routing {
  route: Route
  /** Go somewhere. `replace` swaps the current entry instead of adding one. */
  navigate: (route: Route, options?: { replace?: boolean }) => void
}

export function useRoute(): Routing {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname))

  // Back and Forward. `pushState` does not fire `popstate` — in the browser or in jsdom — so this
  // hears the reader's navigation and nothing the app did itself.
  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback<Routing['navigate']>((next, { replace = false } = {}) => {
    const path = buildPath(next)
    if (path !== window.location.pathname) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
    }
    setRoute(next)
  }, [])

  return { route, navigate }
}
