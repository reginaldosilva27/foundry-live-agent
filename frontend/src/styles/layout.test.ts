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

  it('caps the shell at the viewport so the conversation is what scrolls', () => {
    // Without this the grid's implicit row is `auto`, `.main` refuses to shrink below its content
    // (grid items default to `min-height: auto`), and the DOCUMENT scrolls instead — which
    // `body { overflow: hidden }` then makes impossible to scroll back, because it blocks the
    // user and not `scrollIntoView`. Measured in a real browser: document.scrollTop 382.5,
    // `.app` at top: -382.5, `.conversation` scrollHeight === clientHeight.
    const app = css.split('.app {')[1].split('}')[0]
    expect(app).toMatch(/grid-template-rows:\s*minmax\(0, 1fr\)/)

    const main = css.split('.main {')[1].split('}')[0]
    expect(main).toContain('min-height: 0')
  })

  it('turns the trace panel into an overlay below the breakpoint', () => {
    const breakpoint = css.split('@media (max-width: 1100px)')[1]
    expect(breakpoint).toBeDefined()
    expect(breakpoint).toContain('position: fixed')
  })

  it('scrolls the voice conversation inside the card, not the card itself (spec 007, AC6)', () => {
    // A long answer — or one tool result — used to scroll the whole card, carrying Mute and End
    // session off the bottom. The scrolling region is the body, so the controls stay put.
    const body = css.split('.voice-card__body {')[1].split('}')[0]
    expect(body).toContain('overflow-y: auto')
    expect(body).toContain('min-height: 0')

    const card = css.split('.voice-card {')[1].split('}')[0]
    expect(card).not.toContain('overflow-y: auto')
    expect(card).toContain('max-height')
  })

  it('writes no colour of its own — every value comes from a design-system token', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

/**
 * Regressions in the stylesheet itself.
 *
 * Both of these are failure modes CSS has no compiler for: a misspelled custom property is not an
 * error, it is a declaration the browser drops silently, and a missing focus ring is invisible to
 * everyone who reaches the control with a mouse.
 */
describe('app.css regressions', () => {
  it('names only custom properties the design system actually defines', () => {
    // `--dur-2` sat in `.tool-row`'s transition for three specs. The token set is
    // `--dur-fast|base|slow`, so the declaration parsed, resolved to nothing, and the hover
    // transition never ran.
    const tokens = readFileSync(
      join(import.meta.dirname, '..', '..', 'public', 'ds', 'colors_and_type.css'),
      'utf8',
    )
    const defined = new Set(tokens.match(/^\s*(--[a-z0-9-]+)/gm)?.map((m) => m.trim()) ?? [])
    const declared = new Set(css.match(/^\s*(--[a-z0-9-]+):/gm)?.map((m) => m.trim().slice(0, -1)) ?? [])
    // A property with a fallback — `var(--bar, 0%)` — is one the stylesheet knows comes from
    // somewhere else, which is how spec 014 hands the duration bar its width from React. Without
    // the fallback there is no way to tell that from a typo, so the rule is: if the stylesheet
    // does not define it, it must say what to do without it.
    const used = new Set(css.match(/var\((--[a-z0-9-]+)\s*\)/g)?.map((m) => m.slice(4, -1).trim()) ?? [])

    expect([...used].filter((name) => !defined.has(name) && !declared.has(name))).toEqual([])
  })

  it('draws a focus ring on every control a keyboard can reach', () => {
    // The app's controls carry their own backgrounds — Dataside blue, ink, transparent-on-ink —
    // and the user-agent ring is all but invisible against them. Without these rules, tabbing
    // through the app shows nothing at all.
    const focusable = [
      '.pill-button',
      '.tool-row',
      '.chip',
      '.sidebar__new',
      '.sidebar__lang-option',
      '.trace__close',
      '.log__close',
      '.meta-line__link',
      '.reasoning-card__toggle',
      '.composer__send',
      // Spec 014 added these two.
      '.copy-row__button',
      '.trace__turn-step',
    ]
    const ringed = css.match(/^[^{}]*:focus-visible[^{}]*\{/gm)?.join('\n') ?? ''

    expect(focusable.filter((selector) => !ringed.includes(selector))).toEqual([])
  })
})

/** Spec 014 AC9 — the calls align, in every surface that renders one. */
describe('the tool row grid', () => {
  it('declares fixed columns so the executor tags line up down the list', () => {
    const row = css.split('.tool-row {')[1].split('}')[0]

    expect(row).toContain('display: grid')
    expect(row).toMatch(/grid-template-columns:/)
    // The name column is the one that flexes; every other column is sized by its content, which
    // is what makes two rows with different name lengths agree on where the tag starts.
    expect(row).toMatch(/grid-template-columns:[^;]*1fr/)
  })

  it('keeps the bar out of the row height when a call has no duration', () => {
    // The chat renders rows for MCP calls, which never carry one. If the bar reserved a row in
    // the grid, every one of those would gain its height for nothing.
    const bar = css.split('.tool-row__bar {')[1].split('}')[0]
    expect(bar).toMatch(/grid-(column|area)/)
  })
})
