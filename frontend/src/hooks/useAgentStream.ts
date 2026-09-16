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
  /** Foundry's id for this conversation, once it has given us one. Read-only: the app stores it
   *  beside the transcript so reopening can resume rather than start over (spec 021). */
  conversationId?: string
  /** `agent` names who answers; absent means the BFF's configured default (spec 019). */
  send: (text: string, agent?: string) => Promise<void>
  /** Drop finished messages into the conversation — how a voice session lands here (spec 007). */
  append: (messages: Message[]) => void
  /**
   * Put a stored conversation back: its drawing, and Foundry's id for it (spec 021).
   *
   * The id is the half that matters. Without it this would be a screenshot — the next message
   * would open a conversation Foundry has never heard of, and the agent would have forgotten
   * everything the reader can still see on screen.
   */
  restore: (messages: Message[], conversationId?: string) => void
  reset: () => void
}

export function useAgentStream(): AgentStream {
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  // Foundry owns conversation state; we only carry the id it gave us (§8). The ref is what the
  // streaming closure reads; the state is what callers see — one value, two consumers.
  const conversationId = useRef<string | undefined>(undefined)
  const [conversation, setConversation] = useState<string | undefined>(undefined)
  const nextId = useRef(0)

  const remember = useCallback((id: string | undefined) => {
    conversationId.current = id
    setConversation(id)
  }, [])

  const reset = useCallback(() => {
    remember(undefined)
    setMessages([])
  }, [remember])

  const restore = useCallback(
    (incoming: Message[], id?: string) => {
      // Turn ids are minted from a counter, and a restored transcript already contains some. Move
      // past the highest one so the next turn cannot collide with a turn already on screen.
      nextId.current = Math.max(nextId.current, ...incoming.map(turnNumber).map((n) => n + 1))
      remember(id)
      setMessages(incoming)
    },
    [remember],
  )

  const send = useCallback(async (text: string, agent?: string) => {
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
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId.current,
          agent,
        }),
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
            remember(event.conversation_id)
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
  }, [remember])

  const append = useCallback((incoming: Message[]) => {
    if (incoming.length > 0) setMessages((prev) => [...prev, ...incoming])
  }, [])

  return { messages, streaming, conversationId: conversation, send, append, restore, reset }
}

/** The counter inside a minted message id (`turn_7`, `turn_7_user`), or -1 for anything else. */
function turnNumber(message: Message): number {
  const match = /^turn_(\d+)/.exec(message.id)
  return match ? Number(match[1]) : -1
}

function isTerminal(event: unknown): boolean {
  const type = (event as { type?: unknown })?.type
  return type === 'done' || type === 'error'
}

function isTraceIds(event: unknown): event is { type: 'trace_ids'; conversation_id?: string } {
  return (event as { type?: unknown })?.type === 'trace_ids'
}
