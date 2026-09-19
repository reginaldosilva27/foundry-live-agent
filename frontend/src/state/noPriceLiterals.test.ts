/**
 * Spec 028 AC12 — the frontend holds no prices (§4).
 *
 * A rate table compiled into a browser bundle is a fact with no owner. Prices vary by region and by
 * agreement and change without telling anybody, so the copy in the bundle would go stale in silence
 * and every reader would see a number presented as measured that nobody is maintaining. The BFF is
 * the single source of truth; this file is the tripwire that keeps it that way.
 *
 * **What this proves and what it does not.** It cannot recognise a price in general — `2` is a
 * perfectly good number. It fails when somebody writes the shape of a rate table in `src/`, which
 * is the one regression that matters and the one that would otherwise be invisible in review. A
 * green run is a tripwire, not a proof, and it is written down as one (§5).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The shapes a hardcoded rate table takes. Each is a key from the contract beside a number. */
const PRICE_SHAPES = [
  /\b(cached_input|cachedInput)\s*:\s*[\d.]+/,
  /\binput\s*:\s*[\d.]+\s*,\s*(cached_input|cachedInput|output)\s*:/,
  /\boutput\s*:\s*[\d.]+\s*,?\s*\}/,
  /\bper_tokens\s*:\s*[\d_]+/,
  /\brates\s*:\s*\{\s*['"]/,
  /\bUSD\b|\bBRL\b|\bEUR\b/,
]

describe('no price lives in the frontend (§4)', () => {
  const files = sources()

  it('has sources to scan, so a passing run means something', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('writes no rate table, no currency code and no per-token factor', () => {
    const offenders = files.flatMap(([path, text]) =>
      PRICE_SHAPES.filter((pattern) => pattern.test(text)).map(
        (pattern) => `${path} matched ${pattern}`,
      ),
    )

    expect(offenders).toEqual([])
  })
})

/**
 * Production sources only.
 *
 * Tests are excluded on purpose and it is worth saying why: `cost.test.ts` is *full* of rate
 * tables, because pinning arithmetic needs numbers to pin it with. Those are fixtures for an
 * assertion, not a claim about what anything costs, and they never reach a reader.
 */
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
