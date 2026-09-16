/**
 * Spec 021 AC16, AC19, AC22 — what this browser remembers about conversations it has drawn.
 *
 * Every rule here is pure and tested without a DOM: what a conversation is called, where it sits in
 * the list, how many of them a browser keeps, and which time group it falls into. The hook that
 * binds them to storage is thin on purpose — there is nothing in it these tests do not cover.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  CAP,
  HISTORY_KEY,
  groupByAge,
  load,
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
