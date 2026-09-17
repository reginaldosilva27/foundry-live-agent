/**
 * Spec 025 AC1, AC2 — the bindings, as data.
 *
 * One table is the whole feature: the handler reads it, the palette labels itself from it, and the
 * tooltips say what it says. A second list of keys anywhere is the §4 failure this spec is most
 * likely to commit, so the last test here goes looking for one.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BINDINGS, isFieldFocused, matchBinding } from './keys'

/** What the browser claims above the page, and therefore what the app must never bind. */
const RESERVED = [
  { key: 'n', meta: true, shift: true }, // new incognito window
  { key: 'w', meta: true, shift: false }, // close tab
  { key: 't', meta: true, shift: false }, // new tab
  { key: 'q', meta: true, shift: false }, // quit
]

describe('the binding table', () => {
  it('names a command for every binding', () => {
    for (const binding of BINDINGS) {
      expect(binding.command).toBeTruthy()
      expect(binding.label).toBeTruthy()
    }
  })

  it('binds no chord the browser captures above the page', () => {
    for (const binding of BINDINGS) {
      for (const reserved of RESERVED) {
        const clash =
          binding.key.toLowerCase() === reserved.key &&
          Boolean(binding.modifier) === reserved.meta &&
          Boolean(binding.shift) === reserved.shift
        expect(clash, `${binding.command} collides with a browser shortcut`).toBe(false)
      }
    }
  })

  it('gives every unmodified binding the no-field guard, or it would fire while typing', () => {
    for (const binding of BINDINGS.filter((b) => !b.modifier)) {
      expect(binding.whenTyping, `${binding.command} must not fire while typing`).toBe(false)
    }
  })

  it('has no two bindings on the same combination', () => {
    const seen = BINDINGS.map((b) => `${b.modifier ? 'mod+' : ''}${b.shift ? 'shift+' : ''}${b.key}`)
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('matchBinding', () => {
  const press = (init: Partial<KeyboardEvent>) =>
    new KeyboardEvent('keydown', { key: 'a', ...init })

  it('does not claim Escape, which every overlay already owns for itself', () => {
    expect(BINDINGS.some((b) => b.key === 'Escape')).toBe(false)
  })

  it('finds the palette on the modifier chord, on either platform', () => {
    expect(matchBinding(press({ key: 'k', metaKey: true }))?.command).toBe('openPalette')
    expect(matchBinding(press({ key: 'k', ctrlKey: true }))?.command).toBe('openPalette')
  })

  it('does not find it without the modifier', () => {
    expect(matchBinding(press({ key: 'k' }))?.command).not.toBe('openPalette')
  })

  it('finds the composer on a bare slash', () => {
    expect(matchBinding(press({ key: '/' }))?.command).toBe('focusComposer')
  })

  it('finds nothing for a key nobody bound', () => {
    expect(matchBinding(press({ key: 'z' }))).toBeUndefined()
  })
})

describe('isFieldFocused', () => {
  const focus = (element: HTMLElement) => {
    document.body.append(element)
    element.focus()
    return element
  }

  it('reports a text input', () => {
    focus(document.createElement('input'))
    expect(isFieldFocused()).toBe(true)
  })

  it('reports a textarea — which the composer is since spec 023', () => {
    focus(document.createElement('textarea'))
    expect(isFieldFocused()).toBe(true)
  })

  it('reports a contenteditable', () => {
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    focus(editable)
    expect(isFieldFocused()).toBe(true)
  })

  it('does not report a button, or nothing at all', () => {
    const button = focus(document.createElement('button'))
    expect(isFieldFocused()).toBe(false)
    button.blur()
    expect(isFieldFocused()).toBe(false)
  })
})

/**
 * The §4 guard: one home for the keys the table owns.
 *
 * `Escape` is not one of them and is not scanned for. It already has four owners, each closing the
 * thing the reader is in — the payload reader, the modal focus hook, the agent chip's menu, the
 * history rename — and that is component behaviour, not an app-wide command. A global `Escape`
 * would collide with all four, which is why the table does not carry it.
 */
describe('the table is the only place its keys are named', () => {
  it('finds no key literal anywhere else', () => {
    const named = /['"](?:ArrowLeft|ArrowRight)['"]/
    const offenders = sources()
      .filter(([path]) => path !== 'state/keys.ts')
      .filter(([, text]) => named.test(text))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })
})

function sources(): [string, string][] {
  const root = join(import.meta.dirname, '..')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry)
      return statSync(path).isDirectory() ? walk(path) : [path]
    })

  return walk(root)
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => [path.slice(root.length + 1), readFileSync(path, 'utf8')])
}
