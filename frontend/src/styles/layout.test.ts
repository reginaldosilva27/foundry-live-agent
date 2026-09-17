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
    // The rail's width is a custom property so spec 021's collapse is one declaration rather than a
    // boolean threaded down to a column width. The three columns are still the contract.
    expect(css).toMatch(/\.app\s*\{[^}]*--rail:\s*248px/)
    expect(css).toMatch(/grid-template-columns:\s*var\(--rail\) minmax\(0, 1fr\) 320px/)
    expect(css).toMatch(/\.app:has\(\.sidebar\[data-collapsed='true'\]\)\s*\{[^}]*--rail:\s*64px/)
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

  /**
   * Spec 021 AC25 — two regions that must scroll inside themselves.
   *
   * This is the defect the spec opens on: the agent list grew with the project and pushed the
   * language switch and the footer off the bottom of the rail. A flex child refuses to shrink below
   * its content without `min-height: 0`, so the rule is only half-written without it.
   *
   * 021 put that overflow on `.history__list`, which is one list **per age group**: with `Today`,
   * `Last 7 days` and `Older` on screen the three lists each scrolled inside a region that could
   * still not shrink, and the rail painted straight over the language switch and the footer —
   * measured in Chrome at 1440x900 with seven conversations stored. The whole middle of the rail
   * is one scrolling region now, so there is exactly one place for the overflow to live.
   */
  it('scrolls the history inside the rail, and the agents screen inside the main column', () => {
    const rail = css.split('.sidebar__scroll {')[1].split('}')[0]
    expect(rail).toContain('overflow-y: auto')
    expect(rail).toContain('min-height: 0')

    const screen = css.split('.agents-screen {')[1].split('}')[0]
    expect(screen).toContain('overflow-y: auto')
    expect(screen).toContain('min-height: 0')
  })

  /**
   * The rail reads as one list, so it is drawn with one set of metrics: every row in it — a view,
   * a favourite, a conversation, the agent that is answering — starts its label at the same x.
   * Divergent paddings are what made the column look like four stacked widgets.
   */
  it('gives every row in the rail the same inset', () => {
    // Anchored at the start of a line: `.answering {` is a substring of the collapsed rail's
    // `.sidebar[data-collapsed='true'] .answering {`, and a naive split reads that one instead.
    const rule = (selector: string) =>
      css.match(new RegExp(`^\\${selector} \\{([^}]*)\\}`, 'm'))![1]

    for (const selector of ['.sidebar__nav-item', '.favourites__row', '.history__open', '.answering']) {
      expect(rule(selector)).toMatch(/padding: var\(--sp-2\);/)
    }
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
      // Spec 021 added the rail's navigation, the cards and the two new menus.
      '.sidebar__nav-item',
      '.sidebar__collapse',
      '.history__open',
      '.agent-card__choose',
      '.agent-chip__button',
      '.agent-chip__item',
      '.answer-actions__button',
      // Spec 022.
      '.agent-card__star',
      '.favourites__row',
    ]
    const ringed = css.match(/^[^{}]*:focus-visible[^{}]*\{/gm)?.join('\n') ?? ''

    expect(focusable.filter((selector) => !ringed.includes(selector))).toEqual([])
  })
})

