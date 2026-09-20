/**
 * Spec 021 AC16, AC19, AC22 — what this browser remembers about conversations it has drawn.
 *
 * Every rule here is pure and tested without a DOM: what a conversation is called, where it sits in
 * the list, how many of them a browser keeps, and which time group it falls into. The hook that
 * binds them to storage is thin on purpose — there is nothing in it these tests do not cover.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CAP,
  HISTORY_KEY,
  groupByAge,
  RECORD_VERSION,
  load,
  mergeImported,
  parseExportFile,
  searchConversations,
  toExportFile,
  useHistory,
  titleFrom,
  upsert,
  type StoredConversation,
} from './history'
import { writeJson } from './storage'

function conversation(over: Partial<StoredConversation> = {}): StoredConversation {
  return {
    id: 'c1',
    conversationId: 'conv_1',
    agent: null,
    title: 'A question',
    updatedAt: 1_000,
    messages: [],
    ...over,
  }
}

const DAY = 24 * 60 * 60 * 1000

describe('titleFrom', () => {
  it('names the conversation after the first thing the person typed', () => {
    expect(titleFrom('What time is it in Sao Paulo?', 'Untitled')).toBe(
      'What time is it in Sao Paulo?',
    )
  })

  it('collapses whitespace so a pasted question does not arrive with its newlines', () => {
    expect(titleFrom('  What\n  time\tis it?  ', 'Untitled')).toBe('What time is it?')
  })

  it('trims a long question to one line and marks that it was cut', () => {
    const title = titleFrom('x'.repeat(200), 'Untitled')
    expect(title.length).toBeLessThanOrEqual(61)
    expect(title.endsWith('…')).toBe(true)
  })

  it('falls back when there is nothing to name it after', () => {
    expect(titleFrom('   ', 'Untitled')).toBe('Untitled')
  })
})

describe('upsert', () => {
  it('puts the newest first', () => {
    const list = upsert([conversation({ id: 'c1' })], conversation({ id: 'c2' }))
    expect(list.map((c) => c.id)).toEqual(['c2', 'c1'])
  })

  it('replaces a conversation by id rather than adding a second copy of it', () => {
    const list = upsert(
      [conversation({ id: 'c1', title: 'first' }), conversation({ id: 'c2' })],
      conversation({ id: 'c1', title: 'grown' }),
    )
    expect(list.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(list[0].title).toBe('grown')
  })

  it('keeps at most CAP conversations, dropping the oldest', () => {
    let list: StoredConversation[] = []
    for (let n = 0; n < CAP + 1; n++) {
      list = upsert(list, conversation({ id: `c${n}`, updatedAt: n }))
    }
    expect(list).toHaveLength(CAP)
    expect(list.map((c) => c.id)).not.toContain('c0')
    expect(list[0].id).toBe(`c${CAP}`)
  })
})

describe('groupByAge', () => {
  const now = new Date('2026-09-16T15:00:00Z').getTime()

  it('splits today, the last seven days and older — and omits a group with nothing in it', () => {
    const groups = groupByAge(
      [
        conversation({ id: 'now', updatedAt: now - 60_000 }),
        conversation({ id: 'week', updatedAt: now - 3 * DAY }),
        conversation({ id: 'ancient', updatedAt: now - 90 * DAY }),
      ],
      now,
    )

    expect(groups.map((g) => g.group)).toEqual(['today', 'week', 'older'])
    expect(groups.map((g) => g.items.map((c) => c.id))).toEqual([['now'], ['week'], ['ancient']])

    expect(groupByAge([conversation({ updatedAt: now })], now).map((g) => g.group)).toEqual([
      'today',
    ])
  })

  it('counts yesterday as the last seven days, not as today', () => {
    const yesterday = conversation({ updatedAt: now - 20 * 60 * 60 * 1000 })
    expect(groupByAge([yesterday], now)[0].group).toBe('week')
  })
})

describe('load', () => {
  afterEach(() => localStorage.clear())

  it('reads back what was stored', () => {
    writeJson(HISTORY_KEY, [conversation()])
    expect(load()).toHaveLength(1)
  })

  it('ignores a stored value that is not a list of conversations', () => {
    writeJson(HISTORY_KEY, { not: 'a list' })
    expect(load()).toEqual([])
  })

  it('drops a record an older build wrote in a shape this one cannot render', () => {
    writeJson(HISTORY_KEY, [{ id: 'bad' }, conversation({ id: 'good' })])
    expect(load().map((c) => c.id)).toEqual(['good'])
  })
})

/** Spec 027 AC1, AC2, AC3, AC5 — finding a conversation by what is in it. */
describe('searchConversations', () => {
  const asked = (id: string, title: string, text: string): StoredConversation =>
    conversation({
      id,
      title,
      messages: [
        { role: 'user', id: `${id}-u`, text },
        {
          role: 'agent',
          id: `${id}-a`,
          startedAt: 0,
          turn: {
            reasoning: '',
            activities: [],
            text: 'An answer about nothing in particular.',
            status: 'done',
            unknownEvents: {},
          },
        },
      ],
    })

  const withCalls = (id: string): StoredConversation =>
    conversation({
      id,
      title: 'A conversation with calls',
      messages: [
        {
          role: 'agent',
          id: `${id}-a`,
          startedAt: 0,
          turn: {
            reasoning: '',
            text: 'Done.',
            status: 'done',
            unknownEvents: {},
            activities: [
              {
                kind: 'tool',
                step: 1,
                executor: 'app',
                callId: 'call_1',
                name: 'search_web',
                arguments: '{"query":"pineapple"}',
                status: 'ok',
                output: '{"answer":"quince"}',
              },
              {
                kind: 'mcp',
                step: 2,
                serverLabel: 'microsoft_learn',
                name: 'microsoft_docs_search',
                arguments: '{"question":"tangerine"}',
                status: 'ok',
              },
            ],
          },
        },
      ],
    })

  const list = [asked('c1', 'Deploying to Container Apps', 'How do I deploy?'), withCalls('c2')]

  it('returns everything, in order, for an empty query (AC3)', () => {
    expect(searchConversations(list, '').map((hit) => hit.conversation.id)).toEqual(['c1', 'c2'])
    expect(searchConversations(list, '   ')).toHaveLength(2)
  })

  it('matches a title, ignoring case (AC1)', () => {
    const hits = searchConversations(list, 'container APPS')
    expect(hits.map((hit) => hit.conversation.id)).toEqual(['c1'])
    expect(hits[0].match?.field).toBe('title')
  })

  it('matches what either role said, and says where (AC1, AC2)', () => {
    const hits = searchConversations(list, 'how do i deploy')
    expect(hits.map((hit) => hit.conversation.id)).toEqual(['c1'])
    expect(hits[0].match?.field).toBe('message')
    expect(hits[0].match?.fragment).toContain('How do I deploy?')

    expect(searchConversations(list, 'nothing in particular').map((h) => h.conversation.id)).toEqual(
      ['c1'],
    )
  })

  it('matches a tool name and an MCP server label (AC5)', () => {
    const tool = searchConversations(list, 'search_web')
    expect(tool.map((hit) => hit.conversation.id)).toEqual(['c2'])
    expect(tool[0].match).toEqual({ field: 'tool', fragment: 'search_web' })

    const mcp = searchConversations(list, 'microsoft_learn')
    expect(mcp.map((hit) => hit.conversation.id)).toEqual(['c2'])
    expect(mcp[0].match).toEqual({ field: 'mcp', fragment: 'microsoft_learn' })
  })

  it('does not match text that exists only in a call’s arguments or output (AC5)', () => {
    expect(searchConversations(list, 'pineapple')).toEqual([])
    expect(searchConversations(list, 'quince')).toEqual([])
    expect(searchConversations(list, 'tangerine')).toEqual([])
  })

  it('folds accents, the way the palette does (§4)', () => {
    const accented = [asked('c3', 'Conversação com o agente', 'Olá')]
    expect(searchConversations(accented, 'conversacao')).toHaveLength(1)
  })

  it('returns nothing when nothing matches', () => {
    expect(searchConversations(list, 'zzzz')).toEqual([])
  })

  it('keeps the fragment short enough for a 248px rail (AC2)', () => {
    const long = [asked('c4', 'Long', `${'x'.repeat(400)} needle ${'y'.repeat(400)}`)]
    const fragment = searchConversations(long, 'needle')[0].match?.fragment ?? ''
    expect(fragment).toContain('needle')
    expect(fragment.length).toBeLessThanOrEqual(90)
  })
})

