// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')
const rule = (selector: string) => css.split(`\n${selector} {`)[1]?.split('}')[0] ?? ''

// jsdom has no layout: these guard the design declarations; Playwright measures the painted result.
describe('shared chat hierarchy (055, visually superseded by 058)', () => {
  it('shares one width between the reading column and inset composer', () => {
    expect(rule('.main')).toContain('--chat-width: 760px')
    expect(rule('.conversation__inner')).toContain('max-width: var(--chat-width)')
    expect(rule('.composer')).toContain('max-width: var(--chat-width)')
    expect(rule('.composer')).toContain('calc(100% - var(--sp-5) * 2)')
  })
  it('makes examples quiet examples rather than decorative pills', () => {
    expect(rule('.empty')).toContain('text-align: center')
    expect(rule('.empty__suggestions')).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(rule('.chip')).toContain('width: 100%')
    expect(rule('.chip')).toContain('border-radius: var(--r-md)')
  })
  it('distinguishes the neutral question from unboxed answer prose', () => {
    expect(rule('.bubble')).toContain('background: var(--bg-3)')
    expect(rule('.bubble')).toContain('color: var(--fg-1)')
    expect(rule('.bubble__label')).toContain('color: var(--fg-3)')
    expect(rule('.turn__identity')).toContain('font-weight: var(--fw-semibold)')
  })
  it('allows the composer identity to shrink while keeping actions in view', () => {
    expect(rule('.composer__row > .agent-chip')).toContain('min-width: 0')
    expect(rule('.composer__row .agent-chip__button')).toContain('max-width: 100%')
    expect(rule('.composer__actions')).toContain('flex-shrink: 0')
  })
  it('scopes sober controls to the chat header and retains activity', () => {
    expect(rule('.header .pill-button')).toContain('border-radius: var(--r-md)')
    expect(rule('.header .harness-badge')).toContain('border: 0')
    expect(rule('.reasoning-card')).toContain('border: 0')
    expect(rule('.composer__hint')).toContain('color: var(--fg-3)')
  })
})
