/**
 * Regressions from the 2026-10-15 assessment — the hook around a voice session.
 *
 * `voice/session.ts` owns the WebRTC half and has its own suite; what is faked here is exactly that
 * module, because the bugs live in how the hook reacts to it: a peer that drops, a second click
 * while the first is still negotiating, and an end pressed before the start resolved.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StartVoiceOptions, VoiceSession } from '../voice/session'

const startVoice = vi.fn<(options: StartVoiceOptions) => Promise<VoiceSession>>()
vi.mock('../voice/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../voice/session')>()),
  startVoice: (options: StartVoiceOptions) => startVoice(options),
}))

const { useVoiceSession } = await import('./useVoiceSession')

function fakeSession(): VoiceSession & { stop: ReturnType<typeof vi.fn> } {
  return { sessionId: 's1', setMuted: vi.fn(), stop: vi.fn(async () => {}) }
}

beforeEach(() => {
  startVoice.mockReset()
  // The activity stream is not under test; an empty body ends it at once.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
})
afterEach(() => vi.unstubAllGlobals())

describe('a voice session whose peer drops', () => {
  it('tears the session down, says so, and lets a new one start', async () => {
    const live = fakeSession()
    let closed: (() => void) | undefined
    startVoice.mockImplementation(async (options) => {
      closed = options.onClosed
      return live
    })
    const onDropped = vi.fn()
    const { result } = renderHook(() => useVoiceSession({ onDropped }))

    await act(() => result.current.start())
    expect(result.current.status).toBe('live')

    await act(async () => closed?.())

    // Mic released and the server told: the same teardown an end does.
    expect(live.stop).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('dropped')
    expect(onDropped).toHaveBeenCalledTimes(1)

    const next = fakeSession()
    startVoice.mockResolvedValue(next)
    await act(() => result.current.start())
    expect(startVoice).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('live')
  })

  it('does nothing for a close that follows an end the reader pressed', async () => {
    const live = fakeSession()
    let closed: (() => void) | undefined
    startVoice.mockImplementation(async (options) => {
      closed = options.onClosed
      return live
    })
    const onDropped = vi.fn()
    const { result } = renderHook(() => useVoiceSession({ onDropped }))

    await act(() => result.current.start())
    await act(async () => void (await result.current.stop()))
    await act(async () => closed?.())

    expect(live.stop).toHaveBeenCalledTimes(1)
    expect(onDropped).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })
})

describe('starting', () => {
  it('opens one session for two quick clicks', async () => {
    let resolve: (session: VoiceSession) => void = () => {}
    startVoice.mockImplementation(() => new Promise((r) => (resolve = r)))
    const { result } = renderHook(() => useVoiceSession())

    let first: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.start()
      void result.current.start()
    })
    await act(async () => {
      resolve(fakeSession())
      await first
    })

    expect(startVoice).toHaveBeenCalledTimes(1)
  })

  it('ends a session that finished negotiating after the reader already ended it', async () => {
    let resolve: (session: VoiceSession) => void = () => {}
    startVoice.mockImplementation(() => new Promise((r) => (resolve = r)))
    const { result } = renderHook(() => useVoiceSession())

    let started: Promise<void> = Promise.resolve()
    act(() => {
      started = result.current.start()
    })
    expect(result.current.status).toBe('starting')
    await act(async () => void (await result.current.stop()))

    const live = fakeSession()
    await act(async () => {
      resolve(live)
      await started
    })

    await waitFor(() => expect(live.stop).toHaveBeenCalledTimes(1))
    expect(result.current.status).toBe('idle')
  })
})
