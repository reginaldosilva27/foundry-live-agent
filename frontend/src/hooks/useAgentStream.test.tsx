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
