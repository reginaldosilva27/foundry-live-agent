/**
 * A voice session, recorded in the order it happened, and replayed into the chat.
 *
 * Two streams feed one log: what was said arrives on the WebRTC data channel, what the agent did
 * arrives as `AgentEvent`s over SSE from the BFF. Keeping them in separate piles — which is what
 * this file replaced — loses the only thing that says which answer a tool call belonged to.
 *
 * `voiceMessages` is pure, so ordering and attribution are testable without rendering anything.
 */
import type { AgentEvent } from '../types/events'
import type { AgentMessage, Message, UserMessage } from '../hooks/useAgentStream'
import { emptyTurn, reduceTurn, type Turn } from './turn'

/** One thing that happened during a session: something said, or something the agent did. */
export type VoiceLogEntry =
  | { kind: 'said'; speaker: 'user' | 'agent'; text: string }
  | { kind: 'event'; event: AgentEvent }

/**
 * Replay a finished session as chat messages: a divider, then the conversation.
 *
 * An agent utterance carries the activity that arrived **since the previous agent utterance** —
 * the only attribution the log supports. Activity left over after the last answer becomes a turn
 * with no text rather than being attached to an answer it did not produce (constitution §5).
 */
export function voiceMessages(log: VoiceLogEntry[], seconds: number): Message[] {
  if (log.length === 0) return []

  const messages: Message[] = [{ role: 'voice-session', id: id(seconds, 'session'), seconds }]
  let pending = emptyTurn()
  let index = 0

  for (const entry of log) {
    if (entry.kind === 'event') {
      pending = reduceTurn(pending, entry.event)
      continue
    }

    if (entry.speaker === 'user') {
      messages.push(userMessage(entry.text, id(seconds, `u${index++}`)))
      continue
    }

    messages.push(agentMessage({ ...pending, text: entry.text }, id(seconds, `a${index++}`)))
    pending = emptyTurn()
  }

  if (pending.activities.length > 0) {
    messages.push(agentMessage(pending, id(seconds, `a${index}`)))
  }

  return messages
}

function userMessage(text: string, key: string): UserMessage {
  return { role: 'user', id: key, text }
}

function agentMessage(turn: Turn, key: string): AgentMessage {
  return { role: 'agent', id: key, turn: { ...turn, status: 'done' }, startedAt: 0, endedAt: 0 }
}

/** Unique within the appended block, and stable across re-renders. */
function id(seconds: number, suffix: string): string {
  return `voice_${seconds}_${suffix}`
}
