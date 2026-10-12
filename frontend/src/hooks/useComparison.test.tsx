/**
 * Spec 020 AC1, AC8, AC9, AC10 — one question, two turns, and nothing shared between them.
 *
 * The hook is the whole transport story of this spec. `POST /chat` already takes `agent` per
 * request and resolves the harness per request (spec 019), so two columns are two ordinary posts —
 * no multiplexed stream, no fourth field, no backend diff. What has to be *proved* is that the two
 * really are independent: same question out, two conversations back, one failing without taking the
 * other with it.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useComparison } from './useComparison'
import type { AgentMessage } from './useAgentStream'
import { asSseStream, twoToolTurn, repeatedCallTurn } from '../test/fixtures'
import type { AgentEvent } from '../types/events'

function streamOf(events: AgentEvent[]) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(asSseStream(events)))
        controller.close()
      },
    }),
    { status: 200 },
  )
}

/** Answers each agent with its own events, so an event landing in the wrong column is visible. */
function fakeBff(perAgent: Record<string, AgentEvent[]>, refuse?: string) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { agent?: string }
    const agent = body.agent ?? ''
    if (refuse && agent === refuse) throw new TypeError('Failed to fetch')
    return streamOf(perAgent[agent] ?? [])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const bodies = (fetchMock: ReturnType<typeof fakeBff>) =>
  fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)))

const turnsOf = (stream: { messages: { role: string }[] }) =>
  stream.messages.filter((m): m is AgentMessage => m.role === 'agent')

afterEach(() => vi.unstubAllGlobals())

const PAIR = { 'prompt-one': twoToolTurn, 'hosted-two': repeatedCallTurn }

describe('one question, both agents (AC1)', () => {
  it('posts the same text to each, naming a different agent', async () => {
    const fetchMock = fakeBff(PAIR)
    const { result } = renderHook(() => useComparison())
    act(() => result.current.choose('hosted-two'))

    await act(async () => {
      result.current.send('what time is it', 'prompt-one')
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    })

    const sent = bodies(fetchMock)
    expect(sent.map((b) => b.message)).toEqual(['what time is it', 'what time is it'])
    expect(sent.map((b) => b.agent).sort()).toEqual(['hosted-two', 'prompt-one'])
  })

  it('opens both before either has finished — neither waits on the other', async () => {
    // Both requests are in flight at the same moment, which is what "side by side" means. If the
    // second awaited the first, the second call would land only after the first stream closed.
    const fetchMock = fakeBff(PAIR)
    const { result } = renderHook(() => useComparison())
    act(() => result.current.choose('hosted-two'))

    act(() => result.current.send('what time is it', 'prompt-one'))

    // Synchronously after the call, with nothing awaited in between.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(result.current.streaming).toBe(false))
  })

  it('sends nothing at all until a second agent is chosen', async () => {
    const fetchMock = fakeBff(PAIR)
    const { result } = renderHook(() => useComparison())

    act(() => result.current.send('what time is it', 'prompt-one'))

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('two conversations, never one (AC10)', () => {
  it('keeps the columns’ conversation ids apart, on the first turn and the second', async () => {
    const fetchMock = fakeBff({
      'prompt-one': twoToolTurn,
      // Same shape, a different conversation: `twoToolTurn` ends on `conv_1`.
      'hosted-two': twoToolTurn.map((event) =>
        event.type === 'trace_ids' ? { ...event, conversation_id: 'conv_2' } : event,
      ),
    })
    const { result } = renderHook(() => useComparison())
    act(() => result.current.choose('hosted-two'))

    act(() => result.current.send('what time is it', 'prompt-one'))
    await waitFor(() => expect(result.current.streaming).toBe(false))

    expect(result.current.left.conversationId).toBe('conv_1')
    expect(result.current.right.conversationId).toBe('conv_2')

    act(() => result.current.send('and now?', 'prompt-one'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))

    const followUp = bodies(fetchMock).slice(2)
    // Each column continues its OWN Foundry conversation; no id appears under both agents.
    const byAgent = Object.fromEntries(followUp.map((b) => [b.agent, b.conversation_id]))
    expect(byAgent['prompt-one']).toBe('conv_1')
    expect(byAgent['hosted-two']).toBe('conv_2')
  })

  it('starts the second column over when a different agent is chosen', async () => {
    // A Foundry conversation belongs to one agent (019 AC7). Carrying it to the next one would be
    // the second agent answering about a thread it never had.
    fakeBff({ 'prompt-one': twoToolTurn, 'hosted-two': twoToolTurn })
    const { result } = renderHook(() => useComparison())
    act(() => result.current.choose('hosted-two'))
    act(() => result.current.send('what time is it', 'prompt-one'))
    await waitFor(() => expect(result.current.right.conversationId).toBe('conv_1'))

    act(() => result.current.choose('another-agent'))

    expect(result.current.right.conversationId).toBeUndefined()
    expect(result.current.right.messages).toEqual([])
    // The left column is untouched: it is still the same agent answering the same thread.
    expect(result.current.left.messages.length).toBeGreaterThan(0)
    expect(result.current.left.conversationId).toBe('conv_1')
  })
})

describe('when one side fails (AC8)', () => {
  it('leaves the other running and finishing', async () => {
    fakeBff(PAIR, 'hosted-two')
    const { result } = renderHook(() => useComparison())
    act(() => result.current.choose('hosted-two'))

    act(() => result.current.send('what time is it', 'prompt-one'))
    await waitFor(() => expect(result.current.streaming).toBe(false))

    expect(turnsOf(result.current.right)[0].turn.status).toBe('error')
    expect(turnsOf(result.current.left)[0].turn.status).toBe('done')
    expect(turnsOf(result.current.left)[0].turn.text).toBe('It is 19:00 in Sao Paulo.')
  })
})

describe('stopping (AC9)', () => {
  it('settles both columns, leaving neither streaming', async () => {
    // A stream that never closes, so there is something to stop. The fake honours the abort
    // signal the way a real `fetch` does — errors the body so a pending `read()` rejects rather
    // than hanging — or a hook that aborted nothing would pass this.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_url: string, init?: RequestInit) =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(
                  new TextEncoder().encode(asSseStream([{ type: 'text_delta', text: 'thinking' }])),
                )
                init?.signal?.addEventListener('abort', () =>
                  controller.error(new DOMException('aborted', 'AbortError')),
                )
              },
            }),
            { status: 200 },
          ),
      ),
    )
    const { result } = renderHook(() => useComparison())
    act(() => result.current.choose('hosted-two'))
    act(() => result.current.send('what time is it', 'prompt-one'))
    await waitFor(() => expect(turnsOf(result.current.left)[0]?.turn.text).toBe('thinking'))

    act(() => result.current.stop())

    await waitFor(() => {
      expect(turnsOf(result.current.left)[0].turn.status).toBe('stopped')
      expect(turnsOf(result.current.right)[0].turn.status).toBe('stopped')
    })
    expect(result.current.streaming).toBe(false)
  })
})

