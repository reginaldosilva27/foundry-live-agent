/**
 * Spec 022 AC3 · AC7 · AC8 · AC9 — the agents this browser keeps to hand.
 *
 * What is stored is a list of **names**, never rows. A stored row would let the rail show a version,
 * a status or a harness the project has since changed — a second, staler answer to a question
 * `GET /agents` already answers (§4). So every render resolves the names against the listing, and
 * that resolution is the interesting part.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FAVOURITES_KEY, favouriteRows, useFavourites } from './favourites'
import { readJson } from './storage'
import type { AgentRow } from '../types/agents'

function row(name: string, overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    name,
    kind: 'prompt',
    version: '8',
    version_status: 'active',
    model: 'gpt-5.5',
    harness: 'prompt-agent',
    suggestions: [],
    selectable: true,
    reason: '',
    ...overrides,
  }
}

const AGENTS = [
  row('foundry-live-agent'),
  row('foundry-live-agent-hosted', { kind: 'hosted' }),
  row('DatabricksGenie', { kind: 'workflow', selectable: false, reason: 'no_harness' }),
]

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('favouriteRows', () => {
  it('resolves names against the listing, in the listing’s order', () => {
    const rows = favouriteRows(AGENTS, ['foundry-live-agent-hosted', 'foundry-live-agent'])
    expect(rows.map((r) => r.name)).toEqual(['foundry-live-agent', 'foundry-live-agent-hosted'])
  })

  it('carries the listing’s own selectability, so starring cannot make an agent choosable', () => {
    const [genie] = favouriteRows(AGENTS, ['DatabricksGenie'])
    expect(genie.selectable).toBe(false)
    expect(genie.reason).toBe('no_harness')
  })

  it('drops a name the project does not list — the listing is the truth about what exists', () => {
    expect(favouriteRows(AGENTS, ['retired-agent'])).toEqual([])
  })

  it('renders nothing for an empty list', () => {
    expect(favouriteRows(AGENTS, [])).toEqual([])
  })
})

describe('useFavourites', () => {
  it('adds and removes a name', () => {
    const { result } = renderHook(() => useFavourites())

    act(() => result.current.toggle('foundry-live-agent'))
    expect(result.current.names).toEqual(['foundry-live-agent'])
    expect(result.current.isFavourite('foundry-live-agent')).toBe(true)

    act(() => result.current.toggle('foundry-live-agent'))
    expect(result.current.names).toEqual([])
    expect(result.current.isFavourite('foundry-live-agent')).toBe(false)
  })

  it('writes the list where the next mount will read it', () => {
    const first = renderHook(() => useFavourites())
    act(() => first.result.current.toggle('foundry-live-agent'))
    expect(readJson<string[]>(FAVOURITES_KEY, [])).toEqual(['foundry-live-agent'])

    first.unmount()
    const second = renderHook(() => useFavourites())
    expect(second.result.current.names).toEqual(['foundry-live-agent'])
  })

  it('forgets nothing when the project stops listing an agent', () => {
    const { result } = renderHook(() => useFavourites())
    act(() => result.current.toggle('retired-agent'))

    // Nothing renders for it (favouriteRows drops it) and yet the name survives, so it comes back
    // with the agent. "Not listed right now" is not the same fact as "deleted", and this app cannot
    // tell them apart (§5).
    expect(favouriteRows(AGENTS, result.current.names)).toEqual([])
    expect(readJson<string[]>(FAVOURITES_KEY, [])).toEqual(['retired-agent'])
  })

  it('still works for the session in a browser that refuses to store', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    const { result } = renderHook(() => useFavourites())

    act(() => result.current.toggle('foundry-live-agent'))

    expect(result.current.names).toEqual(['foundry-live-agent'])
  })

  it('ignores a stored value that is not a list of names', () => {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify({ not: 'a list' }))
    const { result } = renderHook(() => useFavourites())
    expect(result.current.names).toEqual([])
  })
})
