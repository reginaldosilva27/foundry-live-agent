// @vitest-environment node
/**
 * Spec 068 — the home screen holds together, and the rail reads at both widths.
 *
 * jsdom lays nothing out, so these assert the declarations, the way `chatPresentation.test.ts`
 * does. What they paint was checked in a browser; the spec's *Evidence* section says where.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const clean = readFileSync(new URL('./app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** A top-level rule's body, anchored at the start of a line. */
const rule = (selector: string) => clean.split(`\n${selector} {`)[1]?.split('}')[0] ?? ''

/** The body of the first block opened by `query`, brace-matched. */
function block(query: string): string {
  const at = clean.indexOf(query)
  if (at === -1) return ''
  const open = clean.indexOf('{', at)
  let depth = 0
  for (let i = open; i < clean.length; i++) {
    if (clean[i] === '{') depth++
    else if (clean[i] === '}' && --depth === 0) return clean.slice(open + 1, i)
  }
  return ''
}

const inBlock = (body: string, selector: string) => body.split(`${selector} {`)[1]?.split('}')[0] ?? ''

/** Whether any rule whose selector list names `selector` declares `declaration`. */
function declares(selector: string, declaration: string): boolean {
  for (const [, selectors, body] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const names = selectors.split(',').map((name) => name.trim())
    if (names.includes(selector) && body.includes(declaration)) return true
  }
  return false
}

const collapsed = (selector: string) => `.sidebar[data-collapsed='true'] ${selector}`

const DESKTOP = '@media (min-width: 761px) and (min-height: 640px)'
const EMPTY_MAIN = '.main:has(> .conversation--empty)'

describe('the empty chat is one centred block on a desktop window (AC1)', () => {
  const desktop = block(DESKTOP)

  it('declares the block in a desktop-and-tall-enough query', () => {
    expect(desktop).not.toBe('')
  })

  it('gives the greeting block a content-sized row between two equal spacers', () => {
    // `minmax(0, auto)` is grown to its content before the `1fr` spacers get anything, so a
    // short window scrolls the greeting rather than splitting the height in half.
    expect(inBlock(desktop, EMPTY_MAIN)).toContain(
      'grid-template-rows: auto minmax(0, 1fr) minmax(0, auto) auto auto minmax(0, 1fr)',
    )
    expect(inBlock(desktop, `${EMPTY_MAIN} > .conversation--empty`)).toContain('grid-row: 3')
    expect(inBlock(desktop, `${EMPTY_MAIN} > .composer`)).toContain('grid-row: 4')
  })

  it('places the voice failure under the composer, not in the spacer above the greeting', () => {
    // `VoiceFailure` renders an `.error-card` as a direct child of `.main`. Left to auto-placement
    // it fell into the first free track — the top spacer — once the block and the composer were
    // pinned. Its own `auto` track is zero high while there is no error.
    expect(inBlock(desktop, `${EMPTY_MAIN} > .error-card`)).toContain('grid-row: 5')
  })

  it('pushes the block down with auto margins, so an overflow still scrolls from its start', () => {
    expect(rule('.conversation--empty')).toContain('flex-direction: column')
    expect(rule('.empty')).toContain('margin-block: auto')
  })
})

describe('everywhere else the composer stays docked (AC2)', () => {
  it('centres only a direct child, so the Playground columns never match', () => {
    expect(clean).not.toContain('.main:has(.conversation--empty)')
    const everywhere = clean.split(EMPTY_MAIN).length
    const inDesktop = block(DESKTOP).split(EMPTY_MAIN).length
    expect(everywhere).toBe(inDesktop)
  })
})

describe('one width for the column, the composer and the home block (AC3)', () => {
  it('raises the shared width to 800px and uses it for the home block too', () => {
    expect(rule('.main')).toContain('--chat-width: 800px')
    expect(rule('.empty')).toContain('max-width: var(--chat-width)')
    expect(rule('.composer')).toContain('max-width: var(--chat-width)')
    expect(rule('.conversation__inner')).toContain('max-width: var(--chat-width)')
  })
})

