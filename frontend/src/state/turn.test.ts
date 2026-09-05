/** Spec 004 AC2, AC3, AC4, AC5, AC7 — the reducer, with no DOM in sight. */
import { describe, expect, it } from 'vitest'
import { emptyTurn, reduceEvents, reduceTurn } from './turn'
import { failedTurn, twoToolTurn } from '../test/fixtures'

describe('reduceEvents', () => {
  it('concatenates reasoning fragments in order', () => {
    expect(reduceEvents(twoToolTurn).reasoning).toBe('The user asked what time it is.')
  })

  it('concatenates answer fragments in order', () => {
    expect(reduceEvents(twoToolTurn).text).toBe('It is 19:00 in Sao Paulo.')
  })

  it('keeps activities in the order the agent produced them', () => {
    const turn = reduceEvents(twoToolTurn)
    expect(turn.activities.map((a) => a.name)).toEqual([
      'get_current_datetime',
      'microsoft_docs_search',
    ])
  })

  it('records who executed each activity', () => {
    const [tool, mcp] = reduceEvents(twoToolTurn).activities
    expect(tool).toMatchObject({ kind: 'tool', executor: 'app' })
    expect(mcp).toMatchObject({ kind: 'mcp', serverLabel: 'microsoft_learn' })
  })

  it('leaves an unanswered app tool call running', () => {
    const turn = reduceEvents(twoToolTurn.filter((e) => e.type !== 'tool_result'))
    expect(turn.activities[0].status).toBe('running')
  })

  it('resolves a tool call to its result and duration', () => {
    const [tool] = reduceEvents(twoToolTurn).activities
    expect(tool).toMatchObject({
      kind: 'tool',
      status: 'ok',
      durationMs: 3,
    })
    expect(tool.output).toContain('2026-09-04')
  })

  it('marks a tool result carrying an error as failed', () => {
    const turn = reduceEvents([
      ...twoToolTurn.slice(0, 3),
      {
        type: 'tool_result',
        call_id: 'call_1',
        name: 'get_current_datetime',
        output: '{"error":"tool_failed"}',
        error: 'ZoneInfoNotFoundError: nope',
      },
    ])
    expect(turn.activities[0].status).toBe('failed')
    expect(turn.activities[0].error).toContain('ZoneInfoNotFoundError')
  })

  it('carries usage and trace ids through', () => {
    const turn = reduceEvents(twoToolTurn)
    expect(turn.usage).toEqual({ inputTokens: 120, outputTokens: 34 })
    expect(turn.trace).toMatchObject({ responseId: 'resp_1', conversationId: 'conv_1' })
  })

  it('ends a healthy turn as done', () => {
    expect(reduceEvents(twoToolTurn).status).toBe('done')
  })

  it('ends a failed turn as an error, keeping the text streamed so far', () => {
    const turn = reduceEvents(failedTurn)
    expect(turn.status).toBe('error')
    expect(turn.error).toMatchObject({ code: 'model_not_found' })
    expect(turn.text).toBe('Let me check')
  })

  it('is still streaming while no terminal event has arrived', () => {
    expect(reduceEvents(twoToolTurn.slice(0, 4)).status).toBe('streaming')
  })

  it('ignores an event type it does not know, and counts it', () => {
    const turn = reduceEvents([
      { type: 'text_delta', text: 'hi' },
      { type: 'telepathy_delta', text: 'boo' } as never,
      { type: 'done' },
    ])
    expect(turn.text).toBe('hi')
    expect(turn.status).toBe('done')
    expect(turn.unknownEvents).toEqual({ telepathy_delta: 1 })
  })

  it('does not mutate the turn it is given', () => {
    const before = emptyTurn()
    reduceTurn(before, { type: 'text_delta', text: 'hi' })
    expect(before.text).toBe('')
  })
})
