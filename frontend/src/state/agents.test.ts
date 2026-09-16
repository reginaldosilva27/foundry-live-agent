/**
 * Choosing which agent answers (spec 019, AC3 · AC7 · AC9 · AC10).
 *
 * The hook fetches the listing and holds the choice. It holds nothing else: which harness can drive
 * which kind is the BFF's answer (`selectable` + `reason`), because that depends on what the build
 * has, and duplicating the rule here would give it two homes (§4).
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAgents } from './agents'
import type { AgentsListing } from '../types/agents'

const ROWS = [
  {
    name: 'foundry-live-agent',
    kind: 'prompt',
    version: '8',
    version_status: 'active',
    model: 'gpt-5.5',
    harness: 'prompt-agent',
    selectable: true,
    reason: '',
  },
  {
    name: 'foundry-live-agent-hosted',
    kind: 'hosted',
    version: '2',
    version_status: 'active',
    model: 'gpt-5.5',
    harness: 'langgraph',
    selectable: true,
    reason: '',
  },
]

function answers(listing: AgentsListing) {
  return vi.fn(async () => new Response(JSON.stringify(listing), { status: 200 }))
}

afterEach(() => vi.unstubAllGlobals())

async function loaded(listing: AgentsListing, onSwitch = () => {}) {
  vi.stubGlobal('fetch', answers(listing))
  const view = renderHook(() => useAgents({ onSwitch }))
  await waitFor(() => expect(view.result.current.loading).toBe(false))
  return view
}

describe('the agents state', () => {
  it('starts with no selection, so the app runs on its configured default', async () => {
    const { result } = await loaded({ agents: ROWS, error: null })

    expect(result.current.agents).toHaveLength(2)
    expect(result.current.selected).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('keeps the failure code rather than showing an empty list (AC3, AC9)', async () => {
    const { result } = await loaded({ agents: [], error: 'forbidden' })

    expect(result.current.error).toBe('forbidden')
    expect(result.current.agents).toEqual([])
  })

  it('reports a dead BFF as a failure, not as a project with no agents', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('connection refused'))))
    const { result } = renderHook(() => useAgents({ onSwitch: () => {} }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('unavailable')
  })

  it('starts a new conversation when the agent changes (AC7)', async () => {
    const onSwitch = vi.fn()
    const { result } = await loaded({ agents: ROWS, error: null }, onSwitch)

    act(() => result.current.select('foundry-live-agent-hosted'))

    expect(onSwitch).toHaveBeenCalledTimes(1)
    expect(result.current.selected).toBe('foundry-live-agent-hosted')
    expect(result.current.switched).toBe('foundry-live-agent-hosted')
  })

  it('does not throw away a conversation when the same agent is picked again', async () => {
    const onSwitch = vi.fn()
    const { result } = await loaded({ agents: ROWS, error: null }, onSwitch)

    act(() => result.current.select('foundry-live-agent-hosted'))
    act(() => result.current.select('foundry-live-agent-hosted'))

    expect(onSwitch).toHaveBeenCalledTimes(1)
  })

  it('refuses to select a row the BFF marked unselectable', async () => {
    const onSwitch = vi.fn()
    const rows = [
      ...ROWS,
      {
        name: 'DatabricksGenie',
        kind: 'workflow',
        version: '1',
        version_status: 'active',
        model: '',
        harness: '',
        selectable: false,
        reason: 'no_harness',
      },
    ]
    const { result } = await loaded({ agents: rows, error: null }, onSwitch)

    act(() => result.current.select('DatabricksGenie'))

    expect(result.current.selected).toBeNull()
    expect(onSwitch).not.toHaveBeenCalled()
  })

  it('writes nothing about the choice to storage, so a reload is the default (AC10)', async () => {
    const { result } = await loaded({ agents: ROWS, error: null })

    act(() => result.current.select('foundry-live-agent-hosted'))

    // Asserted as an absence rather than by simulating a reload: "the choice does not survive" is
    // a claim about what was written, and the session list beside it is not persisted either (§5).
    expect({ ...localStorage }).toEqual({})
    expect({ ...sessionStorage }).toEqual({})
  })

  it('clears the switch notice when asked, so it does not outlive the empty conversation', async () => {
    const { result } = await loaded({ agents: ROWS, error: null })

    act(() => result.current.select('foundry-live-agent-hosted'))
    act(() => result.current.clearNotice())

    expect(result.current.switched).toBeNull()
    expect(result.current.selected).toBe('foundry-live-agent-hosted')
  })
})