/** Spec 027 AC8, AC9, AC10, AC11, AC12 — the file the record leaves in, and comes back from. */
describe('the export file', () => {
  const traced = conversation({
    id: 'c1',
    agent: 'foundry-live-agent',
    conversationId: 'conv_abc',
    messages: [
      { role: 'user', id: 'u1', text: 'Why?' },
      {
        role: 'agent',
        id: 'a1',
        startedAt: 0,
        turn: {
          reasoning: '',
          activities: [],
          text: 'Because.',
          status: 'done',
          unknownEvents: {},
          trace: { responseId: 'resp_1', otelTraceId: 'otel_1' },
        },
      },
    ],
  })

  it('carries a version, so a later shape can read an older file (AC8)', () => {
    const file = toExportFile([traced], 1_700_000_000_000)
    expect(file.version).toBe(RECORD_VERSION)
    expect(file.exportedAt).toBe(1_700_000_000_000)
  })

  it('carries the pointer, the agent and the trace ids, stripping nothing (AC8)', () => {
    const [only] = toExportFile([traced], 0).conversations
    expect(only.conversationId).toBe('conv_abc')
    expect(only.agent).toBe('foundry-live-agent')
    expect(only.messages).toHaveLength(2)
    const answer = only.messages[1]
    expect(answer.role === 'agent' && answer.turn.trace).toEqual({
      responseId: 'resp_1',
      otelTraceId: 'otel_1',
    })
  })

  it('round-trips its own output, pointer included (AC9)', () => {
    expect(parseExportFile(JSON.stringify(toExportFile([traced], 0)))).toEqual([traced])
  })

  it('refuses a file it does not understand, whole (AC12)', () => {
    expect(parseExportFile('not json at all')).toBeNull()
    expect(parseExportFile(JSON.stringify({ version: 99, conversations: [traced] }))).toBeNull()
    expect(parseExportFile(JSON.stringify({ version: RECORD_VERSION }))).toBeNull()
    expect(
      parseExportFile(JSON.stringify({ version: RECORD_VERSION, conversations: 'nope' })),
    ).toBeNull()
    expect(parseExportFile(JSON.stringify([traced]))).toBeNull()
  })

  it('drops a conversation in a shape it cannot render, and keeps the rest (§5)', () => {
    const file = { version: RECORD_VERSION, exportedAt: 0, conversations: [{ id: 'bad' }, traced] }
    expect(parseExportFile(JSON.stringify(file))?.map((c) => c.id)).toEqual(['c1'])
  })
})

