/**
 * Contrast, computed (spec 040, AC11).
 *
 * Arithmetic on the tokens, not an opinion about them. The semantic text-on-surface pairs are
 * resolved out of the design system and checked against WCAG's formula in **both** palettes,
 * because spec 036 shipped a second one and a dark theme is selected rather than inherited.
 *
 * **This is not a conformance claim.** It is these pairs, at this ratio, asserted — which is a
 * measurement (§5). Saying "the app is AA" would be a claim nobody has measured.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DS = readFileSync(join(import.meta.dirname, '..', '..', 'public', 'ds', 'colors_and_type.css'), 'utf8')
const APP = readFileSync(join(import.meta.dirname, 'app.css'), 'utf8')

/** Every `--name: #hex` in the design system: the ramp, which is where literals live. */
function ramp(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [, name, hex] of DS.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)) out[name] = hex
  return out
}

/** The semantic layer for one theme: `--fg-2: var(--ds-n-700)` resolved to a hex. */
function semantic(block: string, base: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...base }
  for (const [, name, ref] of block.matchAll(/(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)/g)) {
    if (base[ref]) out[name] = base[ref]
  }
  return out
}

/** The `:root[data-theme='dark']` declarations — the explicit dark choice. */
function darkBlock(): string {
  const start = APP.indexOf(":root[data-theme='dark'] {")
  return APP.slice(start, APP.indexOf('}', start))
}

/**
 * The light mapping: the vendored file's `:root`, **plus** `app.css`'s own.
 *
 * Light is the base declaration and mostly lives in the design system. A token this app adds for
 * itself is declared in `app.css` beside the dark override that answers it, so both halves have to
 * be read here or the light half of such a pair resolves to nothing and its assertion passes
 * vacuously.
 */
function lightBlock(): string {
  const start = DS.indexOf(':root')
  const vendored = DS.slice(start, DS.indexOf('/* ---- Typography', start))
  const ours = APP.indexOf('\n:root {')
  return vendored + (ours === -1 ? '' : APP.slice(ours, APP.indexOf('}', ours)))
}

