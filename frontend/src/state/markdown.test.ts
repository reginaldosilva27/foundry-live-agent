/** Spec 004 AC8 — the answer must not be re-parsed from scratch on every token. */
import { describe, expect, it } from 'vitest'
import { splitBlocks } from './markdown'

describe('splitBlocks', () => {
  it('returns the whole text when there is nothing to split on', () => {
    expect(splitBlocks('one line')).toEqual(['one line'])
  })

  it('splits on a blank line and loses nothing', () => {
    const blocks = splitBlocks('first\n\nsecond')
    expect(blocks).toEqual(['first\n\n', 'second'])
    expect(blocks.join('')).toBe('first\n\nsecond')
  })

  it('keeps every completed block byte-identical as more text streams in', () => {
    const full = 'alpha\n\nbeta\n\ngamma'
    const settled = splitBlocks(full).slice(0, -1)
    for (let i = 1; i <= full.length; i++) {
      const partial = splitBlocks(full.slice(0, i))
      // Whatever the parser has already committed must never be rewritten.
      expect(partial.slice(0, -1)).toEqual(settled.slice(0, partial.length - 1))
    }
  })

  it('does not split inside a fenced code block', () => {
    const text = 'intro\n\n```python\na = 1\n\nb = 2\n```\n\nafter'
    expect(splitBlocks(text)).toEqual(['intro\n\n', '```python\na = 1\n\nb = 2\n```\n\n', 'after'])
  })

  it('treats an unclosed fence as still streaming', () => {
    expect(splitBlocks('intro\n\n```python\na = 1\n\nb = 2')).toEqual([
      'intro\n\n',
      '```python\na = 1\n\nb = 2',
    ])
  })
})
