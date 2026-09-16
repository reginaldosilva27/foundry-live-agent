/**
 * Spec 021 AC20 — a browser that refuses storage is a supported browser.
 *
 * Every failure mode here is real and none of them throws in a way a component could catch
 * usefully: a private window raises on `setItem`, a blocked origin raises on the *property access*,
 * and a half-written value parses as nothing. One module absorbs all three so no caller has to.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { available, readJson, remove, writeJson } from './storage'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('readJson', () => {
  it('returns what was written', () => {
    writeJson('k', { a: 1 })
    expect(readJson('k', null)).toEqual({ a: 1 })
  })

  it('falls back when the key is absent', () => {
    expect(readJson('missing', 'fallback')).toBe('fallback')
  })

  it('falls back on a malformed value rather than throwing', () => {
    localStorage.setItem('k', '{not json')
    expect(readJson('k', 'fallback')).toBe('fallback')
  })

  it('falls back when the accessor itself throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(readJson('k', 'fallback')).toBe('fallback')
  })
})

describe('writeJson', () => {
  it('reports success', () => {
    expect(writeJson('k', 1)).toBe(true)
  })

  it('reports failure instead of raising when the quota is gone', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(writeJson('k', 1)).toBe(false)
  })
})

describe('remove', () => {
  it('drops the key, and stays quiet when it cannot', () => {
    writeJson('k', 1)
    remove('k')
    expect(readJson('k', null)).toBeNull()

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(() => remove('k')).not.toThrow()
  })
})

describe('available', () => {
  it('is true in a browser that stores, false in one that refuses', () => {
    expect(available()).toBe(true)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(available()).toBe(false)
  })

  it('leaves nothing behind when it probes', () => {
    available()
    expect(localStorage.length).toBe(0)
  })
})