function srgb(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Body text and above. `--fg-4` is placeholder and disabled text, which WCAG exempts. */
const PAIRS: [string, string][] = [
  ['--fg-1', '--bg-1'],
  // The harness name in the header. It was `--ds-blue-700` — a ramp step, fine on white at 5.90
  // and **2.70 on the dark surface**, because a ramp step does not move when the theme does. Now a
  // token with a mapping in each theme, so this pair is checked in both.
  ['--fg-harness', '--bg-1'],
  // Spec 046 AC2. The one surface in the app that is a saturated colour, and until now the only
  // one no pair covered: the send button, the monograms, the user's own bubbles, the skip link.
  // White on the fill it had measured 4.25:1 in light and 3.22:1 in dark.
  ['--fg-on-inverse', '--bg-accent-strong'],
  // A link is content, and `--fg-link` is a semantic text token like any other — it was simply
  // never paired. The browser sweep found `view trace` at 4.06:1 on `--bg-2` in light, which is
  // what AC8 exists to catch: a token the pairs did not think to name.
  ['--fg-link', '--bg-1'],
  ['--fg-link', '--bg-2'],
  ['--fg-link', '--bg-3'],
  ['--fg-1', '--bg-2'],
  ['--fg-2', '--bg-1'],
  ['--fg-2', '--bg-2'],
  ['--fg-3', '--bg-1'],
  ['--fg-3', '--bg-2'],
]

/**
 * The surface those pairs are checked against has to be the surface the app paints.
 *
 * Measured in a real browser at `data-theme='dark'`: `.main` computed to `rgb(248, 250, 252)` while
 * `--fg-1` computed to `#FFFFFF` — the answer text at **1.05:1**, on the primary reading surface of
 * every screen. The pairs above were green throughout, because `.main` named `--ds-n-50`, a step on
 * the neutral **ramp**, and a ramp step does not move when the theme does. Only the semantic layer
 * (`--bg-*`, `--fg-*`) is redeclared for dark.
 *
 * `layout.test.ts` did not catch it either: its rule is that `app.css` names tokens and never
 * values, and `--ds-n-50` *is* a token — the wrong kind.
 *
 * The rail and the panels that deliberately stay dark in both themes still name ramp steps, and
 * that is correct (spec 036: the rail does not invert). This is about the surfaces that must.
 */
/**
 * The rail does not invert (spec 036): it is `--ds-ink` in both themes, so text on it correctly
 * names a step on the ramp rather than a semantic token. The steps chosen were unreadable.
 *
 * Measured in a browser, identically in both themes, because the surface is the same in both:
 * `.sidebar__key` at **1.57:1** and five more at **2.46:1** — the section titles, the transport and
 * gateway lines in the footer, and the history note. `contrast.test.ts` could not see them because
 * they are not semantic pairs, and spec 040's sweep was over the semantic layer.
 *
 * This is the whole family, listed rather than pattern-matched: a selector that renders on the rail
 * is a fact about the markup, not something a regex over the stylesheet can decide.
 */
/**
 * Spec 046 AC3 — the quietest ink may only be worn by text WCAG actually exempts.
 *
 * This is the assertion the spec exists to leave behind. `--fg-4` was held to 3:1 on the strength
 * of a comment saying it "carries captions, placeholders and disabled text" — but WCAG's exemption
 * is for *disabled controls*, and the comment quietly widened it to captions. Sixty-four selectors
 * had accumulated on it, one spec at a time: five genuinely disabled or placeholder, and
 * **fifty-nine carrying content a reader is meant to read** — a turn's cost, where an answer came
 * from, the About panel's field names, a chart's axis labels.
 *
 * The ratios were always computable. What no test could see was the drift, because the exemption
 * lived in prose. So this is an allowlist: a sixtieth content selector reaching for `--fg-4` fails
 * CI, and a genuinely disabled one is added here, where a reviewer sees it.
 */
describe('who may wear the quietest ink', () => {
  /** States WCAG exempts: a disabled control, and text that is not content but a prompt. */
  const EXEMPT = /(:disabled|::placeholder|\[data-runnable='false'\]|\[aria-disabled='true'\])/

  /**
   * Every selector in `app.css` that paints text with `--fg-4`.
   *
   * `fill` counts, not just `color`: SVG text takes its colour from `fill`, and the first version
   * of this scan missed `.chart__axis-label` for exactly that reason — a chart's axis labels, at
   * 8px, which is the worst case in the whole sweep and the example the spec opens on.
   */
  function wearers(): string[] {
    const out: string[] = []
    let selector = ''
    for (const line of APP.split('\n')) {
      const opened = /^([.\w#[][^{]*)\{\s*$/.exec(line)
      if (opened) selector = opened[1].trim()
      if (/^\s*(color|fill):\s*var\(--fg-4\)/.test(line)) out.push(selector)
    }
    return out
  }

  it('found the rules, so a passing run means something', () => {
    expect(wearers().length).toBeGreaterThan(0)
  })

  it('is worn only by disabled or placeholder text', () => {
    const content = wearers().filter((selector) => !EXEMPT.test(selector))
    expect(content, `these carry content and must use --fg-3: ${content.join(', ')}`).toEqual([])
  })
})

/**
 * Spec 048 AC5 — the focus ring against the surfaces it is drawn on.
 *
 * **3:1, not 4.5:1.** A focus indicator is a non-text element, and WCAG 1.4.11 sets 3:1 for it.
 * Holding it to the text bar would be inventing a stricter rule than the one being cited, which is
 * the opposite of what this repository spends its honesty on.
 *
 * Two colours, because the rail and the trace panel are ink in both themes and the accent blue is
 * the same hue as their neighbours there: `--fg-focus` is the default, redeclared on those two
 * surfaces to the lighter step.
 */
describe('the focus ring', () => {
  const base = ramp()
  const light = semantic(lightBlock(), base)
  const dark = semantic(darkBlock(), light)

  /** The ring on an ordinary surface, per theme, and on the ink the deep surfaces are. */
  const CASES: [string, string, string][] = [
    ['default ring on --bg-1', '--fg-focus', '--bg-1'],
    ['default ring on --bg-2', '--fg-focus', '--bg-2'],
    ['default ring on --bg-3', '--fg-focus', '--bg-3'],
  ]

  it('resolved the token, so the assertions below are not vacuous', () => {
    expect(light['--fg-focus'], 'light').toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(dark['--fg-focus'], 'dark').toMatch(/^#[0-9a-fA-F]{3,8}$/)
  })

  it.each(CASES)('%s meets 3:1 in light', (_label, fg, bg) => {
    expect(ratio(light[fg], light[bg])).toBeGreaterThanOrEqual(3)
  })

  it.each(CASES)('%s meets 3:1 in dark', (_label, fg, bg) => {
    expect(ratio(dark[fg], dark[bg])).toBeGreaterThanOrEqual(3)
  })

  it('separates on the ink of the rail and the trace panel, in both themes', () => {
    // Those two surfaces redeclare `--fg-focus` to the lighter step precisely because the default
    // accent does not separate there. This is the assertion that says so in numbers.
    const onInk = base['--ds-blue-500']
    expect(ratio(onInk, base['--ds-ink'])).toBeGreaterThanOrEqual(3)
  })
})

describe('text on the rail', () => {
  const base = ramp()
  const INK = base['--ds-ink']

  /** Every selector whose text is painted on the rail, with the ramp step it declares. */
  const ON_THE_RAIL = [
    '.sidebar__section-title',
    '.sidebar__note',
    // `.sidebar__transport` declares no colour of its own and inherits this one, which is how it
    // reached 2.46:1 while its own rule looked innocent.
    '.sidebar__footer',
    '.sidebar__about',
    '.history__note',
  ]

  it('resolved the ink, so the assertions below are not vacuous', () => {
    expect(INK).toMatch(/^#[0-9a-fA-F]{3,8}$/)
  })

  it.each(ON_THE_RAIL)('%s is readable on the ink', (selector) => {
    const rule = APP.split(`\n${selector} {`)[1]
    expect(rule, `${selector} has no rule in app.css`).toBeDefined()

    const declared = /color:\s*var\((--[a-z0-9-]+)\)/.exec(rule.split('}')[0])
    expect(declared, `${selector} declares no colour`).not.toBeNull()

    const hex = base[declared![1]]
    expect(hex, `${declared![1]} is not a ramp step`).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(ratio(hex, INK)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('the surface the app actually paints', () => {
  it('gives the main column a semantic background, not a step on the ramp', () => {
    const rule = APP.split('\n.main {')[1].split('}')[0]
    const background = /background:\s*var\((--[a-z0-9-]+)\)/.exec(rule)

    expect(background, '.main declares no background at all').not.toBeNull()
    expect(background![1]).toMatch(/^--bg-/)
  })

  /**
   * The same bug, one level down, and in the vendored file: `code, .ds-code` declares
   * `background: var(--ds-n-100)` with `color: var(--fg-1)` — a fixed ramp step under a foreground
   * that moves. Measured in dark: **white on #F2F4F8, 1.10:1**, so every inline `code` span in an
   * answer was a white block.
   *
   * The vendored sheet is not edited (spec 036: colour literals live there and nowhere else), so
   * `app.css` overrides the surface with the semantic token. Light `--bg-3` *is* `--ds-n-100`, so
   * nothing moves there.
   */
  it('gives inline code a semantic background too', () => {
    const rule = APP.split('\ncode,\n.ds-code {')[1]
    expect(rule, 'app.css does not override the vendored code chip').toBeDefined()

    const background = /background:\s*var\((--[a-z0-9-]+)\)/.exec(rule.split('}')[0])
    expect(background, 'the override sets no background').not.toBeNull()
    expect(background![1]).toMatch(/^--bg-/)
  })
})

describe('text on its surface', () => {
  const base = ramp()
  const light = semantic(lightBlock(), base)
  // Dark is the light mapping **overlaid** with what the dark block redeclares, which is what the
  // cascade actually does: `:root[data-theme='dark']` overrides the tokens it names and leaves the
  // rest at their `:root` value. Resolved against the bare ramp instead, any token declared only
  // once — because it is the same in both themes — vanished from this side and its pair asserted
  // nothing.
  const dark = semantic(darkBlock(), light)

  it('resolved both palettes, so the assertions below are not vacuous', () => {
    for (const theme of [light, dark]) {
      for (const token of ['--fg-1', '--fg-2', '--fg-3', '--bg-1', '--bg-2']) {
        expect(theme[token], `${token} did not resolve`).toMatch(/^#[0-9a-fA-F]{3,8}$/)
      }
    }
    // The two themes are genuinely different, or the dark test is measuring the light one.
    expect(dark['--bg-1']).not.toBe(light['--bg-1'])
    expect(dark['--fg-1']).not.toBe(light['--fg-1'])
  })

  it.each(PAIRS)('%s on %s meets 4.5:1 in light', (fg, bg) => {
    expect(ratio(light[fg], light[bg])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(PAIRS)('%s on %s meets 4.5:1 in dark', (fg, bg) => {
    expect(ratio(dark[fg], dark[bg])).toBeGreaterThanOrEqual(4.5)
  })

  /**
   * Spec 046 AC5, AC6 — the fix must not trade a measurable problem for an unmeasurable one.
   *
   * Content text and disabled text now use different tokens; if they resolved to the same value a
   * disabled control would look enabled, which is its own defect and the reason WCAG exempts it.
   * And the ink must still read as a hierarchy: strongest, body, muted — three values, not one
   * value written three ways, which is what raising `--fg-4` into `--fg-3` would have produced.
   */
  it('keeps content text and disabled text apart', () => {
    for (const [name, theme] of [['light', light], ['dark', dark]] as const) {
      expect(theme['--fg-3'], name).not.toBe(theme['--fg-4'])
    }
  })

  it('keeps three distinct weights of ink on every surface', () => {
    for (const [name, theme] of [['light', light], ['dark', dark]] as const) {
      const inks = [theme['--fg-1'], theme['--fg-2'], theme['--fg-3']]
      expect(new Set(inks).size, `${name}: ${inks.join(' ')}`).toBe(3)
    }
  })

  it('keeps the muted step readable at large sizes at least (3:1)', () => {
    // `--fg-4` carries **disabled controls and placeholders only** — five selectors, listed and
    // enforced by the allowlist below. That is the state WCAG actually exempts, and 3:1 is the bar
    // that matters for it. It used to say "captions, placeholders and disabled text", which was
    // the sentence that let fifty-nine pieces of content accumulate on a token nobody was
    // measuring at the content bar (spec 046).
    for (const theme of [light, dark]) {
      expect(ratio(theme['--fg-4'], theme['--bg-1'])).toBeGreaterThanOrEqual(3)
    }
  })
})
