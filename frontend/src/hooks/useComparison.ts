/**
 * Two agents, one question (spec 020).
 *
 * **There is no transport here, because there did not need to be one.** The spec left the choice
 * open — one multiplexed stream, or one stream per agent — and preferred the second "precisely
 * because it needs no contract change". Reading the BFF settles it: `POST /chat` already takes
 * `agent` per request and resolves the harness per request without touching `app.state.harness`
 * (spec 019). So a comparison is two ordinary posts, and this module is composition rather than
 * plumbing: two `useAgentStream`s, and the two operations that must reach both.
 *
 * Three properties fall out of that shape rather than being rules somebody has to keep:
 *
 * - **Two conversations** (AC10). Each stream owns its own `conversation_id`; nothing here can
 *   merge them because nothing here can see them.
 * - **Independent failure** (AC8). The columns share no state, so one erroring cannot reach the
 *   other.
 * - **No agent loop** (§8). A person typed one question and a person chose both agents. Nothing
 *   reads either answer, and in particular nothing compares them — the app draws two columns and
 *   says nothing about which is better, which is the spec's first non-goal.
 *
 * What this module does *not* hold is who answers the left column. That is the agents state's
 * (spec 019), and a second copy here would be the drift §4 is about — so it arrives as an argument
 * at send time.
 */
import { useCallback, useMemo, useState } from 'react'
import { useAgentStream, type AgentStream, type Message } from './useAgentStream'

export interface Comparison {
  left: AgentStream
  right: AgentStream
  /** Who the second column asks, or `null` while nobody has been chosen (AC11: any agent). */
  other: string | null
  /** Choose the second agent. A different one starts that column over — see below. */
  choose: (name: string | null) => void
  /** Either column still running. Both controls read this, so neither can disagree with it. */
  streaming: boolean
  /**
   * Both columns' messages, for the surfaces that address a turn by id — the trace panel, the
   * event inspector, the log reader. Safe to concatenate only because the two streams mint ids
   * under different prefixes; without that they would both produce `turn_0`.
   */
  messages: Message[]
  /** One question to both. `first` is who the left column asks; the right asks `other`. */
  send: (text: string, first?: string) => void
  /** Stop both. Neither Foundry run stops — the browser stops listening (spec 023). */
  stop: () => void
  /** Forget both local drawings and pointers, never delete a service conversation. */
  reset: () => void
}

export function useComparison(): Comparison {
  const left = useAgentStream('left')
  const right = useAgentStream('right')
  const [other, setOther] = useState<string | null>(null)

  const choose = useCallback(
    (name: string | null) => {
      if (name === other || left.streaming || right.streaming) return
      setOther(name)
      // A Foundry conversation belongs to one agent (019 AC7), so the thread the previous second
      // agent held cannot be handed to the next one. Only this column resets: the left is still
      // the same agent answering the same thread, and clearing it would throw away half a
      // comparison the reader did not ask to end.
      right.reset()
    },
    [other, left.streaming, right],
  )

  const send = useCallback(
    (text: string, first?: string) => {
      // Nothing to compare against yet. The composer is disabled in this state; this is the second
      // line, so a send arriving any other way cannot produce a one-column "comparison".
      if (!other || left.streaming || right.streaming) return
      // Both fired before either is awaited — that is the whole of AC1. `void` rather than
      // `await`, because awaiting the first here would make the second column start when the
      // first finished, which is the sequential comparison this spec exists to replace.
      void left.send(text, first)
      void right.send(text, other)
    },
    [left, other, right],
  )

  const stop = useCallback(() => {
    left.stop()
    right.stop()
  }, [left, right])

  const reset = useCallback(() => {
    if (left.streaming || right.streaming) return
    left.reset()
    right.reset()
  }, [left, right])

  const messages = useMemo(() => [...left.messages, ...right.messages], [left.messages, right.messages])

  return {
    left,
    right,
    other,
    choose,
    streaming: left.streaming || right.streaming,
    messages,
    send,
    stop,
    reset,
  }
}
