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
import { useCallback, useRef, useState } from 'react'
import type { Message } from '../hooks/useAgentStream'
import { fold } from './fold'
import { KEYS, available, readJson, remove as removeKey, writeJson } from './storage'

/** Bump the suffix to invalidate; never migrate a shape in place. */
export const HISTORY_KEY = KEYS.history

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

/**
 * Where a query was found. The row labels the fragment with it, so a hit reading `search_web`
 * is not mistaken for something the person typed (spec 027 AC2).
 */
export type MatchField = 'title' | 'message' | 'tool' | 'mcp'

export interface SearchHit {
  conversation: StoredConversation
  /** Absent when nothing was searched for — that is the unfiltered list (AC3). */
  match?: { field: MatchField; fragment: string }
}

/** How much of a matched line the rail shows around the needle. */
const FRAGMENT_PAD = 32

/**
 * The conversations that match, each with the one thing that matched (spec 027).
 *
 * **What is searched is the index, not the archive.** Titles, what either role said, and the *names*
 * of the tools and MCP servers the turn used — because "which conversation called `search_web`?" is
 * the question a reader of this repository actually has. Arguments and outputs are deliberately out:
 * a hit inside a JSON blob renders as an unreadable fragment, and in a 248px rail that is noise
 * rather than an index.
 *
 * It reads storage and nothing else. No request is made, here or anywhere below it (AC4) — what
 * Foundry holds is Foundry's, and searching it would be this app duplicating state the service owns.
 *
 * First match wins, in the order the fields are listed: one row, one fragment.
 */
export function searchConversations(
  list: readonly StoredConversation[],
  query: string,
): SearchHit[] {
  const needle = fold(query)
  if (!needle) return list.map((conversation) => ({ conversation }))

  return list.flatMap((conversation) => {
    const match = firstMatch(conversation, needle)
    return match ? [{ conversation, match }] : []
  })
}

function firstMatch(
  conversation: StoredConversation,
  needle: string,
): { field: MatchField; fragment: string } | undefined {
  if (fold(conversation.title).includes(needle)) {
    return { field: 'title', fragment: conversation.title }
  }

  for (const message of conversation.messages) {
    const text = message.role === 'user' ? message.text : message.role === 'agent' ? message.turn.text : ''
    if (text && fold(text).includes(needle)) {
      return { field: 'message', fragment: excerpt(text, needle) }
    }
  }

  for (const message of conversation.messages) {
    if (message.role !== 'agent') continue
    for (const activity of message.turn.activities) {
      if (activity.kind === 'mcp' && fold(activity.serverLabel).includes(needle)) {
        return { field: 'mcp', fragment: activity.serverLabel }
      }
      if (fold(activity.name).includes(needle)) {
        return { field: activity.kind === 'mcp' ? 'mcp' : 'tool', fragment: activity.name }
      }
    }
  }

  return undefined
}

/**
 * A window around the needle, on one line.
 *
 * Folded and raw are indexed together on purpose: `fold` only strips combining marks and lowercases,
 * neither of which changes the length, so an offset found in the folded string is the offset in the
 * original. A folding that changed length would break this, and that is why the rule lives in one
 * module rather than being re-invented per caller.
 */
function excerpt(text: string, needle: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  const at = fold(line).indexOf(needle)
  if (at < 0) return line.slice(0, FRAGMENT_PAD * 2)

  const start = Math.max(0, at - FRAGMENT_PAD)
  const end = Math.min(line.length, at + needle.length + FRAGMENT_PAD)
  return `${start > 0 ? '…' : ''}${line.slice(start, end)}${end < line.length ? '…' : ''}`
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

/**
 * The version of the **file**, not of the stored key.
 *
 * `HISTORY_KEY`'s suffix invalidates a browser's own storage; this one travels. A file people keep
 * on disk outlives the build that wrote it, so a later record shape must be able to look at an
 * older file and know what it is holding — or refuse it whole (AC12).
 */
export const RECORD_VERSION = 1

export interface ExportFile {
  version: number
  exportedAt: number
  conversations: StoredConversation[]
}

/**
 * The whole record, as a file (spec 027 AC8).
 *
 * The stored shape verbatim: the messages, the pointer, the agent, and the trace identifiers each
 * turn already carries. Nothing is stripped, because the identifiers are what tie a transcript back
 * to spans in the workspace — the point of a teaching repository — and a `response_id` is inert
 * without access to that workspace.
 *
 * `exportedAt` is passed in rather than read here: a pure function is one a test can pin.
 */
export function toExportFile(list: readonly StoredConversation[], exportedAt: number): ExportFile {
  return { version: RECORD_VERSION, exportedAt, conversations: [...list] }
}

/**
 * A file, if this build can read it — otherwise `null`, and the caller says so (AC12).
 *
 * Refusing a version it does not know is the honest answer: reading half of an unknown shape is the
 * silent half-draw §5 rules out. Within a version it does know, a single unreadable conversation is
 * dropped and the rest are kept — the same rule `load` already applies to this browser's own key.
 */
export function parseExportFile(raw: string): StoredConversation[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const file = parsed as Partial<ExportFile> | null
  if (!file || typeof file !== 'object' || Array.isArray(file)) return null
  if (file.version !== RECORD_VERSION) return null
  if (!Array.isArray(file.conversations)) return null

  return file.conversations.filter(isConversation)
}

export interface MergeResult {
  conversations: StoredConversation[]
  /** How many of the file's conversations this browser now holds. */
  kept: number
  /** How many it could not, because the record holds `cap` (AC11). */
  dropped: number
}

/**
 * Put a file's conversations beside the ones already here (spec 027 AC10, AC11).
 *
 * Merged by **our** id, so importing the same file twice leaves one of each. A stored conversation
 * always wins over its imported twin: what this browser drew is what this browser drew, and
 * overwriting it with an older copy of itself would lose turns.
 *
 * Past the cap the newest survive, and the count of what did not is returned rather than swallowed.
 * Silently discarding somebody's transcripts is exactly what §5 is about.
 */
export function mergeImported(
  stored: readonly StoredConversation[],
  incoming: readonly StoredConversation[],
  cap = CAP,
): MergeResult {
  const known = new Set(stored.map((c) => c.id))
  const fresh = incoming.filter((c) => !known.has(c.id))
  const merged = [...stored, ...fresh].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, cap)
  const survivors = new Set(merged.map((c) => c.id))
  const kept = fresh.filter((c) => survivors.has(c.id)).length

  return { conversations: merged, kept, dropped: fresh.length - kept }
}

