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

/** The vendored file's own `:root`, which is the light mapping. */
function lightBlock(): string {
  const start = DS.indexOf(':root')
  return DS.slice(start, DS.indexOf('/* ---- Typography', start))
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
  ['--fg-1', '--bg-2'],
  ['--fg-2', '--bg-1'],
  ['--fg-2', '--bg-2'],
  ['--fg-3', '--bg-1'],
  ['--fg-3', '--bg-2'],
]

describe('text on its surface', () => {
  const base = ramp()
  const light = semantic(lightBlock(), base)
  const dark = semantic(darkBlock(), base)

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

  it('keeps the muted step readable at large sizes at least (3:1)', () => {
    // `--fg-4` carries captions, placeholders and disabled text. 4.5:1 is the wrong bar for it;
    // 3:1 is the one that matters, and saying so is more honest than exempting it silently.
    for (const theme of [light, dark]) {
      expect(ratio(theme['--fg-4'], theme['--bg-1'])).toBeGreaterThanOrEqual(3)
    }
  })
})
