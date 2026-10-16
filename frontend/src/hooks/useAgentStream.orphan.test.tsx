/**
 * Regressions from the 2026-10-15 assessment.
 *
 * 1. "New session" pressed while a turn streamed: the orphaned turn's late `trace_ids` wrote its
 *    `conversation_id` into the new session, so the "new" conversation answered with the old one's
 *    memory — reproduced live (the new session recalled a code word from the abandoned turn).
 * 2. A body that ends without `done` or `error` (a BFF restart, a proxy cutting the stream) left the
 *    turn `streaming` for ever, breaking the one rule the UI relies on: a turn always settles.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAgentStream } from './useAgentStream'
import { asSseStream } from '../test/fixtures'

/** A chat whose body the test writes by hand, one call at a time. */
function drivableChat() {
  const pushes: Array<(chunk: string) => void> = []
  const finishes: Array<() => void> = []
  let ready: () => void = () => {}
  let opened = new Promise<void>((resolve) => (ready = resolve))

  const fetchMock = vi.fn(
    async (_url: string, init?: RequestInit) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            // After an abort the body is errored and a real server's late bytes go nowhere; the
            // write is attempted anyway, so a hook that never aborts still receives it.
            pushes.push((chunk) => {
              try {
                controller.enqueue(new TextEncoder().encode(chunk))
              } catch {
                // errored by the abort
              }
            })
            finishes.push(() => controller.close())
            init?.signal?.addEventListener('abort', () =>
              controller.error(new DOMException('aborted', 'AbortError')),
            )
            ready()
          },
        }),
        { status: 200 },
      ),
  )
  vi.stubGlobal('fetch', fetchMock)

  return {
    fetchMock,
    get opened() {
      return opened
    },
    rearm: () => (opened = new Promise<void>((resolve) => (ready = resolve))),
    push: (call: number, chunk: string) => pushes[call](chunk),
    finish: (call: number) => finishes[call](),
  }
}

function sentConversationId(fetchMock: ReturnType<typeof vi.fn>, call: number): unknown {
  const init = fetchMock.mock.calls[call][1] as RequestInit
  return JSON.parse(String(init.body)).conversation_id
}

function agentTurn(stream: ReturnType<typeof useAgentStream>) {
  const message = stream.messages.find((m) => m.role === 'agent')
  if (message?.role !== 'agent') throw new Error('no agent message')
  return message.turn
}

afterEach(() => vi.unstubAllGlobals())

describe('a turn orphaned by a new session', () => {
  it('cannot write its conversation id into the session that replaced it', async () => {
    const chat = drivableChat()
    const { result } = renderHook(() => useAgentStream())

    act(() => void result.current.send('remember ABACAXI-42'))
    await chat.opened

    act(() => result.current.reset())
    // The orphan's pointer arrives after the reader already moved on.
    act(() =>
      chat.push(0, asSseStream([{ type: 'trace_ids', response_id: 'r_old', conversation_id: 'conv_old' }])),
    )

    await waitFor(() => expect(result.current.streaming).toBe(false))
    expect(result.current.conversationId).toBeUndefined()
    expect(result.current.messages).toHaveLength(0)

    chat.rearm()
    act(() => void result.current.send('what was the code word?'))
    await chat.opened
    expect(sentConversationId(chat.fetchMock, 1)).toBeUndefined()
  })

  it('cannot write its conversation id into a restored conversation either', async () => {
    const chat = drivableChat()
    const { result } = renderHook(() => useAgentStream())

    act(() => void result.current.send('first'))
    await chat.opened

    act(() => result.current.restore([{ role: 'user', id: 'old_user', text: 'earlier' }], 'conv_stored'))
    act(() =>
      chat.push(0, asSseStream([{ type: 'trace_ids', response_id: 'r_old', conversation_id: 'conv_old' }])),
    )

    await waitFor(() => expect(result.current.streaming).toBe(false))
    expect(result.current.conversationId).toBe('conv_stored')
    expect(result.current.messages).toHaveLength(1)
  })
})

describe('a body that ends without a terminal event', () => {
  it('settles the turn as a transport error instead of streaming for ever', async () => {
    const chat = drivableChat()
    const { result } = renderHook(() => useAgentStream())

    act(() => void result.current.send('hello'))
    await chat.opened
    act(() => chat.push(0, asSseStream([{ type: 'text_delta', text: 'Hel' }])))
    await waitFor(() => expect(agentTurn(result.current).text).toBe('Hel'))

    act(() => chat.finish(0))

    await waitFor(() => expect(result.current.streaming).toBe(false))
    expect(agentTurn(result.current).status).toBe('error')
    expect(agentTurn(result.current).error?.code).toBe('transport_error')
    expect(agentTurn(result.current).text).toBe('Hel')
  })

  it('keeps a final frame that arrived without its trailing blank line', async () => {
    const chat = drivableChat()
    const { result } = renderHook(() => useAgentStream())

    act(() => void result.current.send('hello'))
    await chat.opened
    act(() => chat.push(0, 'data: {"type":"done"}\n'))
    act(() => chat.finish(0))

    await waitFor(() => expect(result.current.streaming).toBe(false))
    expect(agentTurn(result.current).status).toBe('done')
    expect(agentTurn(result.current).error).toBeUndefined()
  })
})
