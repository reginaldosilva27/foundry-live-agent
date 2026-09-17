/**
 * What the command palette contains (spec 025).
 *
 * Pure on purpose: the list and the matching are the part worth testing, and neither needs a DOM.
 *
 * **The palette derives nothing.** Agents arrive with the `selectable` and `reason` the BFF gave
 * them — `HARNESS_FOR_KIND` is the BFF's knowledge and a copy of that rule here would be the §4
 * violation spec 019 warned about. Conversations arrive with the titles this browser stored.
 * Actions are named by the binding table. Everything this module does is arrange and filter.
 */
import { BINDINGS, type Command } from './keys'
import type { StoredConversation } from './history'
import type { AgentRow } from '../types/agents'

export type EntryGroup = 'agents' | 'conversations' | 'actions'

export interface Entry {
  id: string
  group: EntryGroup
  /** What the reader sees. For an action it is a string key; for the rest it is the name itself. */
  label: string
  /** Agent and conversation labels are data and are rendered verbatim (§7's proper-noun rule). */
  translated: boolean
  runnable: boolean
  /** Why it cannot be run — a CODE the UI translates, never prose (§7). */
  reason?: string
  target: { kind: 'agent'; name: string } | { kind: 'conversation'; id: string } | { kind: 'command'; command: Command }
}

/** Actions the palette offers that no key names, so they are listed here and nowhere else. */
const EXTRA_ACTIONS: { command: Command; label: string }[] = [
  { command: 'startVoice', label: 'keys.startVoice' },
  { command: 'switchLanguage', label: 'keys.language' },
]

export interface PaletteInput {
  agents: AgentRow[]
  conversations: StoredConversation[]
  voiceEnabled: boolean
}

export function buildEntries({ agents, conversations, voiceEnabled }: PaletteInput): Entry[] {
  return [
    ...agents.map<Entry>((agent) => ({
      id: `agent:${agent.name}`,
      group: 'agents',
      label: agent.name,
      translated: false,
      runnable: agent.selectable,
      reason: agent.reason || undefined,
      target: { kind: 'agent', name: agent.name },
    })),

    ...conversations.map<Entry>((conversation) => ({
      id: `conversation:${conversation.id}`,
      group: 'conversations',
      label: conversation.title,
      translated: false,
      runnable: true,
      target: { kind: 'conversation', id: conversation.id },
    })),

    // The bound commands, labelled by the table so the palette and the tooltips say the same thing.
    // `openPalette` is not offered: it is how the reader got here.
    ...BINDINGS.filter((binding) => binding.command !== 'openPalette').map<Entry>((binding) => ({
      id: `action:${binding.command}`,
      group: 'actions',
      label: binding.label,
      translated: true,
      runnable: true,
      target: { kind: 'command', command: binding.command },
    })),

    ...EXTRA_ACTIONS.map<Entry>((action) => ({
      id: `action:${action.command}`,
      group: 'actions',
      label: action.label,
      translated: true,
      runnable: action.command === 'startVoice' ? voiceEnabled : true,
      target: { kind: 'command', command: action.command },
    })),
  ]
}

/**
 * Substring match, case- and accent-insensitive.
 *
 * Accent folding is not a nicety in a `pt` interface: a reader typing `conversacao` must find
 * `Conversação`, and typing `agentés` must find `Agentes`. `normalize('NFD')` plus stripping the
 * combining marks is the right tool for Portuguese specifically — it is not general collation, and
 * `Intl.Collator` would be the answer if this ever needed to sort rather than match.
 *
 * An entry that cannot be run still matches. Hiding it would answer "why is that agent missing?"
 * with silence, which is the thing spec 019 refused on the agents screen (§5).
 */
export function filterEntries(entries: Entry[], query: string): Entry[] {
  const needle = fold(query)
  if (!needle) return entries
  return entries.filter((entry) => fold(entry.label).includes(needle))
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