describe('the collapsed rail (AC5–AC7)', () => {
  it('draws no search field and no history', () => {
    expect(declares(collapsed('.history__search'), 'display: none')).toBe(true)
    expect(declares(collapsed('.history'), 'display: none')).toBe(true)
  })

  it('stacks the brand mark above the expand control', () => {
    expect(declares(collapsed('.sidebar__brand'), 'flex-direction: column')).toBe(true)
  })

  it('draws New session as a circle and the navigation as squares of one size', () => {
    for (const selector of ['.sidebar__new', '.sidebar__nav-item']) {
      expect(declares(collapsed(selector), 'width: 40px'), selector).toBe(true)
      expect(declares(collapsed(selector), 'height: 40px'), selector).toBe(true)
    }
    expect(rule('.sidebar__new')).toContain('border-radius: var(--r-pill)')
  })

  it('keeps the foot, and hides only the language switch in it (AC6)', () => {
    expect(declares(collapsed('.sidebar__foot'), 'display: none')).toBe(false)
    expect(declares(collapsed('.sidebar__lang'), 'display: none')).toBe(true)
    // Alone in the column the theme switch is one more square mark, not a smaller bordered circle.
    expect(declares(collapsed('.sidebar__theme'), 'width: 40px')).toBe(true)
    expect(declares(collapsed('.sidebar__theme'), 'border: 0')).toBe(true)
  })

  it('divides the navigation from the agents and draws the answering agent once (AC7)', () => {
    expect(declares(collapsed('.sidebar__scroll'), 'border-top: 1px solid var(--border-rail)')).toBe(true)
    expect(declares(collapsed(".favourites li:has(> [aria-current='true'])"), 'display: none')).toBe(true)
  })
})

describe('the expanded rail (AC8, AC9)', () => {
  it('lets the search field span the row it sits in', () => {
    expect(rule('.history__search')).toContain('margin: 0 0 var(--sp-2)')
  })

  it('sets the footer as navigation rows, not as mono debug text', () => {
    expect(rule('.sidebar__footer')).toContain('flex-direction: column')
    expect(rule('.sidebar__footer')).toContain('font-family: var(--font-sans)')
    expect(rule('.sidebar__about')).toContain('display: flex')
    expect(rule('.sidebar__about')).toContain('padding: var(--sp-2)')
  })

  it('draws the language options inside one segmented track', () => {
    expect(rule('.sidebar__lang')).toContain('border: 1px solid var(--border-rail)')
    expect(rule('.sidebar__lang')).toContain('border-radius: var(--r-pill)')
    expect(rule('.sidebar__lang-option')).toContain('border: 0')
  })
})

describe('a kept conversation gets the whole row (AC11)', () => {
  it('overlays the row actions instead of reserving their width', () => {
    expect(rule('.history__row')).toContain('position: relative')
    expect(rule('.history__actions')).toContain('position: absolute')
  })

  it('takes no clicks while hidden, so the end of a title never lands on an invisible delete', () => {
    expect(rule('.history__actions')).toContain('opacity: 0')
    expect(rule('.history__actions')).toContain('pointer-events: none')
    expect(declares('.history__row:hover .history__actions', 'pointer-events: auto')).toBe(true)
    expect(declares('.history__row:focus-within .history__actions', 'pointer-events: auto')).toBe(true)
  })

  it('paints the row under the actions whether it is hovered, focused or the one on screen', () => {
    // The actions inherit the row's surface, so a focused row needs one too, or the icons sit on
    // top of the title's text.
    expect(rule('.history__actions')).toContain('background: inherit')
    expect(declares('.history__row:focus-within', 'background: var(--bg-rail-hover)')).toBe(true)
    expect(declares(".history__row:has(> [aria-current='true'])", 'background: var(--bg-rail-current)')).toBe(true)
  })
})

describe('the narrow rail, closed (bug found while checking spec 068 at 390px)', () => {
  it('casts its shadow only while it is open over the conversation', () => {
    // Translated off-canvas, the closed rail still cast `--shadow-4` (24px down, 60px blur), and
    // the blur bled a grey strip down the left edge of every phone screen.
    const narrow = block('@media (max-width: 760px)')
    expect(inBlock(narrow, '.sidebar')).not.toContain('box-shadow')
    expect(inBlock(narrow, ".sidebar[data-overlay='true']")).toContain('box-shadow: var(--shadow-4)')
  })
})
