/**
 * Spec 021 AC11 — a turn you can take out of the browser.
 *
 * The document is the whole turn, not just its last paragraph: the question that caused it, the
 * answer, every call it made and who ran each one, and the numbers underneath. An export that
 * dropped the calls would lose the one thing this app exists to show.
 */
import { describe, expect, it } from 'vitest'
import { conversationToMarkdown, exportFilename, turnToMarkdown } from './exportTurn'
import { t } from '../i18n/strings'
import { reduceEvents } from './turn'

const s = (key: Parameters<typeof t>[0]) => t(key, 'en')

const turn = reduceEvents([
  { type: 'reasoning_summary', text: 'Checking the clock.' },
  {
    type: 'tool_call',
    call_id: 'call_1',
    name: 'get_current_datetime',
    arguments: '{"timezone":"America/Sao_Paulo"}',
    executor: 'bff',
  },
  { type: 'tool_result', call_id: 'call_1', output: '2026-09-16T12:00:00', duration_ms: 12 },
  {
    type: 'mcp_call',
    server_label: 'microsoft_learn',
    name: 'search_docs',
    arguments: '{"q":"foundry"}',
    output: 'a doc',
  },
  { type: 'text_delta', text: 'It is noon in Sao Paulo.' },
  { type: 'usage', input_tokens: 100, output_tokens: 20, reasoning_tokens: 64 },
  { type: 'trace_ids', response_id: 'resp_42' },
  { type: 'done' },
])

const document = turnToMarkdown(
  {
    question: 'What time is it in Sao Paulo?',
    turn,
    agent: 'foundry-live-agent',
    model: 'foundry-analytics-demo/gpt-5.5',
    latencyMs: 2400,
    at: new Date('2026-09-16T12:00:00Z').getTime(),
  },
  s,
)

describe('turnToMarkdown', () => {
  it('opens with the question that caused the turn', () => {
    expect(document).toContain('What time is it in Sao Paulo?')
  })

  it('carries the answer', () => {
    expect(document).toContain('It is noon in Sao Paulo.')
  })

  it('names the agent that answered', () => {
    expect(document).toContain('foundry-live-agent')
  })

  it('lists every call, with who ran it and how it ended', () => {
    expect(document).toContain('get_current_datetime')
    expect(document).toContain('bff')
    expect(document).toContain('{"timezone":"America/Sao_Paulo"}')

    // An MCP call is attributed to its server, not rendered as one of ours (design note M7).
    expect(document).toContain('search_docs')
    expect(document).toContain('microsoft_learn')
  })

  it('ends with the numbers: model, tokens and latency', () => {
    expect(document).toContain('gpt-5.5')
    expect(document).toContain('120')
    expect(document).toContain('2.4 s')
  })

  it('says a turn made no calls rather than printing an empty heading', () => {
    const quiet = turnToMarkdown(
      { question: 'Hi', turn: reduceEvents([{ type: 'text_delta', text: 'Hello.' }]) },
      s,
    )
    expect(quiet).toContain('Hello.')
    expect(quiet).toContain(t('export.noCalls', 'en'))
  })

  it('is valid Markdown for a turn with nothing but an answer', () => {
    const bare = turnToMarkdown({ question: 'Hi', turn: reduceEvents([]) }, s)
    expect(bare.startsWith('# ')).toBe(true)
  })
})

describe('exportFilename', () => {
  it('names the file after the question, safely', () => {
    const name = exportFilename('What time is it in São Paulo?', new Date('2026-09-16T12:00:00Z'))
    expect(name).toMatch(/^foundry-live-agent-what-time-is-it-in-s-o-paulo-2026-09-16\.md$/)
  })

  it('falls back to the product name when the title reduces to nothing', () => {
    expect(exportFilename('？？？', new Date('2026-09-16T12:00:00Z'))).toBe(
      'foundry-live-agent-2026-09-16.md',
    )
  })
})

/** Spec 026 — an export that omits "this was asked twice" describes a conversation that did not happen. */
describe('a repeated turn', () => {
  it('says so, naming who answered it', () => {
    const document_ = turnToMarkdown(
      {
        question: 'what time is it',
        turn: reduceEvents([{ type: 'text_delta', text: 'It is 19:00.' }, { type: 'done' }]),
        agent: 'foundry-live-agent',
        repeatOf: { turnId: 'turn_0', agent: 'foundry-live-agent-hosted' },
      },
      (key) => t(key, 'en'),
    )

    expect(document_).toContain('foundry-live-agent-hosted')
  })

  it('says nothing about a repeat when the turn is not one', () => {
    const document_ = turnToMarkdown(
      {
        question: 'what time is it',
        turn: reduceEvents([{ type: 'text_delta', text: 'It is 19:00.' }, { type: 'done' }]),
        agent: 'foundry-live-agent',
      },
      (key) => t(key, 'en'),
    )

    expect(document_).not.toContain(t('turn.repeatOf', 'en').replace(' · {agent}', ''))
  })
})

/** Spec 027 AC7 — one document describes a conversation the way one already describes a turn. */
describe('conversationToMarkdown', () => {
  const stored = {
    id: 'c_1',
    conversationId: 'conv_abc',
    agent: 'foundry-live-agent',
    title: 'What time is it in Sao Paulo?',
    updatedAt: new Date('2026-09-16T12:00:00Z').getTime(),
    messages: [
      { role: 'user' as const, id: 'u1', text: 'What time is it in Sao Paulo?' },
      { role: 'agent' as const, id: 'a1', startedAt: 0, turn },
      { role: 'user' as const, id: 'u2', text: 'And in Lisbon?' },
      {
        role: 'agent' as const,
        id: 'a2',
        startedAt: 0,
        turn: reduceEvents([{ type: 'text_delta', text: 'It is 16:00 in Lisbon.' }, { type: 'done' }]),
      },
    ],
  }

  const document_ = conversationToMarkdown(stored, s)

  it('opens with the conversation, named and attributed', () => {
    expect(document_.startsWith('# What time is it in Sao Paulo?')).toBe(true)
    expect(document_).toContain('foundry-live-agent')
  })

  it('carries the identifiers that tie it back to Foundry and to the spans', () => {
    expect(document_).toContain('conv_abc')
    expect(document_).toContain('resp_42')
  })

  it('renders every message in the order they happened', () => {
    const lisbonQuestion = document_.indexOf('And in Lisbon?')
    const saoPauloAnswer = document_.indexOf('It is noon in Sao Paulo.')
    const lisbonAnswer = document_.indexOf('It is 16:00 in Lisbon.')

    expect(saoPauloAnswer).toBeGreaterThan(-1)
    expect(lisbonQuestion).toBeGreaterThan(saoPauloAnswer)
    expect(lisbonAnswer).toBeGreaterThan(lisbonQuestion)
  })

  it('keeps the calls, and who ran each one — the distinction the repo exists to show', () => {
    expect(document_).toContain('get_current_datetime')
    expect(document_).toContain('bff')
    expect(document_).toContain('microsoft_learn')
  })

  it('says so rather than drawing an empty document for a conversation with no turns', () => {
    const empty = conversationToMarkdown({ ...stored, messages: [] }, s)
    expect(empty).toContain(t('export.noAnswer', 'en'))
  })
})
