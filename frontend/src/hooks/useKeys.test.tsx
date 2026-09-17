/**
 * Spec 025 AC1, AC2 — the handler over the binding table.
 *
 * AC2 is the one that matters most and is easiest to lose: a chat application whose `n` fires in
 * the middle of a question is worse than one with no shortcuts at all.
 */
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeys } from './useKeys'
import type { Command } from '../state/keys'

function listening() {
  const ran: Command[] = []
  renderHook(() => useKeys((command) => ran.push(command)))
  return ran
}

function press(init: Partial<KeyboardEvent>) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a', ...init })
  document.dispatchEvent(event)
  return event
}

function focusA(tag: 'input' | 'textarea' | 'button') {
  const element = document.createElement(tag)
  document.body.append(element)
  element.focus()
  return element
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('the shortcut handler', () => {
  it('runs the command a bound key names (AC1)', () => {
    const ran = listening()
    press({ key: '/' })

    expect(ran).toEqual(['focusComposer'])
  })

  it('runs the palette on the modifier chord, from either platform', () => {
    const ran = listening()
    press({ key: 'k', metaKey: true })
    press({ key: 'k', ctrlKey: true })

    expect(ran).toEqual(['openPalette', 'openPalette'])
  })

  it('ignores a key nobody bound', () => {
    const ran = listening()
    press({ key: 'z' })

    expect(ran).toEqual([])
  })

  it('takes the keystroke from the browser when it acts on it', () => {
    listening()
    expect(press({ key: '/' }).defaultPrevented).toBe(true)
  })

  it('leaves a keystroke it does not act on alone', () => {
    listening()
    expect(press({ key: 'z' }).defaultPrevented).toBe(false)
  })
})

describe('while the reader is typing (AC2)', () => {
  it('fires no bare-letter binding into a text input', () => {
    const ran = listening()
    focusA('input')
    press({ key: 'n' })
    press({ key: '/' })
    press({ key: 't' })

    expect(ran).toEqual([])
  })

  it('fires none into the composer, which is a textarea since spec 023', () => {
    const ran = listening()
    focusA('textarea')
    press({ key: 'n' })

    expect(ran).toEqual([])
  })

  it('leaves the keystroke alone so the character is actually typed', () => {
    listening()
    focusA('textarea')

    expect(press({ key: 'n' }).defaultPrevented).toBe(false)
  })

  it('still opens the palette, which is the one binding that may interrupt typing', () => {
    const ran = listening()
    focusA('textarea')
    press({ key: 'k', metaKey: true })

    expect(ran).toEqual(['openPalette'])
  })

  it('fires normally once focus is somewhere that is not a field', () => {
    const ran = listening()
    focusA('button')
    press({ key: 'n' })

    expect(ran).toEqual(['newConversation'])
  })
})