describe('mergeImported', () => {
  const at = (id: string, updatedAt: number) => conversation({ id, updatedAt })

  it('does not duplicate a conversation already stored (AC10)', () => {
    const stored = [at('c1', 10), at('c2', 20)]
    const result = mergeImported(stored, [at('c1', 99)], CAP)
    expect(result.conversations.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
    expect(result.kept).toBe(0)
    expect(result.dropped).toBe(0)
  })

  it('merges the new ones, newest first', () => {
    const result = mergeImported([at('c1', 10)], [at('c2', 30), at('c3', 20)], CAP)
    expect(result.conversations.map((c) => c.id)).toEqual(['c2', 'c3', 'c1'])
    expect(result.kept).toBe(2)
  })

  it('keeps the newest past the cap, and reports what it could not keep (AC11)', () => {
    const stored = [at('stored', 1_000)]
    const incoming = [at('new-1', 900), at('new-2', 800), at('new-3', 700)]
    const result = mergeImported(stored, incoming, 3)

    expect(result.conversations.map((c) => c.id)).toEqual(['stored', 'new-1', 'new-2'])
    expect(result.kept).toBe(2)
    expect(result.dropped).toBe(1)
  })
})

/** Spec 027 AC13 — clearing is deliberate, and it removes the key rather than storing an empty one. */
describe('useHistory().clear', () => {
  afterEach(() => localStorage.clear())

  it('empties the list and takes the stored key with it', () => {
    writeJson(HISTORY_KEY, [conversation({ id: 'c1' }), conversation({ id: 'c2' })])
    const { result } = renderHook(() => useHistory())
    expect(result.current.conversations).toHaveLength(2)

    act(() => result.current.clear())

    expect(result.current.conversations).toEqual([])
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull()
  })
})

/**
 * Spec 027 AC20 — the notice above the list must stay true for the whole session.
 *
 * `storing` was probed once, at mount, and the probe writes one byte. A browser at its quota still
 * takes one byte, so the probe kept saying yes while the real write — twenty-five conversations of
 * transcript — was being refused: the reader was told their history was kept, and it was not. The
 * write already reported failure; nobody read the answer.
 */
describe('useHistory() when the browser stops accepting writes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('stops claiming the history is kept once a write is refused', () => {
    const { result } = renderHook(() => useHistory())
    expect(result.current.storing).toBe(true)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    act(() => result.current.save(conversation({ id: 'c1' })))

    expect(result.current.storing).toBe(false)
    // The drawing this session made is still on screen: a failed write is not a failed render.
    expect(result.current.conversations).toHaveLength(1)
  })

  it('says the same thing when a rename or a delete is the write that fails', () => {
    writeJson(HISTORY_KEY, [conversation({ id: 'c1' })])
    const { result } = renderHook(() => useHistory())

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    act(() => result.current.rename('c1', 'a new title'))

    expect(result.current.storing).toBe(false)
  })

  it('keeps saying yes while the writes are going through', () => {
    const { result } = renderHook(() => useHistory())

    act(() => result.current.save(conversation({ id: 'c1' })))
    act(() => result.current.save(conversation({ id: 'c2' })))

    expect(result.current.storing).toBe(true)
  })
})

