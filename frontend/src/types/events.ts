/**
 * The `AgentEvent` contract, mirrored in TypeScript.
 *
 * This file is a **mirror of `ai/harness/_shared/contract.py`**, which is the source of truth
 * (constitution §9). The two move together: `src/types/contract-parity.test.ts` reads the Python
 * module and fails if this union and that `_SCHEMA` disagree, so drift shows up as a red test
 * rather than as a blank card in the UI.
 *
 * Field names are snake_case on purpose — this is what crosses the wire. The reducer is where the
 * shape becomes something React is comfortable with.
 */

export const EVENT_TYPES = [
  'reasoning_summary',
  'text_delta',
  'tool_call',
  'tool_result',
  'mcp_call',
  'usage',
  'trace_ids',
  'error',
  'done',
] as const

export type AgentEventType = (typeof EVENT_TYPES)[number]

/** Who ran the tool. The whole of constitution §8 in one field — see `ToolCard`. */
export type Executor = 'app' | 'foundry'

export interface ReasoningSummary {
  type: 'reasoning_summary'
  text: string
}

export interface TextDelta {
  type: 'text_delta'
  text: string
}

export interface ToolCall {
  type: 'tool_call'
  call_id: string
  name: string
  arguments: string
  executor: Executor
}

export interface ToolResult {
  type: 'tool_result'
  call_id: string
  name: string
  output: string
  duration_ms?: number
  error?: string
}

export interface McpCall {
  type: 'mcp_call'
  server_label: string
  name: string
  arguments: string
  output?: string
  error?: string
}

export interface UsageEvent {
  type: 'usage'
  input_tokens: number
  output_tokens: number
  /** Part of `output_tokens`, not additional to it. The service bills it as output (spec 028). */
  reasoning_tokens?: number
  /** Part of `input_tokens`, not additional to it — the portion served from the prompt cache. */
  cached_input_tokens?: number
}

export interface TraceIdsEvent {
  type: 'trace_ids'
  response_id: string
  conversation_id?: string
  otel_trace_id?: string
  gateway_request_id?: string
}

export interface ErrorEvent {
  type: 'error'
  message: string
  code?: string
}

export interface DoneEvent {
  type: 'done'
  response_id?: string
}

export type AgentEvent =
  | ReasoningSummary
  | TextDelta
  | ToolCall
  | ToolResult
  | McpCall
  | UsageEvent
  | TraceIdsEvent
  | ErrorEvent
  | DoneEvent

const KNOWN: ReadonlySet<string> = new Set(EVENT_TYPES)

/**
 * Is this an event type this build knows how to render?
 *
 * Deliberately shallow: the BFF already validated every event against the contract before framing
 * it, so re-validating each field here would be duplicated logic (§4) with nothing new to say. The
 * one thing worth checking on this side is the type, because that is what changes when the contract
 * grows and this mirror has not caught up.
 */
export function isKnownEvent(value: unknown): value is AgentEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string' &&
    KNOWN.has((value as { type: string }).type)
  )
}
