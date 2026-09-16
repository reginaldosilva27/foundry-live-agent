/**
 * Formatting rules that more than one surface depends on (§4).
 *
 * `modelName` is here because it was not: the rule for shortening a `<connection>/<model>`
 * deployment name lived inside `Sidebar`, so when spec 014 put the model in the trace panel too,
 * the panel rendered the raw name — four wrapped lines of `ai-admin2354ai223634534-project/gpt-5.5`
 * beside a sidebar that said `gpt-5.5`. One fact, two spellings, which is the failure §4 names.
 */
import { describe, expect, it } from 'vitest'
import { callSubject, formatMs, formatClock, modelName } from './format'

describe('modelName', () => {
  it('keeps the model half of a <connection>/<model> deployment name', () => {
    expect(modelName('ai-admin2354ai223634534-project/gpt-5.5')).toBe('gpt-5.5')
  })

  it('returns a plain deployment name unchanged', () => {
    expect(modelName('gpt-5.5')).toBe('gpt-5.5')
  })

  it('has nothing to say about nothing', () => {
    expect(modelName(undefined)).toBe('')
    expect(modelName('')).toBe('')
  })
})

describe('durations', () => {
  it('reads milliseconds below a second and seconds above it', () => {
    expect(formatMs(3)).toBe('3 ms')
    expect(formatMs(2400)).toBe('2.4 s')
  })

  it('clocks mm:ss', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(75)).toBe('01:15')
  })
})

describe('callSubject', () => {
  it('reads the query a search was given', () => {
    expect(callSubject('{"query": "hosted agents"}')).toBe('hosted agents')
  })

  it('reads whatever the first string argument is, whatever it is called', () => {
    expect(callSubject('{"timezone": "America/Sao_Paulo"}')).toBe('America/Sao_Paulo')
    expect(callSubject('{"url": "https://learn.microsoft.com/azure"}')).toBe(
      'https://learn.microsoft.com/azure',
    )
  })

  it('skips past arguments that are not strings to the one that is', () => {
    expect(callSubject('{"limit": 5, "recursive": true, "query": "deltas"}')).toBe('deltas')
  })

  // A row that throws is worse than a row with a blank cell, and arguments arrive in fragments
  // while a call is still streaming — a half-arrived object is normal, not an error.
  it('says nothing rather than throwing, whatever it is handed', () => {
    expect(callSubject('')).toBe('')
    expect(callSubject('{}')).toBe('')
    expect(callSubject('{"query": "par')).toBe('')
    expect(callSubject('not json at all')).toBe('')
    expect(callSubject('["query"]')).toBe('')
    expect(callSubject('{"limit": 5}')).toBe('')
    expect(callSubject('{"query": ""}')).toBe('')
  })
})