/** Spec 027 AC11, AC12 — the hook reports what it did, at the moment it did it. */
describe('useHistory().importFile', () => {
  afterEach(() => localStorage.clear())

  it('reports kept and dropped to its caller, not on the next render', () => {
    writeJson(HISTORY_KEY, [conversation({ id: 'stored', updatedAt: 1_000 })])
    const { result } = renderHook(() => useHistory())

    const incoming = Array.from({ length: CAP + 2 }, (_, i) =>
      conversation({ id: `in-${i}`, updatedAt: 900 - i }),
    )

    let report: { kept: number; dropped: number } | null = null
    act(() => {
      report = result.current.importFile(JSON.stringify(toExportFile(incoming, 0)))
    })

    expect(report).toEqual({ kept: CAP - 1, dropped: 3 })
    expect(result.current.conversations).toHaveLength(CAP)
  })

  it('refuses a file that is not a record and leaves the record untouched (AC12)', () => {
    writeJson(HISTORY_KEY, [conversation({ id: 'stored' })])
    const { result } = renderHook(() => useHistory())

    let report: { kept: number; dropped: number } | null = { kept: 0, dropped: 0 }
    act(() => {
      report = result.current.importFile('{"nope":true}')
    })

    expect(report).toBeNull()
    expect(result.current.conversations.map((c) => c.id)).toEqual(['stored'])
  })
})
