/**
 * Spec 004 AC1, AC12 — the layout rules exist and the breakpoint does what it claims.
 *
 * jsdom applies no stylesheet, so this reads the rules rather than measuring them. That is a real
 * limitation and worth naming: it proves the three-column grid and the overlay breakpoint are
 * declared, not that a browser painted them. The screenshots in `docs/assets/` are the evidence
 * for the second thing.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(import.meta.dirname, 'app.css'), 'utf8')

describe('app.css', () => {
  it('lays the shell out as sidebar, main column and trace panel', () => {
    expect(css).toMatch(/\.app\s*\{[^}]*grid-template-columns:\s*248px minmax\(0, 1fr\) 320px/)
  })

  it('turns the trace panel into an overlay below the breakpoint', () => {
    const breakpoint = css.split('@media (max-width: 1100px)')[1]
    expect(breakpoint).toBeDefined()
    expect(breakpoint).toContain('position: fixed')
  })

  it('scrolls the voice transcript inside the card, not the card itself (spec 007, AC6)', () => {
    // A long answer used to scroll the whole card, carrying Mute and End session off the bottom.
    const transcript = css.split('.voice-transcript {')[1].split('}')[0]
    expect(transcript).toContain('overflow-y: auto')

    const card = css.split('.voice-card {')[1].split('}')[0]
    expect(card).not.toContain('overflow-y: auto')
    expect(card).toContain('max-height')
  })

  it('writes no colour of its own — every value comes from a design-system token', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
