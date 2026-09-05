/** Spec 004 AC10, AC11 — constitution §7 (bilingual) and the brand's no-emoji rule. */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { LANGS, INTENTIONALLY_IDENTICAL, strings, detectLang, t } from './strings'

const SRC = join(import.meta.dirname, '..')

function sourceFiles(dirs: string[]): { path: string; text: string }[] {
  return dirs.flatMap((dir) =>
    readdirSync(join(SRC, dir))
      .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
      .map((f) => ({ path: `${dir}/${f}`, text: readFileSync(join(SRC, dir, f), 'utf8') })),
  )
}

describe('strings', () => {
  it('has every key in every language, non-empty', () => {
    for (const [key, entry] of Object.entries(strings)) {
      for (const lang of LANGS) {
        expect(entry[lang], `${key}.${lang}`).toBeTruthy()
      }
    }
  })

  it('translates every key that is not a declared proper noun or technical token', () => {
    const identical = Object.entries(strings)
      .filter(([, entry]) => entry.en === entry.pt)
      .map(([key]) => key)
    expect(identical.sort()).toEqual([...INTENTIONALLY_IDENTICAL].sort())
  })

  it('resolves a key in the requested language', () => {
    expect(t('composer.send', 'en')).toBe('Send')
    expect(t('composer.send', 'pt')).toBe('Enviar')
  })

  it('picks pt for a Brazilian browser and falls back to en otherwise', () => {
    expect(detectLang(['pt-BR', 'en'])).toBe('pt')
    expect(detectLang(['de-DE'])).toBe('en')
    expect(detectLang([])).toBe('en')
  })
})

describe('the UI', () => {
  it('ships no emoji or decorative glyph icons', () => {
    // Built from code points so this test file does not itself contain what it forbids.
    const glyphs = [0x2605, 0x2606, 0x25b8, 0x25b6, 0x2713, 0x2714, 0x2717, 0x2718, 0x25cf, 0x25cb, 0x25c6, 0x25c7, 0x25b2, 0x25bc, 0x2192, 0x2190]
    const banned = new RegExp(`\\p{Extended_Pictographic}|[${glyphs.map((c) => String.fromCodePoint(c)).join('')}]`, 'u')
    for (const { path, text } of sourceFiles(['.', 'components', 'panes', 'hooks', 'state', 'types', 'i18n', 'test'])) {
      expect(banned.test(text), `${path} contains an emoji or glyph icon`).toBe(false)
    }
  })

  it('has no prose written directly into a component', () => {
    for (const { path, text } of sourceFiles(['components', 'panes'])) {
      expect(prose(path, text), `${path} should take its text from strings.ts`).toEqual([])
    }
  })
})

/** Attributes a user can read. `className` and `data-*` are not prose. */
const USER_FACING_ATTRIBUTES = new Set(['aria-label', 'placeholder', 'title', 'alt'])

/**
 * Every readable literal a component renders, found on the JSX syntax tree rather than by regex.
 * A pattern over the source text cannot tell an arrow function from a closing tag; the parser can.
 */
function prose(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []

  const readable = (value: string) => /[A-Za-z]{2,}/.test(value)

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && readable(node.text)) {
      found.push(node.text.trim())
    }
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      USER_FACING_ATTRIBUTES.has(node.name.getText(source)) &&
      readable(node.initializer.text)
    ) {
      found.push(`${node.name.getText(source)}="${node.initializer.text}"`)
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return found
}
