/**
 * Spec 021 AC17, AC21 — the conversation pointer, out and back.
 *
 * The hook has always kept Foundry's `conversation_id` in a ref and sent it on the next turn. Two
 * things change here and both are about history: the id is now *readable*, so a conversation can be
 * stored beside it, and it can be *restored*, so reopening one continues the Foundry conversation
 * rather than opening a new one.
 *
 * AC21 is the §8 test. Whatever this browser remembers, the body it posts stays three fields.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAgentStream } from './useAgentStream'
import { asSseStream, twoToolTurn } from '../test/fixtures'

function fakeChat() {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(asSseStream(twoToolTurn)))
            controller.close()
          },
        }),
        { status: 200 },
      ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function bodyOf(fetchMock: ReturnType<typeof fakeChat>, call = 0): Record<string, unknown> {
  return JSON.parse(sentBody(fetchMock, call))
}

/** The JSON the hook posted. Typed loosely because `fetch`'s own signature is. */
function sentBody(fetchMock: ReturnType<typeof fakeChat>, call = 0): string {
  const init = fetchMock.mock.calls[call][1] as RequestInit
  return String(init.body)
}

afterEach(() => vi.unstubAllGlobals())

describe('useAgentStream', () => {
  it('exposes the conversation id Foundry gave it, so a conversation can be stored beside it', async () => {
    fakeChat()
    const { result } = renderHook(() => useAgentStream())

    await act(() => result.current.send('what time is it'))

    await waitFor(() => expect(result.current.conversationId).toBe('conv_1'))
  })

  it('restores a stored conversation and continues it by its Foundry id', async () => {
    const fetchMock = fakeChat()
    const { result } = renderHook(() => useAgentStream())

    act(() =>
      result.current.restore([{ role: 'user', id: 'old_user', text: 'an earlier question' }], 'conv_stored'),
    )
    expect(result.current.messages).toHaveLength(1)

    await act(() => result.current.send('and now?'))

    expect(bodyOf(fetchMock).conversation_id).toBe('conv_stored')
  })

  it('posts the turn and nothing else — never the transcript it is holding (§8)', async () => {
    const fetchMock = fakeChat()
    const { result } = renderHook(() => useAgentStream())

    act(() =>
      result.current.restore(
        [
          { role: 'user', id: 'old_user', text: 'an earlier question' },
          { role: 'user', id: 'older', text: 'and one before that' },
        ],
        'conv_stored',
      ),
    )
    await act(() => result.current.send('and now?', 'some-agent'))

    expect(Object.keys(bodyOf(fetchMock)).sort()).toEqual([
      'agent',
      'conversation_id',
      'message',
    ])
    expect(bodyOf(fetchMock).message).toBe('and now?')
    expect(sentBody(fetchMock)).not.toContain('an earlier question')
  })

  it('drops the pointer on reset, so a new session is a new Foundry conversation', async () => {
    const fetchMock = fakeChat()
    const { result } = renderHook(() => useAgentStream())

    act(() => result.current.restore([], 'conv_stored'))
    act(() => result.current.reset())
    await act(() => result.current.send('fresh'))

    expect(bodyOf(fetchMock).conversation_id).toBeUndefined()
    expect(result.current.conversationId).toBe('conv_1')
  })
})

/**
 * Spec 023 — stopping a turn.
 *
 * The stream is driven by hand here rather than enqueued all at once: the whole question is what
 * happens to events that arrive *after* the reader pressed stop, and a stream that has already
 * closed cannot ask it.
 */
function drivableChat() {
  let push: (chunk: string) => void = () => {}
  let finish: () => void = () => {}
  let ready: () => void = () => {}
  const opened = new Promise<void>((resolve) => {
    ready = resolve
  })

  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (_url: string, init?: RequestInit) =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              push = (chunk) => controller.enqueue(new TextEncoder().encode(chunk))
              finish = () => controller.close()
              // What a real `fetch` does: aborting the signal errors the response body, so a
              // pending `read()` rejects instead of hanging. A mock that ignored the signal would
              // let a hook that never aborts anything pass this suite.
              init?.signal?.addEventListener('abort', () =>
                controller.error(new DOMException('aborted', 'AbortError')),
              )
              ready()
            },
          }),
          { status: 200 },
        ),
    ),
  )

  return {
    opened,
    push: (chunk: string) => push(chunk),
    finish: () => finish(),
  }
}

