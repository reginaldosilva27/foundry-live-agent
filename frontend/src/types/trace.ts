/**
 * What `GET /trace/{response_id}` answers (spec 005).
 *
 * Mirrors `backend/app/traces.py`'s `Trace`/`Span` dataclasses. Four statuses, each rendered
 * differently, because "no spans yet" and "no permission" and "not configured" are three different
 * things a reader can act on differently (§5).
 */
export type TraceStatus = 'ok' | 'pending' | 'denied' | 'failed' | 'unavailable'

/** `agent` is the run, `model` a chat call, `tool` a tool **Foundry** executed. */
export type SpanKind = 'agent' | 'model' | 'tool' | 'other'

export interface Span {
  name: string
  span_id: string
  parent_id: string
  duration_ms: number
  /** Milliseconds after the run's earliest span — what puts bars on a shared axis. */
  start_ms: number
  kind: SpanKind
}

export interface Trace {
  status: TraceStatus
  otel_trace_id?: string
  spans: Span[]
  usage?: { input_tokens?: number; output_tokens?: number; cached_tokens?: number }
  model?: string
  agent_version?: string
  message?: string
}
