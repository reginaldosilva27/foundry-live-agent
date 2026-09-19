/**
 * A table on the clipboard (spec 035).
 *
 * Tab-separated because this is a *clipboard* operation: a spreadsheet pastes TSV straight into
 * cells, while CSV lands in one column or opens an import dialog.
 *
 * The escaping is the whole of this module, and it exists for one failure: a single cell with a
 * line break in it silently shifts every column after it. That is worse than not offering the
 * control, because the table looks fine until someone checks a number.
 */
import { describe, expect, it } from 'vitest'
import { toTsv } from './tsv'

describe('ordinary cells', () => {
  it('joins columns with tabs and rows with newlines', () => {
    expect(toTsv([['a', 'b'], ['c', 'd']])).toBe('a\tb\nc\td')
  })

  it('leaves a cell that needs no escaping untouched', () => {
    expect(toTsv([['plain text, with a comma']])).toBe('plain text, with a comma')
  })

  it('keeps an empty cell as an empty column rather than dropping it', () => {
    expect(toTsv([['a', '', 'c']])).toBe('a\t\tc')
  })
})

describe('cells that would break the shape (AC6)', () => {
  it('quotes a cell containing a tab', () => {
    expect(toTsv([['a\tb', 'c']])).toBe('"a\tb"\tc')
  })

  it('quotes a cell containing a newline', () => {
    expect(toTsv([['line one\nline two', 'c']])).toBe('"line one\nline two"\tc')
  })

  it('quotes a cell containing a quote, doubling the inner ones', () => {
    expect(toTsv([['he said "hi"', 'c']])).toBe('"he said ""hi"""\tc')
  })

  it('handles a cell that needs all three at once', () => {
    expect(toTsv([['a\tb\n"c"']])).toBe('"a\tb\n""c"""')
  })

  it('does not shift the columns after a multi-line cell', () => {
    // The failure this module exists for, stated as a test: without quoting, the newline ends the
    // row and everything after it moves one row up and one column left.
    const tsv = toTsv([
      ['name', 'note', 'value'],
      ['a', 'first\nsecond', '42'],
    ])
    const rows = parse(tsv)

    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual(['a', 'first\nsecond', '42'])
  })
})

/** A minimal reader, so the round trip is asserted rather than the output merely inspected. */
function parse(tsv: string): string[][] {
  const rows: string[][] = [[]]
  let cell = ''
  let quoted = false

  for (let i = 0; i < tsv.length; i++) {
    const ch = tsv[i]
    if (quoted) {
      if (ch === '"' && tsv[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
      continue
    }
    if (ch === '"' && cell === '') quoted = true
    else if (ch === '\t') {
      rows[rows.length - 1].push(cell)
      cell = ''
    } else if (ch === '\n') {
      rows[rows.length - 1].push(cell)
      cell = ''
      rows.push([])
    } else cell += ch
  }
  rows[rows.length - 1].push(cell)
  return rows
}

describe('the round trip', () => {
  it('survives every awkward cell together', () => {
    const table = [
      ['h1', 'h2'],
      ['quote "x"', 'tab\there'],
      ['newline\nhere', 'plain'],
    ]
    expect(parse(toTsv(table))).toEqual(table)
  })
})
