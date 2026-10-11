// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')
const rule = (selector: string) => css.split(`\n${selector} {`)[1]?.split('}')[0] ?? ''

describe('spec 058 restrained conversational layout', () => {
  it('lets comparison notices shrink instead of widening a 320px viewport', () => {
    expect(rule('.compare__head')).toContain('min-width: 0')
    expect(rule('.compare__pick')).toContain('flex-wrap: wrap')
    expect(rule('.compare__select')).toContain('max-width: 100%')
  })
  it('centers spacious prose without a decorative avatar gutter', () => {
    expect(rule('.main')).toContain('--chat-width: 760px')
    expect(rule('.turn')).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(rule('.turn__avatar')).toContain('display: none')
    expect(rule('.turn__identity')).toContain('color: var(--fg-3)')
    expect(rule('.bubble')).toContain('border: 0')
    expect(rule('.bubble')).toContain('border-radius: var(--r-lg)')
  })
  it('integrates input and actions in a broad rounded composer', () => {
    expect(rule('.composer')).toContain('border-radius: var(--r-lg)')
    expect(rule('.composer')).toContain('padding: var(--sp-4)')
    expect(rule('.composer__input')).toContain('min-height: 80px')
    expect(rule('.composer__row .agent-chip__button')).toContain('background: transparent')
  })
  it('quiets chrome and observation without removing their controls', () => {
    expect(rule('.header')).toContain('background: transparent')
    expect(rule('.header .pill-button')).toContain('background: transparent')
    expect(rule('.header .pill-button')).toContain('padding: var(--sp-2)')
    expect(rule('.reasoning-card')).toContain('border: 0')
    expect(rule('.tool-row')).toContain('background: transparent')
    expect(rule('.sidebar__new')).toContain('background: transparent')
  })
  it('centers the welcome and lays definition-sourced examples out compactly', () => {
    expect(rule('.empty')).toContain('text-align: center')
    expect(rule('.empty__suggestions')).toContain('display: grid')
    expect(rule('.empty__suggestions')).toContain('repeat(2, minmax(0, 1fr))')
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.empty__suggestions\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/)
  })
})
