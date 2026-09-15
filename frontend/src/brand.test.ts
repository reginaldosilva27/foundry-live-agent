/**
 * The product's own mark.
 *
 * The UI used to ship the Dataside icon as its brand mark. Dataside's *design system* still governs
 * the interface — the tokens, the type, the rules in `docs/design-system.md` — but the mark on the
 * sidebar, the agent avatar and the favicon names the product, and the product is not Dataside.
 *
 * This is a regression test, not a taste test: it asserts no reference to the old asset survives
 * anywhere in the app, which is the failure mode of a rename done by hand.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')
const AZUL = 'icon-foundry-live-agent-azul.svg'
const BRANCO = 'icon-foundry-live-agent-branco.svg'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) return []
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const sources = walk(join(root, 'src'))
  .filter((path) => /\.(tsx?|css)$/.test(path) && !path.endsWith('.test.ts'))
  .concat(join(root, 'index.html'))

describe('the brand mark', () => {
  it('ships a blue cut for light surfaces and a white cut for dark ones', () => {
    for (const [file, colour] of [
      [AZUL, '#0074FF'],
      [BRANCO, '#FFFFFF'],
    ]) {
      const svg = readFileSync(join(root, 'public', file), 'utf8')
      expect(svg).toContain(colour)
      expect(svg).toMatch(/viewBox="0 0 24 24"/)
    }
  })

  it('obeys the brand: one colour, no gradient', () => {
    for (const file of [AZUL, BRANCO]) {
      const svg = readFileSync(join(root, 'public', file), 'utf8')
      expect(svg).not.toMatch(/<(linear|radial)Gradient|url\(#/)
      expect(new Set(svg.match(/#[0-9A-Fa-f]{6}/g))).toHaveProperty('size', 1)
    }
  })

  it('is what the app actually renders', () => {
    const used = sources.filter((path) => readFileSync(path, 'utf8').includes(BRANCO))
    expect(used.map((p) => p.replace(root, '').replace(/^\//, ''))).toEqual(
      expect.arrayContaining(['src/panes/Sidebar.tsx', 'src/panes/Conversation.tsx']),
    )
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toContain(AZUL)
  })

  it('leaves no reference to the mark it replaced', () => {
    const stragglers = sources.filter((path) => /icon-dataside/.test(readFileSync(path, 'utf8')))
    expect(stragglers).toEqual([])
  })
})
