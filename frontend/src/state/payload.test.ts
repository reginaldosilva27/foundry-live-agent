/** Spec 010 AC3, AC4 — formatting a payload for reading, without ever changing it. */
import { describe, expect, it } from 'vitest'
import { formatPayload } from './payload'

describe('formatPayload', () => {
  it('indents JSON so the structure is visible (AC3)', () => {
    const formatted = formatPayload('{"iso":"2026-09-15T13:53:00-03:00","timezone":"America/Sao_Paulo"}')

    expect(formatted.split('\n').length).toBeGreaterThan(2)
    expect(formatted).toContain('"timezone": "America/Sao_Paulo"')
    // Still the same document, not a rewritten one.
    expect(JSON.parse(formatted)).toEqual({
      iso: '2026-09-15T13:53:00-03:00',
      timezone: 'America/Sao_Paulo',
    })
  })

  it('indents nested structures too', () => {
    expect(formatPayload('{"results":[{"title":"Agents"}]}')).toContain('      "title": "Agents"')
  })

  it('leaves a payload that is not JSON exactly as it came (AC4)', () => {
    // §5: the reader shows what the tool returned. Guessing a shape and reformatting around it
    // would be showing something else.
    const prose = 'Foundry answered:  not-json\n\n  with its own spacing '
    expect(formatPayload(prose)).toBe(prose)
  })

  it('leaves a bare JSON scalar alone rather than dressing it up', () => {
    expect(formatPayload('"just a string"')).toBe('"just a string"')
    expect(formatPayload('42')).toBe('42')
  })

  it('survives an empty payload', () => {
    expect(formatPayload('')).toBe('')
  })
})
