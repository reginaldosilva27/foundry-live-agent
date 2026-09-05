/** Spec 004 AC2 — SSE frames arrive split at arbitrary byte boundaries. */
import { describe, expect, it } from 'vitest'
import { createFrameParser } from './sse'
import { asSseStream, twoToolTurn } from '../test/fixtures'

describe('createFrameParser', () => {
  it('parses whole frames', () => {
    const parse = createFrameParser()
    expect(parse(asSseStream(twoToolTurn))).toEqual(twoToolTurn)
  })

  it('holds a partial frame until the rest arrives', () => {
    const stream = asSseStream(twoToolTurn.slice(0, 1))
    const parse = createFrameParser()
    const half = Math.floor(stream.length / 2)
    expect(parse(stream.slice(0, half))).toEqual([])
    expect(parse(stream.slice(half))).toEqual(twoToolTurn.slice(0, 1))
  })

  it('survives a stream chopped one character at a time', () => {
    const parse = createFrameParser()
    const events = [...asSseStream(twoToolTurn)].flatMap((ch) => parse(ch))
    expect(events).toEqual(twoToolTurn)
  })

  it('ignores a frame whose payload is not JSON rather than throwing', () => {
    const parse = createFrameParser()
    expect(parse('event: done\ndata: {oops\n\n')).toEqual([])
  })
})