describe('what the trace panel addresses (AC7)', () => {
  it('exposes both columns’ turns with ids that cannot collide', async () => {
    fakeBff(PAIR)
    const { result } = renderHook(() => useComparison())
    act(() => result.current.choose('hosted-two'))

    act(() => result.current.send('what time is it', 'prompt-one'))
    await waitFor(() => expect(result.current.streaming).toBe(false))

    const ids = result.current.messages.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(result.current.messages.filter((m) => m.role === 'agent')).toHaveLength(2)
  })
})

describe('spec 056 local pair reset', () => {
  it('clears both drawings and pointers, keeps the chosen agent and sends no reset request', async () => {
    const fetchMock = fakeBff(PAIR)
    const { result } = renderHook(() => useComparison())
    act(() => result.current.choose('hosted-two'))
    act(() => result.current.send('first', 'prompt-one'))
    await waitFor(() => expect(result.current.streaming).toBe(false))
    act(() => result.current.reset())
    expect(result.current.left.messages).toEqual([])
    expect(result.current.right.messages).toEqual([])
    expect(result.current.left.conversationId).toBeUndefined()
    expect(result.current.right.conversationId).toBeUndefined()
    expect(result.current.other).toBe('hosted-two')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    act(() => result.current.send('next', 'prompt-one'))
    await waitFor(() => expect(result.current.streaming).toBe(false))
    expect(bodies(fetchMock).slice(2).every((b) => b.conversation_id === undefined)).toBe(true)
  })

  it('refuses reset and second-agent changes during either stream', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init?: RequestInit) => new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
      },
    }))))
    const { result } = renderHook(() => useComparison())
    act(() => result.current.choose('hosted-two'))
    act(() => result.current.send('first', 'prompt-one'))
    act(() => { result.current.reset(); result.current.choose('another-agent') })
    expect(result.current.other).toBe('hosted-two')
    expect(result.current.left.messages).toHaveLength(2)
    expect(result.current.right.messages).toHaveLength(2)
    act(() => result.current.stop())
    await waitFor(() => expect(result.current.streaming).toBe(false))
  })
})
