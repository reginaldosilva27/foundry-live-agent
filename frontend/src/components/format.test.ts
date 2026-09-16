/**
 * Formatting rules that more than one surface depends on (§4).
 *
 * `modelName` is here because it was not: the rule for shortening a `<connection>/<model>`
 * deployment name lived inside `Sidebar`, so when spec 014 put the model in the trace panel too,
 * the panel rendered the raw name — four wrapped lines of `ai-admin2354ai223634534-project/gpt-5.5`
 * beside a sidebar that said `gpt-5.5`. One fact, two spellings, which is the failure §4 names.
 */
import { describe, expect, it } from 'vitest'
import { formatMs, formatClock, modelName } from './format'

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