/** Spec 014 AC9 — the calls align, in every surface that renders one. */
describe('the tool row grid', () => {
  it('gives the tag and duration columns a floor, so rows align across the list', () => {
    const row = css.split('.tool-row {')[1].split('}')[0]

    expect(row).toContain('display: grid')
    // Each row is its own grid container, so `auto` tracks cannot align between rows: sized to
    // their own content, a `bff` tag and a `microsoft_learn` tag start at different x, and an MCP
    // call — which carries no duration — lets its tag slide into the empty duration column. A
    // minimum on both tracks is what actually makes the columns agree down the list. Measured in
    // a browser before and after; jsdom applies no stylesheet, so this reads the rule.
    const columns = row.match(/grid-template-columns:([^;]*)/)![1]
    expect(columns).toMatch(/1fr/)
    // Two floored tracks: the tag and the duration. The floors are custom properties so the 320px
    // trace panel can lower them — at the chat's floors, `lookup_knowledge` wraps to four lines in
    // there — which is why this looks for the fallback rather than a literal length.
    expect(columns.match(/minmax\(var\(--(?:tag|dur)-col,\s*[\d.]+rem\)/g) ?? []).toHaveLength(2)
  })

  it('lowers those floors inside the trace panel, which is 320px wide', () => {
    const panel = css.split('.trace__activity .tool-row {')[1].split('}')[0]
    expect(panel).toMatch(/--tag-col:/)
    expect(panel).toMatch(/--dur-col:/)
    // The ordinal's floor too: measured in a browser, keeping it cost `lookup_knowledge` its last
    // characters in a 320px column — an aligned number is not worth an unreadable name.
    expect(panel).toMatch(/--step-col:\s*0/)
  })

  // Spec 015 AC4. The subject is the one cell whose length nobody controls — a Learn URL or a
  // sentence-long query — and it shares the `1fr` track with the tool name. Left to itself it would
  // push the executor column, the one carrying §8, off its x on that row alone: exactly the
  // misalignment 014 AC9 was written to stop.
  it('truncates what a call asked for instead of letting it move the columns', () => {
    const subject = css.split('.tool-row__subject {')[1].split('}')[0]

    expect(subject).toContain('overflow: hidden')
    expect(subject).toMatch(/text-overflow:\s*ellipsis/)
    expect(subject).toMatch(/white-space:\s*nowrap/)

    // A grid track only truncates if it is allowed to shrink below its content.
    const name = css.split('.tool-row__name {')[1].split('}')[0]
    expect(name).toMatch(/min-width:\s*0/)
  })

  // A tool name is an identifier: `lookup_knowledge` broken across lines as `lookup_kn / owledge`
  // is not a shorter name, it is an unreadable one. Reported from the running app, where the name
  // shared a flex track with the subject, inherited `overflow-wrap: anywhere`, and was shredded one
  // character per line inside the 320px trace panel.
  it('never breaks a tool name mid-word', () => {
    const name = css.split('.tool-row__name {')[1].split('}')[0]
    expect(name).not.toContain('overflow-wrap')

    const tool = css.split('.tool-row__tool {')[1].split('}')[0]
    expect(tool).toMatch(/white-space:\s*nowrap/)
    // Not wrapped, but not overflowing either: at 320px a nowrapped name that cannot shrink paints
    // itself straight across the executor badge, which a browser showed and this file cannot.
    expect(tool).toMatch(/text-overflow:\s*ellipsis/)
    expect(tool).toMatch(/min-width:\s*0/)

    // The subject takes what is left over rather than squeezing the name for room.
    const subject = css.split('.tool-row__subject {')[1].split('}')[0]
    expect(subject).toMatch(/flex:\s*1 1 0/)
  })

  it('gives the subject a line of its own where the column is too narrow to share one', () => {
    // 320px, minus the tag and duration rails, is not enough for a name and a query side by side —
    // the two just take turns being ellipsised. The panel stacks them instead. It has to be a flex
    // wrap and not `grid-column: 1 / -1`: the subject is a child of the name's cell, not of the
    // row's grid, so a grid placement on it is inert. jsdom lays nothing out, so that mistake
    // passed a test before a browser showed it.
    const name = css.split('.trace__activity .tool-row__name {')[1].split('}')[0]
    expect(name).toMatch(/flex-wrap:\s*wrap/)

    const subject = css.split('.trace__activity .tool-row__subject {')[1].split('}')[0]
    expect(subject).toMatch(/flex-basis:\s*100%/)
  })

  it('gives the ordinal a floor of its own, like every other fixed column', () => {
    const columns = css.split('.tool-row {')[1].split('}')[0].match(/grid-template-columns:([^;]*)/)![1]

    expect(columns).toMatch(/minmax\(var\(--step-col,\s*[\d.]+rem\)/)
  })

  it('keeps the bar out of the row height when a call has no duration', () => {
    // The chat renders rows for MCP calls, which never carry one. If the bar reserved a row in
    // the grid, every one of those would gain its height for nothing.
    const bar = css.split('.tool-row__bar {')[1].split('}')[0]
    expect(bar).toMatch(/grid-(column|area)/)
  })
})
