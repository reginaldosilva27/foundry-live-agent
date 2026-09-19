/**
 * What this browser keeps about itself (spec 036).
 *
 * The assertions worth reading are the ones about *absence*: a language nobody chose must keep
 * being detected rather than defaulting to English, and a browser that refuses storage must still
 * honour a preference for the session.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULTS, applyTheme, readPreferences, usePreferences } from './preferences'
import { KEYS } from './storage'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})
afterEach(() => vi.unstubAllGlobals())

describe('the defaults (AC1)', () => {
  it('follows the system until someone says otherwise', () => {
    expect(readPreferences().theme).toBe('system')
    expect(DEFAULTS.theme).toBe('system')
  })

  it('leaves the language unset, so it is still detected (AC6)', () => {
    // `undefined` and `'en'` are different facts: one means "detect from the browser", which is
    // what the app did before this spec and must keep doing for a reader who never chose.
    expect(readPreferences().lang).toBeUndefined()
  })
})

describe('applying a theme', () => {
  it('writes the attribute the stylesheet keys off', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('removes the attribute for "system", so the media query takes over (AC2)', () => {
    applyTheme('dark')
    applyTheme('system')
    // Not `data-theme="system"` — the stylesheet has no such value, and a CSS media query is the
    // only thing that can track a change made while the app is open.
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})

describe('persisting (AC5)', () => {
  it('keeps a chosen theme and applies it without a reload', () => {
    const { result } = renderHook(() => usePreferences())

    act(() => result.current.set('theme', 'dark'))

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(readPreferences().theme).toBe('dark')
  })

  it('keeps each of the behaviour preferences', () => {
    const { result } = renderHook(() => usePreferences())

    act(() => result.current.set('speakAnswers', true))
    act(() => result.current.set('reasoningOpen', true))
    act(() => result.current.set('activityOpen', true))

    const stored = readPreferences()
    expect([stored.speakAnswers, stored.reasoningOpen, stored.activityOpen]).toEqual([
      true,
      true,
      true,
    ])
  })

  it('keeps a chosen language, and only when one was chosen (AC6)', () => {
    const { result } = renderHook(() => usePreferences())
    expect(readPreferences().lang).toBeUndefined()

    act(() => result.current.set('lang', 'pt'))
    expect(readPreferences().lang).toBe('pt')
  })
})

describe('a browser that refuses storage (AC7)', () => {
  it('still honours the preference for this session, and does not throw', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {},
      clear: () => {},
    })

    const { result } = renderHook(() => usePreferences())
    expect(() => act(() => result.current.set('theme', 'dark'))).not.toThrow()

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(result.current.stored).toBe(false)
  })
})

describe('the key the pre-paint script reads (AC12)', () => {
  const html = readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8')

  it('is the same key the module writes', () => {
    // The one deliberate duplication in this feature: the script runs before any module exists, so
    // it spells the key itself. If the two drift, the first paint silently uses the wrong theme —
    // a bug with no error and no failing behaviour, which is why it is a test.
    expect(html).toContain(KEYS.theme)
  })

  it('sets the attribute the stylesheet and the module both use', () => {
    expect(html).toContain('data-theme')
  })

  it('cannot throw on a blocked origin', () => {
    // A private window throws on the property access, not on the call. An unguarded script here
    // would take the whole page down before the bundle ever loads.
    const script = html.slice(html.indexOf('<script>'), html.indexOf('</script>'))
    expect(script).toContain('try')
    expect(script).toContain('catch')
  })

  it('writes no attribute for "system", leaving the media query in charge', () => {
    const script = html.slice(html.indexOf('<script>'), html.indexOf('</script>'))
    expect(script).toMatch(/'light'|"light"/)
    expect(script).toMatch(/'dark'|"dark"/)
    expect(script).not.toMatch(/setAttribute\([^)]*'system'/)
  })
})
