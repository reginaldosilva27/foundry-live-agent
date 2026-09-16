/**
 * History — what this browser remembers about conversations it has already drawn (spec 021).
 *
 * **This is not the conversation.** Foundry owns that, keyed by `conversation_id`, and what lives
 * here is the render cache beside the pointer to it: the frames this browser received and painted,
 * kept so a reload does not throw the drawing away. Three properties keep that on the right side of
 * §8, and each one is a test rather than a promise:
 *
 * - it never travels — the request body stays `message · conversation_id · agent` (AC21);
 * - nothing derives a decision from it: no re-prompt, no replay into the model, no tool chosen;
 * - continuing a restored conversation sends Foundry *its own id* and lets Foundry supply context.
 *
 * The title is taken from the first thing the person typed. Asking a model to name the thread would
 * be this app running inference of its own, which is exactly what §8 exists to stop.
 */
import { useCallback, useState } from 'react'
import type { Message } from '../hooks/useAgentStream'
import { available, readJson, writeJson } from './storage'

/** Bump the suffix to invalidate; never migrate a shape in place. */
export const HISTORY_KEY = 'fla.history.v1'

/** How many conversations a browser keeps. Enough to find yesterday's; small enough to write. */
export const CAP = 25

/** How much of the first question becomes the title. */
const TITLE_MAX = 60

export interface StoredConversation {
  /** Ours — for keys, rename and delete. */
  id: string
  /** Foundry's. The pointer that makes reopening a resumption rather than a screenshot. */
  conversationId?: string
  /** The agent that held it; `null` means the BFF's configured one. */
  agent: string | null
  title: string
  updatedAt: number
  /** The render cache. Never sent anywhere (AC21). */
  messages: Message[]
}

export type AgeGroup = 'today' | 'week' | 'older'

export interface AgeSection {
  group: AgeGroup
  items: StoredConversation[]
}

/** The first thing the person typed, on one line, or the caller's fallback. */
export function titleFrom(text: string, fallback: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  if (!line) return fallback
  return line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX)}…` : line
}

/** Put a conversation at the front, replacing any earlier version of itself, and cap the list. */
export function upsert(
  list: readonly StoredConversation[],
  record: StoredConversation,
  cap = CAP,
): StoredConversation[] {
  return [record, ...list.filter((c) => c.id !== record.id)].slice(0, cap)
}

const DAY = 24 * 60 * 60 * 1000

/** Time sections, in order, with empty ones left out — a heading over nothing says nothing. */
export function groupByAge(list: readonly StoredConversation[], now: number): AgeSection[] {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)

  const of = (at: number): AgeGroup =>
    at >= startOfToday ? 'today' : at >= now - 7 * DAY ? 'week' : 'older'

  return (['today', 'week', 'older'] as const)
    .map((group) => ({ group, items: list.filter((c) => of(c.updatedAt) === group) }))
    .filter((section) => section.items.length > 0)
}

/** Everything this browser stored, minus anything it cannot render (§5 — drop, never half-draw). */
export function load(): StoredConversation[] {
  const raw = readJson<unknown>(HISTORY_KEY, [])
  if (!Array.isArray(raw)) return []
  return raw.filter(isConversation)
}

function isConversation(value: unknown): value is StoredConversation {
  const c = value as Partial<StoredConversation>
  return (
    typeof c?.id === 'string' &&
    typeof c.title === 'string' &&
    typeof c.updatedAt === 'number' &&
    Array.isArray(c.messages)
  )
}

export interface HistoryState {
  conversations: StoredConversation[]
  /** Whether this browser stores at all. `false` is a supported state, not an error (AC20). */
  storing: boolean
  save: (record: StoredConversation) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
}

export function useHistory(): HistoryState {
  const [storing] = useState(available)
  const [conversations, setConversations] = useState<StoredConversation[]>(load)

  const save = useCallback(
    (record: StoredConversation) => setConversations((prev) => persisted(upsert(prev, record))),
    [],
  )

  const rename = useCallback(
    (id: string, title: string) =>
      setConversations((prev) => persisted(prev.map((c) => (c.id === id ? { ...c, title } : c)))),
    [],
  )

  const drop = useCallback(
    (id: string) => setConversations((prev) => persisted(prev.filter((c) => c.id !== id))),
    [],
  )

  return { conversations, storing, save, rename, remove: drop }
}

/**
 * Write, then hand the same list back to React.
 *
 * A failed write is not a failed render: a browser that refuses storage still gets the list it
 * built this session, and the line above the list says it will not survive the reload (AC20).
 */
function persisted(next: StoredConversation[]): StoredConversation[] {
  writeJson(HISTORY_KEY, next)
  return next
}
