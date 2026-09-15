/**
 * The event log, reduced into something renderable.
 *
 * The BFF streams an append-only log; this mirrors it. `Turn` is a *derived view* — no state here
 * exists that the event stream did not put there, which is what keeps constitution §8 true on this
 * side of the wire: the UI cannot decide anything, because there is nothing to decide.
 *
 * Every function is pure, so the whole of AC2-AC7 is testable without rendering a single element.
 */
import { isKnownEvent, type AgentEvent, type Executor } from '../types/events'

export type ActivityStatus = 'running' | 'ok' | 'failed'

/** A tool call, with the fact that matters most kept first: who ran it. */
export interface ToolActivity {
  kind: 'tool'
  executor: Executor
  callId: string
  name: string
  arguments: string
  status: ActivityStatus
  output?: string
  durationMs?: number
  error?: string
}

/** A call Foundry made to a remote MCP server. Attributed to the server, not to us (M7). */
export interface McpActivity {
  kind: 'mcp'
  serverLabel: string
  name: string
  arguments: string
  status: ActivityStatus
  output?: string
  error?: string
}

export type Activity = ToolActivity | McpActivity

export type TurnStatus = 'streaming' | 'done' | 'error'

export interface Turn {
  reasoning: string
  activities: Activity[]
  text: string
  usage?: { inputTokens: number; outputTokens: number; reasoningTokens?: number }
  trace?: {
    responseId: string
    conversationId?: string
    otelTraceId?: string
    gatewayRequestId?: string
  }
  error?: { message: string; code?: string }
  status: TurnStatus
  /** Event types this build does not render, counted rather than swallowed (AC3). */
  unknownEvents: Record<string, number>
}

export function emptyTurn(): Turn {
  return { reasoning: '', activities: [], text: '', status: 'streaming', unknownEvents: {} }
}

/** Apply one event, returning a new turn. Never mutates its argument. */
export function reduceTurn(turn: Turn, raw: unknown): Turn {
  if (!isKnownEvent(raw)) {
    const type = typeName(raw)
    return {
      ...turn,
      unknownEvents: { ...turn.unknownEvents, [type]: (turn.unknownEvents[type] ?? 0) + 1 },
    }
  }

  const event: AgentEvent = raw

  switch (event.type) {
    case 'reasoning_summary':
      return { ...turn, reasoning: turn.reasoning + event.text }

    case 'text_delta':
      return { ...turn, text: turn.text + event.text }

    case 'tool_call':
      return {
        ...turn,
        activities: [
          ...turn.activities,
          {
            kind: 'tool',
            executor: event.executor,
            callId: event.call_id,
            name: event.name,
            arguments: event.arguments,
            status: 'running',
          },
        ],
      }

    case 'tool_result':
      return { ...turn, activities: turn.activities.map((a) => resolve(a, event)) }

    case 'mcp_call':
      return {
        ...turn,
        activities: [
          ...turn.activities,
          {
            kind: 'mcp',
            serverLabel: event.server_label,
            name: event.name,
            arguments: event.arguments,
            // Foundry runs MCP calls to completion before telling us, so one of these two
            // arrives already settled — there is no running state to show.
            status: event.error ? 'failed' : 'ok',
            output: event.output,
            error: event.error,
          },
        ],
      }

    case 'usage':
      return {
        ...turn,
        usage: {
          inputTokens: event.input_tokens,
          outputTokens: event.output_tokens,
          reasoningTokens: event.reasoning_tokens,
        },
      }

    case 'trace_ids':
      return {
        ...turn,
        trace: {
          responseId: event.response_id,
          conversationId: event.conversation_id,
          otelTraceId: event.otel_trace_id,
          gatewayRequestId: event.gateway_request_id,
        },
      }

    case 'error':
      return { ...turn, status: 'error', error: { message: event.message, code: event.code } }

    case 'done':
      return { ...turn, status: 'done' }
  }
}

/** Replay a whole log. The test surface for AC2-AC7. */
export function reduceEvents(events: readonly unknown[]): Turn {
  return events.reduce<Turn>(reduceTurn, emptyTurn())
}

function resolve(activity: Activity, event: Extract<AgentEvent, { type: 'tool_result' }>): Activity {
  if (activity.kind !== 'tool' || activity.callId !== event.call_id) return activity
  return {
    ...activity,
    status: event.error ? 'failed' : 'ok',
    output: event.output,
    durationMs: event.duration_ms,
    error: event.error,
  }
}

function typeName(raw: unknown): string {
  if (typeof raw === 'object' && raw !== null && 'type' in raw) {
    const type = (raw as { type: unknown }).type
    if (typeof type === 'string') return type
  }
  return '(malformed)'
}


/** What the turn is doing right now, for the line that says so while it streams (spec 011). */
export type TurnStatusKind = 'idle' | 'thinking' | 'calling' | 'answering' | 'settled'

export interface LiveStatus {
  kind: TurnStatusKind
  /** The tool being run, when one is. */
  name?: string
}

/**
 * Derive what is happening, from the events and nothing else (§5, §8).
 *
 * The priority is the interesting part, and it lives here rather than in the component so it is
 * decided once: a call in flight beats reasoning, and an answer beats both. A turn can be true in
 * several of these at the same moment — `reasoning` is still there while a tool runs — and the
 * question the line answers is "what now", not "what so far".
 *
 * `answering` and `settled` both mean *say nothing*: the answer with its caret is the status once
 * it starts, and a finished turn has a meta line.
 */
export function turnStatus(turn: Turn): LiveStatus {
  if (turn.status !== 'streaming') return { kind: 'settled' }
  if (turn.text) return { kind: 'answering' }

  const running = turn.activities.find((activity) => activity.status === 'running')
  if (running) return { kind: 'calling', name: running.name }

  return turn.reasoning ? { kind: 'thinking' } : { kind: 'idle' }
}
