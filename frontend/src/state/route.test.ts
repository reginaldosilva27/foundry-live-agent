/**
 * Spec 024 AC1 — the scheme, on its own.
 *
 * The whole router is these two functions. Keeping them pure is what makes the address a
 * *projection*: there is nothing here to fetch, nothing to decide, and no way for a route to become
 * a second home for state Foundry owns (§8).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES, buildPath, parseRoute, type Route } from './route'

describe('parseRoute', () => {
  it('reads the chat', () => {
    expect(parseRoute('/')).toEqual({ name: 'chat' })
  })

  it('reads the agents screen', () => {
    expect(parseRoute('/agents')).toEqual({ name: 'agents' })
  })

  it('reads a stored conversation', () => {
    expect(parseRoute('/c/c_1737000000000')).toEqual({
      name: 'conversation',
      id: 'c_1737000000000',
    })
  })

  it('reads a trace, keyed on the response id Foundry gave it', () => {
    expect(parseRoute('/trace/resp_abc123')).toEqual({ name: 'trace', responseId: 'resp_abc123' })
  })

  it('reads one agent’s detail (spec 030 AC1)', () => {
    expect(parseRoute('/agents/foundry-live-agent')).toEqual({
      name: 'agent',
      agentName: 'foundry-live-agent',
    })
  })

  it('reads the history screen (spec 027 AC6)', () => {
    expect(parseRoute('/history')).toEqual({ name: 'history' })
  })

  it('reads the reserved comparison address', () => {
    expect(parseRoute('/compare')).toEqual({ name: 'compare' })
  })

  it('falls back to the chat for anything it does not recognise', () => {
    expect(parseRoute('/nonsense')).toEqual({ name: 'chat' })
    expect(parseRoute('/c')).toEqual({ name: 'chat' })
    expect(parseRoute('/trace')).toEqual({ name: 'chat' })
    expect(parseRoute('/c/one/two')).toEqual({ name: 'chat' })
  })

  it('tolerates a trailing slash', () => {
    expect(parseRoute('/agents/')).toEqual({ name: 'agents' })
  })

  it('decodes an identifier that was escaped into the path', () => {
    expect(parseRoute(`/trace/${encodeURIComponent('resp/1')}`)).toEqual({
      name: 'trace',
      responseId: 'resp/1',
    })
  })
})

describe('buildPath', () => {
  const every: Route[] = [
    { name: 'chat' },
    { name: 'agents' },
    { name: 'conversation', id: 'c_1' },
    { name: 'trace', responseId: 'resp_1' },
    { name: 'history' },
    { name: 'agent', agentName: 'foundry-live-agent' },
    { name: 'compare' },
  ]

  it('round-trips every route, so the two halves cannot drift', () => {
    for (const route of every) {
      expect(parseRoute(buildPath(route))).toEqual(route)
    }
  })

  it('round-trips an identifier that needs escaping', () => {
    const route: Route = { name: 'trace', responseId: 'resp/1 2' }
    expect(parseRoute(buildPath(route))).toEqual(route)
  })

  it('names every route the app can be at', () => {
    expect(ROUTES).toEqual(every.map((route) => route.name))
  })
})

/**
 * The §4 guard. One module owns the scheme; a component that pushed its own path would be a second
 * definition of it, and the drift would show up as a link that stopped working on one screen only.
 */
describe('the scheme has one home', () => {
  it('is the only place that writes to history', () => {
    const offenders = sources()
      .filter(([path]) => !path.endsWith('hooks/useRoute.ts'))
      .filter(([, text]) => /history\.(push|replace)State/.test(text))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })
})

function sources(): [string, string][] {
  const root = join(import.meta.dirname, '..')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry)
      return statSync(path).isDirectory() ? walk(path) : [path]
    })

  return walk(root)
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => [path.slice(root.length + 1), readFileSync(path, 'utf8')])
}
