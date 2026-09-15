/**
 * The conversation, driven by one SSE stream per turn.
 *
 * `EventSource` is not usable here — it is GET-only and `/chat` is a POST — so this reads the
 * response body directly (design-system note M1: the mock's footer said WebSocket; it is SSE).
 *
 * The hook holds messages and nothing else. It never decides what to send back to the model, never
 * re-prompts, and never inspects a tool name: constitution §8 says the loop lives in Foundry, and
 * the BFF answers the function calls. Everything here is a projection of the event log.
 */
import { useCallback, useRef, useState } from 'react'
import { BFF_URL } from '../config'
import { createFrameParser } from '../state/sse'
import { emptyTurn, reduceTurn, type Turn } from '../state/turn'

export interface UserMessage {
  role: 'user'
  id: string
  text: string
}

export interface AgentMessage {
  role: 'agent'
  id: string
  turn: Turn
  startedAt: number
  endedAt?: number
}

/** The line that opens a replayed voice session in the chat (spec 007). */
export interface VoiceSessionMessage {
  role: 'voice-session'
  id: string
  seconds: number
}

export type Message = UserMessage | AgentMessage | VoiceSessionMessage

export interface AgentStream {
  messages: Message[]
  streaming: boolean
  send: (text: string) => Promise<void>
  /** Drop finished messages into the conversation — how a voice session lands here (spec 007). */
  append: (messages: Message[]) => void
  reset: () => void
}

export function useAgentStream(): AgentStream {
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  // Foundry owns conversation state; we only carry the id it gave us (§8).
  const conversationId = useRef<string | undefined>(undefined)
  const nextId = useRef(0)

  const reset = useCallback(() => {
    conversationId.current = undefined
    setMessages([])
  }, [])

  const send = useCallback(async (text: string) => {
    const id = `turn_${nextId.current++}`
    const startedAt = Date.now()

    setMessages((prev) => [
      ...prev,
      { role: 'user', id: `${id}_user`, text },
      { role: 'agent', id, turn: emptyTurn(), startedAt },
    ])
    setStreaming(true)

    const apply = (mutate: (turn: Turn) => Turn, ended: boolean) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.role === 'agent' && m.id === id
            ? { ...m, turn: mutate(m.turn), endedAt: ended ? Date.now() : m.endedAt }
            : m,
        ),
      )

    try {
      const response = await fetch(`${BFF_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversation_id: conversationId.current }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`the BFF answered ${response.status}`)
      }

      const parse = createFrameParser()
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        for (const event of parse(decoder.decode(value, { stream: true }))) {
          if (isTraceIds(event) && event.conversation_id) {
            conversationId.current = event.conversation_id
          }
          const terminal = isTerminal(event)
          apply((turn) => reduceTurn(turn, event), terminal)
        }
      }
    } catch (cause) {
      // A dead BFF is not a contract event, so nothing upstream will produce one. Synthesising it
      // here keeps the single rule the UI relies on: a turn always ends in `done` or `error`.
      apply(
        (turn) =>
          reduceTurn(turn, {
            type: 'error',
            message: cause instanceof Error ? cause.message : String(cause),
            code: 'transport_error',
          }),
        true,
      )
    } finally {
      setStreaming(false)
    }
  }, [])

  const append = useCallback((incoming: Message[]) => {
    if (incoming.length > 0) setMessages((prev) => [...prev, ...incoming])
  }, [])

  return { messages, streaming, send, append, reset }
}

function isTerminal(event: unknown): boolean {
  const type = (event as { type?: unknown })?.type
  return type === 'done' || type === 'error'
}

function isTraceIds(event: unknown): event is { type: 'trace_ids'; conversation_id?: string } {
  return (event as { type?: unknown })?.type === 'trace_ids'
}