export interface HistoryState {
  conversations: StoredConversation[]
  /** Whether this browser stores at all. `false` is a supported state, not an error (AC20). */
  storing: boolean
  save: (record: StoredConversation) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  /** Drop the whole record, key and all (spec 027 AC13). The screen asks first; this does not. */
  clear: () => void
  /** Put a file's conversations beside these, reporting what would not fit (spec 027 AC11). */
  importFile: (raw: string) => { kept: number; dropped: number } | null
}

export function useHistory(): HistoryState {
  const [probed] = useState(available)
  const [conversations, setConversations] = useState<StoredConversation[]>(load)
  /**
   * Latched the first time a write is refused (AC20).
   *
   * `available()` is a one-byte probe, and a browser at its quota still takes one byte — so the
   * probe alone kept answering yes while the real write, twenty-five conversations of transcript,
   * was being turned away. The reader was told their history was kept when it was not.
   *
   * A ref rather than state because it is set inside the updaters below, which React runs while it
   * renders: calling a setter there is not allowed, and this is the one case a ref written during
   * render is safe: it only ever turns from false to true, so running twice under StrictMode says
   * the same thing. The `setConversations` that carries it is the render that reads it.
   */
  const refused = useRef(false)

  const persisted = useCallback((next: StoredConversation[]): StoredConversation[] => {
    if (!writeJson(HISTORY_KEY, next)) refused.current = true
    return next
  }, [])

  const save = useCallback(
    (record: StoredConversation) => setConversations((prev) => persisted(upsert(prev, record))),
    [persisted],
  )

  const rename = useCallback(
    (id: string, title: string) =>
      setConversations((prev) => persisted(prev.map((c) => (c.id === id ? { ...c, title } : c)))),
    [persisted],
  )

  const drop = useCallback(
    (id: string) => setConversations((prev) => persisted(prev.filter((c) => c.id !== id))),
    [persisted],
  )

  /**
   * Removing the key rather than writing `[]` is the difference between "this browser kept nothing"
   * and "this browser kept an empty list", and only the first is true after a clear.
   */
  const clear = useCallback(() => {
    removeKey(HISTORY_KEY)
    // Whatever would not fit is gone, so the browser is not refusing any more. Leaving the latch
    // set would keep telling the reader nothing is kept while the next write goes through fine.
    refused.current = false
    setConversations([])
  }, [])

  /**
   * Read a file into the record, or refuse it whole (AC12).
   *
   * `null` means the file was not a record and **nothing changed** — the caller says so. The numbers
   * are returned rather than rendered here: what this owns is the record, not the sentence about it.
   */
  const importFile = useCallback(
    (raw: string) => {
      const incoming = parseExportFile(raw)
      if (!incoming) return null

      // Merged against the current list rather than inside a `setState` updater, which React runs
      // when it renders and not when this is called — a report built in there would be returned
      // before it was filled in.
      const merged = mergeImported(conversations, incoming)
      setConversations(persisted(merged.conversations))
      return { kept: merged.kept, dropped: merged.dropped }
    },
    [conversations, persisted],
  )

  return {
    conversations,
    // Two different facts, and both have to be false for the notice to be true: a browser that
    // never stored at all, and one that has stopped accepting what we have to store.
    storing: probed && !refused.current,
    save,
    rename,
    remove: drop,
    clear,
    importFile,
  }
}

// `persisted` used to live here, as a module function. It moved into the hook when it had to report
// a refused write: a failed write is still not a failed render — the browser keeps the list it built
// this session — but the line above that list has to stop saying it will survive the reload (AC20).
