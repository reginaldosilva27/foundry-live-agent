/**
 * Spec 015 AC11 — the one thing on the turn that is not derived from an event.
 *
 * Events carry no timestamps, so "how long has this been going on" is a fact about our observation
 * and not about the run. It is a hook rather than turn state so that `state/turn.ts` stays a pure
 * function of the log (AC13), and so the stopwatch is the only thing that has to be tested against
 * a clock.
 */
import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useElapsed } from './useElapsed'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useElapsed', () => {
  it('counts the seconds a state has lasted', () => {
    const { result } = renderHook(() => useElapsed('thinking'))
    expect(result.current).toBe(0)

    act(() => void vi.advanceTimersByTime(3000))
    expect(result.current).toBe(3)
  })

  it('starts over when the state changes', () => {
    const { result, rerender } = renderHook(({ key }) => useElapsed(key), {
      initialProps: { key: 'thinking' },
    })
    act(() => void vi.advanceTimersByTime(12_000))
    expect(result.current).toBe(12)

    rerender({ key: 'calling:lookup_knowledge' })
    expect(result.current).toBe(0)

    act(() => void vi.advanceTimersByTime(4000))
    expect(result.current).toBe(4)
  })

  // A settled turn has a meta line with the real latency on it; a stopwatch still running under a
  // finished answer would be counting nothing.
  it('stops when it is given nothing to time', () => {
    const { result } = renderHook(() => useElapsed(null))
    act(() => void vi.advanceTimersByTime(5000))
    expect(result.current).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves no interval behind', () => {
    const { unmount } = renderHook(() => useElapsed('thinking'))
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
