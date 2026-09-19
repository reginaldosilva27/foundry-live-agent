/**
 * The contract, made watchable (spec 038).
 *
 * The subtle one is that runs collapse only across *consecutive* events. A `text_delta` run
 * interrupted by a `tool_call` is two runs, because the order is the thing a reader is reading —
 * collapsing across the interruption would hide the shape of the turn, which is the whole point.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runsOf, typeOf } from './events'

const delta = (text: string) => ({ type: 'text_delta', text })

describe('arrival order and summaries (AC1)', () => {
  it('keeps every event in the order it arrived', () => {
    const runs = runsOf([
      { type: 'trace_ids', response_id: 'resp_1' },
      { type: 'tool_call', name: 'search_web', executor: 'bff', call_id: 'c1' },
      { type: 'done' },
    ])

    expect(runs.map((r) => r.type)).toEqual(['trace_ids', 'tool_call', 'done'])
    expect(runs.map((r) => r.at)).toEqual([1, 2, 3])
  })

  it('names the fields a reader is looking for', () => {
    const [tool] = runsOf([
      { type: 'tool_call', name: 'search_web', executor: 'bff', call_id: 'c1' },
    ])

    // Who ran it is §8 in the type system, so it belongs on the one line.
    expect(tool.summary).toContain('search_web')
    expect(tool.summary).toContain('bff')
    expect(tool.summary).toContain('c1')
  })

  it('attributes an MCP call to its server', () => {
    const [mcp] = runsOf([{ type: 'mcp_call', server_label: 'microsoft_learn', name: 'search' }])
    expect(mcp.summary).toContain('microsoft_learn')
  })

  it('says nothing it does not know', () => {
    const [bare] = runsOf([{ type: 'tool_result', call_id: 'c1' }])
    expect(bare.summary).toBe('c1')
  })
})

describe('collapsing the high-frequency types (AC2)', () => {
  it('folds consecutive deltas into one run with a count', () => {
    const runs = runsOf([delta('Hel'), delta('lo '), delta('there')])

    expect(runs).toHaveLength(1)
    expect(runs[0].count).toBe(3)
  })

  it('keeps the accumulated text available', () => {
    const runs = runsOf([delta('Hel'), delta('lo '), delta('there')])
    expect(runs[0].summary).toBe('Hello there')
  })

  it('keeps every raw event of the run, so the payloads are not lost', () => {
    const runs = runsOf([delta('a'), delta('b')])
    expect(runs[0].raw).toHaveLength(2)
  })

  it('does not collapse across an interruption', () => {
    // Two runs, not one of four: the tool call between them IS the shape of the turn.
    const runs = runsOf([
      delta('Let me check'),
      { type: 'tool_call', name: 'search_web', executor: 'bff', call_id: 'c1' },
      { type: 'tool_result', call_id: 'c1' },
      delta('It is 12:00.'),
    ])

    expect(runs.map((r) => r.type)).toEqual(['text_delta', 'tool_call', 'tool_result', 'text_delta'])
    expect(runs[0].summary).toBe('Let me check')
    expect(runs[3].summary).toBe('It is 12:00.')
  })

  it('does not collapse a type that arrives once', () => {
    const runs = runsOf([{ type: 'done' }, { type: 'done' }])
    expect(runs).toHaveLength(2)
  })
})

describe('an event the contract does not know', () => {
  it('is shown rather than hidden', () => {
    // The reason the retained events are `unknown[]`: somebody opens this panel precisely to find
    // the event nothing else in the app could render.
    const runs = runsOf([{ type: 'something.new', detail: 1 }])

    expect(runs[0].type).toBe('something.new')
    expect(runs[0].raw[0]).toEqual({ type: 'something.new', detail: 1 })
  })

  it('survives an event with no type at all', () => {
    expect(typeOf({})).toBe('unknown')
    expect(typeOf(null)).toBe('unknown')
    expect(runsOf([null])).toHaveLength(1)
  })
})

describe('the contract is not written down here (AC4, §4)', () => {
  it('enumerates no event names outside the collapsing rule', () => {
    const code = readFileSync(join(import.meta.dirname, 'events.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    // `text_delta` and `reasoning_summary` appear because those two are collapsed, which is a
    // rendering decision. The FILTER's options come from `GET /config`, never from a list here.
    const names = ['done', 'usage', 'trace_ids', 'mcp_call', 'tool_call', 'tool_result', 'error']
    const declaredAsList = new RegExp(`\\[[^\\]]*'${names[0]}'[^\\]]*\\]`)

    expect(code).not.toMatch(declaredAsList)
  })

  it('is not mirrored as a list anywhere else in the frontend', () => {
    // `types/events.ts` IS the sanctioned mirror of `contract.py` — declared as such and held to
    // it by `contract-parity.test.ts`, which fails on the commit that introduces drift. Every
    // OTHER file spelling the vocabulary would be a fourth home for it, unguarded (§4). The
    // inspector in particular must take its filter from `GET /config`.
    const SANCTIONED = join('types', 'events.ts')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          if (full.endsWith(SANCTIONED)) continue
          const text = readFileSync(full, 'utf8')
          if (/'text_delta'[\s,]+'tool_call'|'tool_call'[\s,]+'tool_result'[\s,]+'mcp_call'/.test(text)) {
            offenders.push(full)
          }
        }
      }
    }
    walk(join(import.meta.dirname, '..'))

    expect(offenders, `these spell the event vocabulary: ${offenders}`).toEqual([])
  })
})
