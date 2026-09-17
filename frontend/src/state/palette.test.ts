/**
 * Spec 025 AC5, AC8 — what the palette contains, and what it refuses to offer.
 *
 * Pure, so the matching is tested without a DOM. The rule that shapes everything: the palette
 * *derives nothing*. Agents arrive with the selectability the BFF gave them, conversations with the
 * titles this browser stored, actions with the labels the binding table names (§4).
 */
import { describe, expect, it } from 'vitest'
import { buildEntries, filterEntries } from './palette'
import type { AgentRow } from '../types/agents'
import type { StoredConversation } from './history'

function row(name: string, overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    name,
    kind: 'prompt',
    version: '8',
    version_status: 'active',
    model: 'gpt-5.5',
    harness: 'prompt-agent',
    selectable: true,
    reason: '',
    ...overrides,
  }
}

function conversation(id: string, title: string): StoredConversation {
  return { id, title, updatedAt: 1, messages: [], agent: null }
}

const input = {
  agents: [row('foundry-live-agent'), row('workflow-one', { selectable: false, reason: 'no_harness' })],
  conversations: [conversation('c_1', 'Conversação sobre Foundry'), conversation('c_2', 'Agentes')],
  voiceEnabled: true,
}

describe('buildEntries', () => {
  it('offers the project\'s agents, the browser\'s conversations and the app\'s actions', () => {
    const groups = new Set(buildEntries(input).map((entry) => entry.group))
    expect(groups).toEqual(new Set(['agents', 'conversations', 'actions']))
  })

  it('keeps an agent the build cannot drive, carrying its reason (AC8)', () => {
    const blocked = buildEntries(input).find((entry) => entry.id === 'agent:workflow-one')

    expect(blocked?.runnable).toBe(false)
    expect(blocked?.reason).toBe('no_harness')
  })

  it('leaves a selectable agent runnable and unexplained', () => {
    const ok = buildEntries(input).find((entry) => entry.id === 'agent:foundry-live-agent')

    expect(ok?.runnable).toBe(true)
    expect(ok?.reason).toBeUndefined()
  })

  it('marks voice unrunnable where the deployment has none (AC8)', () => {
    const entries = buildEntries({ ...input, voiceEnabled: false })

    expect(entries.find((entry) => entry.id === 'action:startVoice')?.runnable).toBe(false)
  })

  it('names every action from the binding table, so the labels cannot drift (§4)', () => {
    const actions = buildEntries(input).filter((entry) => entry.group === 'actions')

    for (const action of actions) expect(action.label).toMatch(/^keys\./)
  })
})

describe('filterEntries', () => {
  const entries = buildEntries(input)

  it('returns everything for an empty query', () => {
    expect(filterEntries(entries, '')).toHaveLength(entries.length)
  })

  it('matches regardless of case', () => {
    expect(filterEntries(entries, 'FOUNDRY').map((e) => e.id)).toContain('agent:foundry-live-agent')
  })

  it('folds accents, because the interface is half Portuguese (§7)', () => {
    const ids = filterEntries(entries, 'conversacao').map((e) => e.id)
    expect(ids).toContain('conversation:c_1')
  })

  it('folds accents the other way too', () => {
    const ids = filterEntries(entries, 'agentés').map((e) => e.id)
    expect(ids).toContain('conversation:c_2')
  })

  it('matches nothing when nothing matches', () => {
    expect(filterEntries(entries, 'zzzz')).toEqual([])
  })

  it('keeps an unrunnable match visible rather than hiding it (AC8)', () => {
    const ids = filterEntries(entries, 'workflow').map((e) => e.id)
    expect(ids).toContain('agent:workflow-one')
  })
})
