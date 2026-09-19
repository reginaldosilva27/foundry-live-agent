/**
 * The agents this browser keeps to hand (spec 022).
 *
 * A favourite is a **name**, never a row. Storing the row would let the rail show a version, a
 * status or a harness the project has since changed — a second, staler answer to a question
 * `GET /agents` already answers (§4). So the list is resolved against the listing on every render,
 * and `favouriteRows` is where that happens.
 *
 * Starring changes nothing about what this build can drive: the resolved row carries the BFF's own
 * `selectable` and `reason`, exactly as spec 019 sends them.
 */
import { useCallback, useState } from 'react'
import { KEYS, readJson, writeJson } from './storage'
import type { AgentRow } from '../types/agents'

/** Bump the suffix to invalidate. Separate from history and chrome: one clearing, one concern. */
export const FAVOURITES_KEY = KEYS.favourites

/**
 * The favourited agents that the project currently lists, in the listing's order.
 *
 * A name the listing lacks resolves to nothing and is **not** forgotten (AC7). This app cannot tell
 * "deleted" from "not listed right now" — a permission change, a transient failure — so it renders
 * neither, and says neither (§5).
 */
export function favouriteRows(agents: readonly AgentRow[], names: readonly string[]): AgentRow[] {
  return agents.filter((agent) => names.includes(agent.name))
}

export interface FavouritesState {
  names: string[]
  isFavourite: (name: string) => boolean
  toggle: (name: string) => void
}

export function useFavourites(): FavouritesState {
  const [names, setNames] = useState<string[]>(load)

  const toggle = useCallback((name: string) => {
    setNames((previous) => {
      const next = previous.includes(name)
        ? previous.filter((each) => each !== name)
        : [...previous, name]
      // A browser that refuses the write still gets the session it asked for (AC9).
      writeJson(FAVOURITES_KEY, next)
      return next
    })
  }, [])

  return { names, isFavourite: (name) => names.includes(name), toggle }
}

function load(): string[] {
  const stored = readJson<unknown>(FAVOURITES_KEY, [])
  return Array.isArray(stored) ? stored.filter((name) => typeof name === 'string') : []
}
