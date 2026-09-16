/**
 * Event sequences used across the frontend tests.
 *
 * These are hand-built *contract* events, not recorded Foundry payloads: they exercise the
 * frontend's reducer against the §9 vocabulary, which is exactly what the frontend consumes.
 * Recorded Foundry fixtures live in `ai/tests/fixtures/recorded/` and are the harness's problem
 * (constitution §5 — nothing here pretends to be a recording).
 */
import type { AgentEvent } from '../types/events'

/** A turn that calls one app tool and one Foundry-side MCP tool, then answers. */
export const twoToolTurn: AgentEvent[] = [
  { type: 'reasoning_summary', text: 'The user asked ' },
  { type: 'reasoning_summary', text: 'what time it is.' },
  {
    type: 'tool_call',
    call_id: 'call_1',
    name: 'get_current_datetime',
    arguments: '{"timezone":"America/Sao_Paulo"}',
    executor: 'app',
  },
  {
    type: 'tool_result',
    call_id: 'call_1',
    name: 'get_current_datetime',
    output: '{"iso":"2026-09-04T19:00:00-03:00"}',
    duration_ms: 3,
  },
  {
    type: 'mcp_call',
    server_label: 'microsoft_learn',
    name: 'microsoft_docs_search',
    arguments: '{"query":"hosted agents"}',
    output: 'Foundry hosted agents run inside the service.',
  },
  { type: 'text_delta', text: 'It is ' },
  { type: 'text_delta', text: '19:00 in Sao Paulo.' },
  { type: 'usage', input_tokens: 120, output_tokens: 34 },
  { type: 'trace_ids', response_id: 'resp_1', conversation_id: 'conv_1' },
  { type: 'done', response_id: 'resp_1' },
]

/** A turn that dies before answering. */
export const failedTurn: AgentEvent[] = [
  { type: 'text_delta', text: 'Let me check' },
  { type: 'error', message: 'the model deployment was not found', code: 'model_not_found' },
]

/** Render one event list as the SSE frames the BFF would send. */
export function asSseStream(events: AgentEvent[]): string {
  return events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
}

/**
 * A turn that searches the same tool over and over, each time for something different.
 *
 * Shaped after a real turn observed 2026-09-16 — seven `lookup_knowledge` calls answering "How does
 * this project talk to Microsoft Foundry?", which rendered as seven identical rows (spec 015).
 * Hand-built contract events like everything else in this file; the recording it is modelled on is
 * `ai/tests/fixtures/recorded/prompt-agent-turn-20260915.jsonl`.
 */
export const repeatedCallTurn: AgentEvent[] = [
  ...['the BFF', 'the harness contract', 'client-side tools'].flatMap(
    (query, index): AgentEvent[] => [
      {
        type: 'tool_call',
        call_id: `call_${index + 1}`,
        name: 'lookup_knowledge',
        arguments: JSON.stringify({ query }),
        executor: 'app',
      },
      {
        type: 'tool_result',
        call_id: `call_${index + 1}`,
        name: 'lookup_knowledge',
        output: '…',
        duration_ms: 1,
      },
    ],
  ),
  { type: 'text_delta', text: 'Foundry owns the agent loop.' },
  { type: 'trace_ids', response_id: 'resp_2' },
  { type: 'done', response_id: 'resp_2' },
]
