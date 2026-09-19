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
import { emptyTurn, reduceTurn, stopTurn, type Turn } from '../state/turn'

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
  /**
   * This turn answers a question that had been asked before (spec 026).
   *
   * Both turns stay on screen, because that is what the conversation Foundry holds now contains —
   * so the second one has to say it is a repeat, and name who answered it, which may not be who
   * answered the first.
   */
  repeatOf?: { turnId: string; agent?: string }
  /**
   * Every event of this turn, raw, in arrival order (spec 038).
   *
   * Kept **unconditionally**, not only while the inspector is open: a panel opened mid-turn would
   * otherwise show "some of what happened", and the turn a reader opens it for is usually the one
   * that just went wrong.
   *
   * `unknown[]` rather than `AgentEvent[]` on purpose. The inspector's job is to show what crossed
   * the wire, and typing this would quietly hide an event the contract does not know about — which
   * is exactly what somebody opens it to find.
   *
   * **Absent** on a turn that did not come from the SSE stream — a replayed voice session (spec
   * 007) or a restored conversation (spec 021). That is a different fact from a turn which
   * streamed and produced none, and the two stay distinguishable (§5).
   */
  events?: unknown[]
  /** The cap bit. Said out loud rather than dropping the rest silently (AC12). */
  truncated?: boolean
}

/** A pathological turn's ceiling. A long answer is a few hundred deltas; nothing ordinary hits this. */
export const MAX_RETAINED_EVENTS = 2000

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
  /**
   * `agent` names who answers; absent means the BFF's configured default (spec 019).
   * `repeatOf` names the turn this re-asks, when a person pressed repeat (spec 026).
   */
  send: (text: string, agent?: string, repeatOf?: string) => Promise<void>
  /**
   * Stop listening to the turn in flight (spec 023).
   *
   * The browser stops; the run in Foundry does not — we have no documented way to cancel it, and
   * the screen says so rather than implying otherwise (§5). Calling this with nothing running is a
   * no-op, so no caller has to check first.
   */
  stop: () => void
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
  /**
   * The turn in flight, and whether the reader stopped it (spec 023).
   *
   * Two pieces, because they answer different questions. The controller tears the fetch down; the
   * flag is what the read loop checks before applying an event, since frames already decoded in the
   * current chunk would otherwise still land after the abort (AC5).
   */
  const inFlight = useRef<{ controller: AbortController; aborted: boolean } | null>(null)

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

  const stop = useCallback(() => {
    const current = inFlight.current
    if (!current) return
    current.aborted = true
    current.controller.abort()
  }, [])

  const send = useCallback(async (text: string, agent?: string, repeatOf?: string) => {
    const id = `turn_${nextId.current++}`
    const startedAt = Date.now()
    const flight = { controller: new AbortController(), aborted: false }
    inFlight.current = flight

    setMessages((prev) => [
      ...prev,
      { role: 'user', id: `${id}_user`, text },
      {
        role: 'agent',
        id,
        turn: emptyTurn(),
        startedAt,
        events: [],
        ...(repeatOf ? { repeatOf: { turnId: repeatOf, agent } } : {}),
      },
    ])
    setStreaming(true)

    /**
     * Fold one event into the turn and keep the event itself (spec 038).
     *
     * `raw` is retained whether or not anything is watching, which is what lets the inspector be
     * opened at any moment and see the whole turn. Past the cap the events stop accumulating and
     * the message says so — dropping them silently would make the panel lie about what arrived.
     */
    const apply = (mutate: (turn: Turn) => Turn, ended: boolean, raw?: unknown) =>
      setMessages((prev) =>
        prev.map((m) => {
          if (m.role !== 'agent' || m.id !== id) return m
          const kept = m.events ?? []
          const full = raw !== undefined && kept.length >= MAX_RETAINED_EVENTS
          return {
            ...m,
            turn: mutate(m.turn),
            endedAt: ended ? Date.now() : m.endedAt,
            events: raw !== undefined && !full ? [...kept, raw] : kept,
            truncated: m.truncated || full,
          }
        }),
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
        signal: flight.controller.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`the BFF answered ${response.status}`)
      }

      const parse = createFrameParser()
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      for (;;) {
        if (flight.aborted) break
        const { done, value } = await reader.read()
        if (done) break
        for (const event of parse(decoder.decode(value, { stream: true }))) {
          if (flight.aborted) break
          if (isTraceIds(event) && event.conversation_id) {
            remember(event.conversation_id)
          }
          const terminal = isTerminal(event)
          apply((turn) => reduceTurn(turn, event), terminal, event)
        }
      }
    } catch (cause) {
      // A stop is not a failure. Branching on the flag rather than on the exception, because an
      // aborted fetch surfaces in more than one shape and only we know why it was torn down.
      if (flight.aborted) {
        apply(stopTurn, true)
        return
      }
      // A dead BFF is not a contract event, so nothing upstream will produce one. Synthesising it
      // here keeps the single rule the UI relies on: a turn always ends in `done` or `error`.
      const synthesised = {
        type: 'error',
        message: cause instanceof Error ? cause.message : String(cause),
        code: 'transport_error',
      }
      // Retained like any other: a reader inspecting a failed turn wants to see that the error
      // was synthesised here rather than sent, which the payload shows.
      apply((turn) => reduceTurn(turn, synthesised), true, synthesised)
    } finally {
      // The reader may have stopped this turn and started another before this one unwound; only
      // the turn that is still in flight gets to say the app is no longer streaming.
      if (inFlight.current === flight) {
        inFlight.current = null
        setStreaming(false)
      }
      // The loop can also leave through its own guard, without the fetch ever throwing. Same
      // outcome, and `stopTurn` is a no-op on a turn that had already settled.
      if (flight.aborted) apply(stopTurn, true)
    }
  }, [remember])

  const append = useCallback((incoming: Message[]) => {
    if (incoming.length > 0) setMessages((prev) => [...prev, ...incoming])
  }, [])

  return { messages, streaming, conversationId: conversation, send, stop, append, restore, reset }
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
