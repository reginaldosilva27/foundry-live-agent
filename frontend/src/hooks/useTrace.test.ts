/**
 * Spec 005 AC3, AC15, AC19 — fetching a run's spans.
 *
 * The two behaviours worth pinning are what it does *not* do: it does not poll a workspace, and it
 * does not turn a `pending` answer into an error. Ingestion is staggered, so "not yet" is the
 * common case, not the failure case.
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTrace } from './useTrace'

function mockFetch(body: unknown) {
  const fetcher = vi.fn((_url: string) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response),
  )
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetching a trace', () => {
  it('asks for the run by its response id', async () => {
    const fetcher = mockFetch({ status: 'ok', spans: [], otel_trace_id: 'abc123' })

    const { result } = renderHook(() => useTrace('resp_1'))

    await waitFor(() => expect(result.current.trace?.status).toBe('ok'))
    expect(fetcher.mock.calls[0][0]).toContain('/trace/resp_1')
    expect(result.current.trace?.otel_trace_id).toBe('abc123')
  })

  it('asks for nothing when there is no run to ask about', () => {
    const fetcher = mockFetch({ status: 'ok', spans: [] })

    renderHook(() => useTrace(undefined))

    expect(fetcher).not.toHaveBeenCalled()
  })

  it('keeps pending as its own answer rather than an error (AC3)', async () => {
    mockFetch({ status: 'pending', spans: [] })

    const { result } = renderHook(() => useTrace('resp_1'))

    await waitFor(() => expect(result.current.trace?.status).toBe('pending'))
    expect(result.current.trace?.spans).toEqual([])
  })

  it('does not poll — a retry is the reader pressing a button (AC15)', async () => {
    const fetcher = mockFetch({ status: 'pending', spans: [] })

    const { result } = renderHook(() => useTrace('resp_1'))
    await waitFor(() => expect(result.current.trace?.status).toBe('pending'))

    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(fetcher).toHaveBeenCalledTimes(1)

    await act(async () => result.current.retry())
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('reports a dead BFF as failed rather than going quiet', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('connection refused'))))

    const { result } = renderHook(() => useTrace('resp_1'))

    await waitFor(() => expect(result.current.trace?.status).toBe('failed'))
    expect(result.current.trace?.message).toContain('connection refused')
  })
})
