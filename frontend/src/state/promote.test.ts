/**
 * Going back to a version — the one request this browser makes that changes something (spec 031).
 *
 * Every other persistent thing in this app is local to this browser: the history, the favourites,
 * the collapsed rail. This one is not, and these tests are mostly about that asymmetry — a request
 * that must not be issued twice, and a result that must be **read back** rather than assumed.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePromote } from './promote'
import type { AgentDetail } from '../types/agents'

const DETAIL = (served: string): AgentDetail => ({
  name: 'foundry-live-agent',
  kind: 'prompt',
  version: served,
  version_status: 'active',
  model: 'gpt-5.5',
  harness: 'prompt-agent',
  suggestions: [],
  selectable: true,
  reason: '',
  instructions: '',
  tools: [],
  reasoning: null,
  container: null,
  served_version: served,
  latest_version: '8',
  pinned: served !== '8',
  versions: null,
})

function answers(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

/** A request that never settles, so "in flight" is a state the test can actually observe. */
function hangs() {
  return vi.fn(() => new Promise<Response>(() => {}))
}

afterEach(() => vi.unstubAllGlobals())

describe('promoting a version', () => {
  it('posts to the agent and version it was given, with no body', async () => {
    // AC14 from the browser's side: there is nothing to send, so nothing is sent. A body here
    // would be the first step towards a screen that edits an agent (spec 031 non-goals).
    const fetchMock = answers({ agent: DETAIL('3'), error: null })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => usePromote({ bffUrl: 'http://bff' }))
    await act(async () => {
      await result.current.promote('foundry-live-agent', '3')
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined]
    expect(url).toBe('http://bff/agents/foundry-live-agent/versions/3/promote')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeUndefined()
  })

  it('reports the agent the SERVICE came back with, not the one that was asked for', async () => {
    // AC7. The stub answers with version 5 although 3 was requested — a promotion that did not
    // take effect must look like one, and an echo of the request would hide exactly that.
    vi.stubGlobal('fetch', answers({ agent: DETAIL('5'), error: null }))

    const { result } = renderHook(() => usePromote({ bffUrl: 'http://bff' }))
    let returned: AgentDetail | null = null
    await act(async () => {
      returned = await result.current.promote('foundry-live-agent', '3')
    })

    expect(returned!.served_version).toBe('5')
  })

  it('will not issue a second request while one is in flight', async () => {
    // AC6. The control is disabled, but a disabled button is a rendering detail; this is the rule.
    const fetchMock = hangs()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => usePromote({ bffUrl: 'http://bff' }))
    act(() => {
      void result.current.promote('foundry-live-agent', '3')
    })
    await waitFor(() => expect(result.current.promoting).toBe('3'))
    act(() => {
      void result.current.promote('foundry-live-agent', '4')
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('says which version is in flight, and stops saying so when it lands', async () => {
    vi.stubGlobal('fetch', answers({ agent: DETAIL('3'), error: null }))

    const { result } = renderHook(() => usePromote({ bffUrl: 'http://bff' }))
    expect(result.current.promoting).toBeNull()

    await act(async () => {
      await result.current.promote('foundry-live-agent', '3')
    })

    expect(result.current.promoting).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('keeps the code a refusal carries', async () => {
    // AC8 — `forbidden` and a generic failure are different facts and the screen says different
    // things. An `r.ok` guard here would flatten them, which is spec 019's lesson (§5).
    vi.stubGlobal('fetch', answers({ agent: null, error: 'forbidden' }, 403))

    const { result } = renderHook(() => usePromote({ bffUrl: 'http://bff' }))
    let returned: AgentDetail | null = null
    await act(async () => {
      returned = await result.current.promote('foundry-live-agent', '3')
    })

    expect(returned).toBeNull()
    expect(result.current.error).toBe('forbidden')
    expect(result.current.promoting).toBeNull()
  })

  it('turns a transport failure into a code rather than an exception', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))

    const { result } = renderHook(() => usePromote({ bffUrl: 'http://bff' }))
    await act(async () => {
      await result.current.promote('foundry-live-agent', '3')
    })

    expect(result.current.error).toBe('unavailable')
  })

  it('clears a previous failure when a new attempt starts', async () => {
    vi.stubGlobal('fetch', answers({ agent: null, error: 'forbidden' }, 403))
    const { result } = renderHook(() => usePromote({ bffUrl: 'http://bff' }))
    await act(async () => {
      await result.current.promote('foundry-live-agent', '3')
    })
    expect(result.current.error).toBe('forbidden')

    vi.stubGlobal('fetch', answers({ agent: DETAIL('3'), error: null }))
    await act(async () => {
      await result.current.promote('foundry-live-agent', '3')
    })

    expect(result.current.error).toBeNull()
  })
})