describe('stopping a turn', () => {
  it('leaves the turn stopped rather than failed — an abort is not an error', async () => {
    const chat = drivableChat()
    const { result } = renderHook(() => useAgentStream())

    act(() => void result.current.send('what time is it'))
    await chat.opened
    act(() => chat.push(asSseStream(twoToolTurn.slice(0, 5))))

    await waitFor(() => expect(agentTurn(result.current).activities.length).toBeGreaterThan(0))
    act(() => result.current.stop())

    await waitFor(() => expect(result.current.streaming).toBe(false))
    expect(agentTurn(result.current).status).toBe('stopped')
    expect(agentTurn(result.current).error).toBeUndefined()
  })

  it('keeps what had already arrived', async () => {
    const chat = drivableChat()
    const { result } = renderHook(() => useAgentStream())

    act(() => void result.current.send('what time is it'))
    await chat.opened
    act(() => chat.push(asSseStream(twoToolTurn.slice(0, 4))))
    await waitFor(() => expect(agentTurn(result.current).reasoning).not.toBe(''))

    act(() => result.current.stop())
    await waitFor(() => expect(result.current.streaming).toBe(false))

    expect(agentTurn(result.current).reasoning).toBe('The user asked what time it is.')
    expect(agentTurn(result.current).activities).toHaveLength(1)
  })

  it('applies nothing that was still in flight when the stop landed', async () => {
    const chat = drivableChat()
    const { result } = renderHook(() => useAgentStream())

    act(() => void result.current.send('what time is it'))
    await chat.opened
    act(() => chat.push(asSseStream(twoToolTurn.slice(0, 4))))
    await waitFor(() => expect(agentTurn(result.current).activities).toHaveLength(1))

    // Everything the turn would have gained — the MCP call, the answer, the usage — handed to the
    // transport in the same tick as the stop. A real abort errors the body and discards the queue,
    // which is why "deliver more after a stop" is not a state the browser can reach; what it *can*
    // reach is exactly this, and none of it may land.
    act(() => {
      chat.push(asSseStream(twoToolTurn.slice(4)))
      result.current.stop()
    })

    await waitFor(() => expect(result.current.streaming).toBe(false))
    expect(agentTurn(result.current).text).toBe('')
    expect(agentTurn(result.current).usage).toBeUndefined()
    expect(agentTurn(result.current).activities).toHaveLength(1)
    expect(agentTurn(result.current).status).toBe('stopped')
  })

  it('carries the same conversation id into the next turn', async () => {
    const chat = drivableChat()
    const { result } = renderHook(() => useAgentStream())

    act(() => void result.current.send('what time is it'))
    await chat.opened
    act(() =>
      chat.push(
        asSseStream([{ type: 'trace_ids', response_id: 'resp_1', conversation_id: 'conv_1' }]),
      ),
    )
    await waitFor(() => expect(result.current.conversationId).toBe('conv_1'))

    act(() => result.current.stop())
    await waitFor(() => expect(result.current.streaming).toBe(false))

    fakeChat()
    await act(() => result.current.send('and now?'))
    expect(bodyOf(vi.mocked(fetch) as never).conversation_id).toBe('conv_1')
  })

  it('does nothing when there is no turn running', () => {
    const { result } = renderHook(() => useAgentStream())
    expect(() => act(() => result.current.stop())).not.toThrow()
  })
})

/** The turn of the only agent message on screen. */
function agentTurn(stream: ReturnType<typeof useAgentStream>) {
  const message = stream.messages.find((m) => m.role === 'agent')
  if (message?.role !== 'agent') throw new Error('no agent message')
  return message.turn
}
