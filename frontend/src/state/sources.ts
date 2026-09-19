/**
 * What an answer consulted (spec 034).
 *
 * The agent is instructed to cite, and it does — in prose, as bare links. Meanwhile the events
 * already carry what was actually asked and what actually came back. This turns those into a list,
 * so the evidence sits beside the claim instead of two clicks away in the trace panel.
 *
 * **Built from events, never from the answer text.** Scanning the model's prose for URLs would be
 * the app inventing evidence out of a sentence; `turn.text` is the one field this module must not
 * read, and a test asserts it does not.
 *
 * **One reader per tool, because the tools genuinely differ** — measured from the recordings, not
 * assumed:
 *
 *     microsoft_learn   `contentUrl`, in a string holding TWO concatenated JSON documents
 *     search_web        `url`, in `{query, results[]}`
 *     lookup_knowledge  no URL at all — `source`, a path inside this repository
 *
 * A generic URL scan over the output string is wrong for all three. Against the real Learn payload
 * it finds nothing at the top level and instead pulls dozens of incidental links out of the
 * Markdown inside `content`, listing pages the agent never opened as though it had (§5).
 *
 * An unknown tool contributes nothing rather than throwing: a turn must render whatever it called.
 */
import { callKey, type Activity, type Turn } from './turn'

export interface Source {
  /** A URL, or a path inside this repository. The view never has to ask of a string. */
  kind: 'link' | 'passage'
  /** What the reader sees — host + path, or the repository path. */
  label: string
  /** Absent for a passage. Never invented, never an empty string standing in for one. */
  url?: string
  /** The server label or tool name that produced it (AC2). */
  from: string
  /** Whether the lookup failed — distinct from having produced nothing (AC5). */
  failed?: boolean
  /** The call this came from, so selecting it opens that payload (AC3). */
  activity: Activity
  /** How the trace reader addresses that call — `callKey`, so the two cannot drift (§4). */
  callKey: string
}

/** What a reader returns: the source itself, before it is attributed to a call. */
type Found = Pick<Source, 'kind' | 'label' | 'url'>

/** Tools whose output carries sources. Anything else contributes none. */
const READERS: Record<string, (output: string) => Found[]> = {
  microsoft_learn: readLearn,
  search_web: readSearch,
  lookup_knowledge: readKnowledge,
}

export function sourcesOf(turn: Turn): Source[] {
  const out: Source[] = []
  const seen = new Set<string>()

  turn.activities.forEach((activity, index) => {
    const key = callKey(activity, index)
    const from = activity.kind === 'mcp' ? activity.serverLabel : activity.name
    const read = READERS[from]
    if (!read) return

    // A call the executor marked failed, or one whose payload says so, is a *failed lookup* — a
    // different fact from having consulted nothing, and the reader has to be able to tell them
    // apart (AC5).
    if (activity.status === 'failed') {
      out.push({ kind: 'link', label: from, from, failed: true, activity, callKey: key })
      return
    }

    const output = activity.output ?? ''
    const found = read(output)
    if (found === FAILED) {
      out.push({ kind: 'link', label: from, from, failed: true, activity, callKey: key })
      return
    }

    for (const source of found) {
      // First call wins. A second call returning the same page is not a second piece of evidence
      // about it, and offering two destinations would ask the reader to choose without saying
      // what differs (AC9).
      const id = source.url ?? `${from}:${source.label}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push({ ...source, from, activity, callKey: key })
    }
  })

  return out
}

/** A sentinel the readers return for "it tried and could not", distinct from an empty list. */
const FAILED: Found[] = []

function readLearn(output: string): Found[] {
  const found: Found[] = []
  for (const document of decodeSuccessive(output)) {
    for (const result of asArray(document.results)) {
      // `contentUrl`, observed. NOT `url`, and never a link out of `content` — see the docstring.
      const url = typeof result.contentUrl === 'string' ? result.contentUrl : ''
      if (url) found.push({ kind: 'link', label: labelFor(url), url })
    }
  }
  return found
}

function readSearch(output: string): Found[] {
  const body = parseOrNull(output)
  if (!body) return FAILED
  // The tool's own documented failure shape: `error`, `message` and an empty `results`.
  if (typeof body.error === 'string' && body.error) return FAILED

  const found: Found[] = []
  for (const result of asArray(body.results)) {
    const url = typeof result.url === 'string' ? result.url : ''
    if (url) found.push({ kind: 'link', label: labelFor(url), url })
  }
  return found
}

function readKnowledge(output: string): Found[] {
  const body = parseOrNull(output)
  if (!body) return FAILED

  const found: Found[] = []
  for (const passage of asArray(body.passages)) {
    const source = typeof passage.source === 'string' ? passage.source : ''
    // A path in this repository, not a URL. Inventing one would be worse than listing none.
    if (source) found.push({ kind: 'passage', label: source })
  }
  return found
}

/**
 * Decode one or more JSON documents concatenated into one string.
 *
 * The Learn MCP server really does answer `{"results":[…]}{"structuredResponse":…}`, so
 * `JSON.parse` on the whole thing throws. Observed 2026-09-15 and asserted in `sources.test.ts`
 * against the recording, so a change upstream fails loudly rather than yielding nothing.
 */
function decodeSuccessive(raw: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  let rest = raw.trim()

  while (rest) {
    let cut = rest.length
    let parsed: Record<string, unknown> | null = null

    while (cut > 0) {
      try {
        parsed = JSON.parse(rest.slice(0, cut)) as Record<string, unknown>
        break
      } catch {
        // Back off to the previous closing brace and try a shorter prefix. Searching from
        // `cut - 2` rather than `cut - 1` matters: at `cut === rest.length` the brace found IS
        // the last character, so `+ 1` would return the same `cut` and spin forever.
        const next = rest.lastIndexOf('}', cut - 2) + 1
        if (next <= 0 || next >= cut) {
          cut = 0
          break
        }
        cut = next
      }
    }

    if (!parsed) break
    out.push(parsed)
    rest = rest.slice(cut).trim()
  }
  return out
}

function parseOrNull(raw: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(raw) as unknown
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value.filter((v) => typeof v === 'object' && v) as Record<string, unknown>[]) : []
}

/** Host plus path — enough to recognise a page, short enough for a strip. */
function labelFor(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, '')
  } catch {
    return url
  }
}
