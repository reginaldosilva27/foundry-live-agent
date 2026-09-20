/**
 * What an answer consulted (spec 034).
 *
 * **Driven by the recorded payloads, not by hand-written ones** (§5). That is not ceremony here: a
 * hand-written Learn fixture would have been a single tidy JSON document, and the real one is two
 * concatenated documents whose URLs live in `contentUrl`. The simplification this spec exists to
 * refuse — scan the output string for URLs — passes a tidy fixture and lists a dozen pages the
 * agent never opened against the real one.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sourcesOf } from './sources'
import { emptyTurn, type Activity, type Turn } from './turn'

const RECORDING = join(
  import.meta.dirname,
  '../../../ai/tests/fixtures/recorded/prompt-agent-turn-20260915.jsonl',
)

/** The real Learn MCP output, lifted from the recording rather than retyped. */
function recordedLearnOutput(): string {
  for (const line of readFileSync(RECORDING, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const event = JSON.parse(line) as { item?: { type?: string; output?: string } }
    if (event.item?.type === 'mcp_call' && event.item.output) return event.item.output
  }
  throw new Error('the recording no longer contains an mcp_call with an output')
}

function turnWith(...activities: Activity[]): Turn {
  return { ...emptyTurn(), activities, status: 'done' }
}

const mcp = (output: string, over: Partial<Activity> = {}): Activity =>
  ({
    kind: 'mcp',
    step: 1,
    serverLabel: 'microsoft_learn',
    name: 'microsoft_docs_search',
    arguments: '{}',
    status: 'ok',
    output,
    ...over,
  }) as Activity

const tool = (name: string, output: string, over: Partial<Activity> = {}): Activity =>
  ({
    kind: 'tool',
    step: 1,
    executor: 'bff',
    callId: 'call_1',
    name,
    arguments: '{}',
    status: 'ok',
    output,
    ...over,
  }) as Activity

describe('the Learn MCP payload, as it really arrives (AC12)', () => {
  const output = recordedLearnOutput()

  it('is two concatenated JSON documents, which is why a plain parse will not do', () => {
    // The premise of the reader, asserted rather than remembered. `JSON.parse` throws on this.
    expect(() => JSON.parse(output)).toThrow()
    expect(output).toContain('structuredResponse')
  })

  it('yields a source per result, from contentUrl', () => {
    const sources = sourcesOf(turnWith(mcp(output)))

    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) {
      expect(source.kind).toBe('link')
      expect(source.url).toMatch(/^https?:\/\//)
      expect(source.from).toBe('microsoft_learn')
    }
  })

  it('takes only the documented URLs, never links scraped out of the prose', () => {
    // `content` is Markdown full of incidental links. Listing those would claim the agent read
    // pages it never opened — the §5 failure this whole spec is about.
    const declared = declaredUrls(output)
    const got = new Set(sourcesOf(turnWith(mcp(output))).map((s) => s.url))

    expect([...got].every((url) => declared.has(url!))).toBe(true)
    // Every declared PAGE is still represented — nothing is dropped, only the fragments of a page
    // already listed are folded into it (see the AC9 test below).
    expect(new Set([...got].map((url) => page(url!)))).toEqual(
      new Set([...declared].map(page)),
    )
  })

  /**
   * AC9, against the payload that broke it.
   *
   * The Learn MCP answers a search with the **same page under several anchors** — this recording
   * carries `manage-hosted-agent` four times, once bare and three times with a `#section`. Four
   * distinct URLs, so the dedupe let all four through; one label, because `labelFor` is host plus
   * pathname. The reader saw the same page listed four times with nothing to tell the rows apart,
   * which is the exact thing AC9 describes ("offering two destinations would ask the reader to
   * choose without saying what differs"), and React logged eight duplicate-key errors for it.
   */
  it('lists a page once even when the search matched several of its sections (AC9)', () => {
    const declared = [...declaredUrls(output)]
    // The premise, asserted rather than assumed: if the recording ever stops carrying anchors this
    // test must fail loudly instead of passing vacuously.
    expect(declared.filter((url) => url.includes('#')).length).toBeGreaterThan(0)

    const sources = sourcesOf(turnWith(mcp(output)))
    const labels = sources.map((s) => s.label)

    expect(labels).toEqual([...new Set(labels)])
    expect(sources.map((s) => s.id)).toEqual([...new Set(sources.map((s) => s.id))])
  })
})

/** Every `contentUrl` the payload declares, read the way the reader reads them. */
function declaredUrls(output: string): Set<string> {
  return new Set(
    decodeAll(output).flatMap((d) =>
      (d.results ?? []).map((r) => r.contentUrl).filter((u): u is string => Boolean(u)),
    ),
  )
}

/** A URL with its fragment removed — what "the same page" means here. */
function page(url: string): string {
  return url.split('#')[0]
}

/** The same successive decode the reader does, written out here so the test proves the premise. */
function decodeAll(raw: string): { results?: { contentUrl?: string }[] }[] {
  const out: { results?: { contentUrl?: string }[] }[] = []
  let rest = raw.trim()
  while (rest) {
    let cut = rest.length
    for (;;) {
      try {
        out.push(JSON.parse(rest.slice(0, cut)))
        break
      } catch {
        const next = rest.lastIndexOf('}', cut - 2) + 1
        if (next <= 0 || next >= cut) return out
        cut = next
      }
    }
    rest = rest.slice(cut).trim()
  }
  return out
}

describe('the web search payload', () => {
  const ok = JSON.stringify({
    query: 'foundry agents',
    results: [
      { title: 'A', url: 'https://example.com/a', content: 'see https://other.example/x' },
      { title: 'B', url: 'https://example.com/b', content: '' },
    ],
  })

  it('yields one source per result, from url', () => {
    const sources = sourcesOf(turnWith(tool('search_web', ok)))

    expect(sources.map((s) => s.url)).toEqual(['https://example.com/a', 'https://example.com/b'])
    expect(sources.every((s) => s.from === 'search_web')).toBe(true)
  })

  it('ignores links inside the snippet text', () => {
    expect(sourcesOf(turnWith(tool('search_web', ok))).map((s) => s.url)).not.toContain(
      'https://other.example/x',
    )
  })

  it('reports a failed lookup rather than nothing (AC5)', () => {
    const failed = JSON.stringify({ error: 'search_unavailable', message: 'no key', results: [] })
    const sources = sourcesOf(turnWith(tool('search_web', failed)))

    expect(sources).toHaveLength(1)
    expect(sources[0].failed).toBe(true)
    expect(sources[0].url).toBeUndefined()
  })

  it('treats a call the executor marked failed as a failed lookup too', () => {
    const sources = sourcesOf(
      turnWith(tool('search_web', '', { status: 'failed', error: 'boom' })),
    )
    expect(sources[0].failed).toBe(true)
  })
})

describe('the project knowledge base (AC11)', () => {
  const passages = JSON.stringify({
    query: 'harness',
    passages: [
      { text: '…', source: 'docs/architecture.md', score: 0.9 },
      { text: '…', source: 'docs/architecture.md', score: 0.7 },
      { text: '…', source: 'PLAN.md', score: 0.4 },
    ],
  })

  it('lists each distinct passage source once, as a path and not a link', () => {
    const sources = sourcesOf(turnWith(tool('lookup_knowledge', passages)))

    expect(sources.map((s) => s.label)).toEqual(['docs/architecture.md', 'PLAN.md'])
    expect(sources.every((s) => s.kind === 'passage')).toBe(true)
    expect(sources.every((s) => s.url === undefined)).toBe(true)
  })
})

describe('across calls', () => {
  const one = JSON.stringify({ results: [{ title: 'A', url: 'https://example.com/a' }] })

  it('renders a repeated URL once, bound to the first call that produced it (AC9)', () => {
    const first = tool('search_web', one, { step: 1, callId: 'call_1' })
    const second = tool('search_web', one, { step: 2, callId: 'call_2' })
    const sources = sourcesOf(turnWith(first, second))

    expect(sources).toHaveLength(1)
    expect((sources[0].activity as { callId: string }).callId).toBe('call_1')
  })

  it('yields nothing at all for a turn that called nothing (AC4)', () => {
    expect(sourcesOf(emptyTurn())).toEqual([])
  })

  it('yields nothing for a tool that returns no sources', () => {
    const datetime = tool('get_current_datetime', JSON.stringify({ iso: '2026-09-19T12:00:00Z' }))
    expect(sourcesOf(turnWith(datetime))).toEqual([])
  })
})

describe('it reads events, never prose (AC6)', () => {
  it('never touches the answer text', () => {
    // The §5 guard in structural form: the module is handed a Turn, and the answer text is the one
    // field it must not consult — extracting URLs from prose would be the app inventing evidence.
    //
    // Comments are stripped first. The docstring necessarily NAMES the field it refuses to read,
    // and a grep over raw source would match the explanation rather than the code.
    const code = readFileSync(join(import.meta.dirname, 'sources.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')

    expect(code).not.toMatch(/\.text\b/)
  })

  it('is unaffected by what the answer says', () => {
    const withText: Turn = {
      ...turnWith(tool('get_current_datetime', '{}')),
      text: 'See https://example.com/made-up for details.',
    }
    expect(sourcesOf(withText)).toEqual([])
  })
})
