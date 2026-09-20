/**
 * Spec 020 — two streams on one screen, and the two things that stops being safe.
 *
 * **Turn ids.** Each instance of the hook mints `turn_0`, `turn_1` from its own counter, so two
 * instances both produce `turn_0`. Three surfaces address a turn by that id — the trace panel, the
 * event inspector and the log reader — and two turns sharing one means opening the wrong payload
 * under the wrong agent, which is exactly the failure AC2 is about. The prefix is what keeps the
 * existing single lookup working across both columns instead of growing a second one (§4).
 *
 * **Time to first token.** AC4 asks for a figure nothing in the app measured. It is the browser's
 * clock, like `latencyMs` beside it — an observation about what we saw, not a claim about the run —
 * and it is absent, never zero, on a turn that produced no text (§5).
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAgentStream, type AgentMessage } from './useAgentStream'
import { asSseStream, failedTurn, twoToolTurn } from '../test/fixtures'
import type { AgentEvent } from '../types/events'

function fakeChat(events: AgentEvent[] = twoToolTurn) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(asSseStream(events)))
              controller.close()
            },
          }),
          { status: 200 },
        ),
    ),
  )
}

const agentTurns = (messages: { role: string }[]) =>
  messages.filter((m): m is AgentMessage => m.role === 'agent')

afterEach(() => vi.unstubAllGlobals())

describe('the id a turn is addressed by', () => {
  it('is `turn_N` with no prefix given — today’s scheme, unchanged', async () => {
    fakeChat()
    const { result } = renderHook(() => useAgentStream())

    await act(() => result.current.send('what time is it'))

    expect(result.current.messages.map((m) => m.id)).toEqual(['turn_0_user', 'turn_0'])
  })

  it('carries the prefix it was given, so two streams cannot mint the same id', async () => {
    fakeChat()
    const left = renderHook(() => useAgentStream('left'))
    const right = renderHook(() => useAgentStream('right'))

    await act(() => left.result.current.send('what time is it'))
    await act(() => right.result.current.send('what time is it'))

    const ids = [...left.result.current.messages, ...right.result.current.messages].map((m) => m.id)
    expect(ids).toEqual(['left_0_user', 'left_0', 'right_0_user', 'right_0'])
    // The property the trace panel depends on: no id appears twice across the two columns.
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps counting past a restored transcript under its own prefix', async () => {
    fakeChat()
    const { result } = renderHook(() => useAgentStream('left'))

    act(() => result.current.restore([{ role: 'user', id: 'left_4_user', text: 'earlier' }], 'c_1'))
    await act(() => result.current.send('and now?'))

    expect(result.current.messages.map((m) => m.id)).toEqual([
      'left_4_user',
      'left_5_user',
      'left_5',
    ])
  })
})

describe('when the first token arrived', () => {
  it('is stamped on the turn, at or after it started', async () => {
    fakeChat()
    const { result } = renderHook(() => useAgentStream())

    await act(() => result.current.send('what time is it'))

    await waitFor(() => {
      const [turn] = agentTurns(result.current.messages)
      expect(turn.firstTokenAt).toBeDefined()
      expect(turn.firstTokenAt).toBeGreaterThanOrEqual(turn.startedAt)
      expect(turn.firstTokenAt).toBeLessThanOrEqual(turn.endedAt ?? Infinity)
    })
  })

  it('is the FIRST token, not the latest one to arrive', async () => {
    // The distinction is invisible when every delta lands in the same millisecond, which is what a
    // one-chunk fixture does — so the answer is split across a real pause. A stamp taken on each
    // delta would sit AFTER the gap; the first-token stamp sits before it.
    const GAP_MS = 40
    const upToFirstToken = twoToolTurn.slice(0, 6)
    const theRest = twoToolTurn.slice(6)
    expect(upToFirstToken.at(-1)).toMatchObject({ type: 'text_delta' })

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              async start(controller) {
                const encode = (events: AgentEvent[]) =>
                  new TextEncoder().encode(asSseStream(events))
                controller.enqueue(encode(upToFirstToken))
                await new Promise((resolve) => setTimeout(resolve, GAP_MS))
                controller.enqueue(encode(theRest))
                controller.close()
              },
            }),
            { status: 200 },
          ),
      ),
    )

    const { result } = renderHook(() => useAgentStream())
    await act(() => result.current.send('what time is it'))
    await waitFor(() => expect(agentTurns(result.current.messages)[0].endedAt).toBeDefined())

    const [turn] = agentTurns(result.current.messages)
    expect(turn.turn.text).toBe('It is 19:00 in Sao Paulo.')
    // The whole answer took at least the gap; the first token did not wait for it.
    expect((turn.endedAt ?? 0) - turn.startedAt).toBeGreaterThanOrEqual(GAP_MS)
    expect((turn.firstTokenAt ?? Infinity) - turn.startedAt).toBeLessThan(GAP_MS)
  })

  it('is absent on a turn that never produced text, rather than zero', async () => {
    // `failedTurn` opens with a delta, so it is the wrong shape for this: strip it.
    fakeChat(failedTurn.filter((event) => event.type !== 'text_delta'))
    const { result } = renderHook(() => useAgentStream())

    await act(() => result.current.send('what time is it'))
    await waitFor(() => expect(agentTurns(result.current.messages)[0].endedAt).toBeDefined())

    expect(agentTurns(result.current.messages)[0].firstTokenAt).toBeUndefined()
  })
})
