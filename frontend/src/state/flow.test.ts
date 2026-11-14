/**
 * A turn's journey, as data (spec 066).
 *
 * Driven by the §9 contract events the frontend consumes (`test/fixtures.ts` — hand-built contract
 * events, not recordings) and by span names in the **recorded** shape
 * (`ai/tests/fixtures/recorded/appinsights-spans-20260916.jsonl`: `execute_tool
 * mcp_microsoft_learn.microsoft_docs_search`, `chat gpt-5.5-2026-04-24`).
 */
import { describe, expect, it } from 'vitest'
import { buildFlow, gatewayState, harnessOf, layoutFlow, type Flow, type FlowInput } from './flow'
import { emptyTurn, reduceTurn, type Turn } from './turn'
import { failedTurn, twoToolTurn } from '../test/fixtures'
import type { AgentEvent } from '../types/events'
import type { Span, Trace } from '../types/trace'

function turnOf(events: AgentEvent[]): Turn {
  return events.reduce<Turn>((turn, event) => reduceTurn(turn, event), emptyTurn())
}

const answered: AgentEvent[] = [
  { type: 'text_delta', text: 'Hello.' },
  { type: 'usage', input_tokens: 10, output_tokens: 2 },
  { type: 'trace_ids', response_id: 'resp_a', conversation_id: 'conv_a' },
  { type: 'done', response_id: 'resp_a' },
]

/** The hosted container ran its own tool: `executor: foundry`, answered before the app sees it. */
const hostedTool: AgentEvent[] = [
  {
    type: 'tool_call',
    call_id: 'call_h',
    name: 'lookup_knowledge',
    arguments: '{"query":"bff"}',
    executor: 'foundry',
  },
  { type: 'tool_result', call_id: 'call_h', name: 'lookup_knowledge', output: '…', duration_ms: 12 },
  ...answered,
]

function input(over: Partial<FlowInput> = {}): FlowInput {
  return {
    turn: turnOf(answered),
    spoken: false,
    harness: 'prompt',
    gateway: 'off',
    model: 'gpt-5.5',
    ...over,
  }
}

const route = (flow: Flow) => flow.hops.map((hop) => `${hop.from}>${hop.to}`)

function span(over: Partial<Span>): Span {
  return { name: 'chat gpt-5.5-2026-04-24', span_id: 's', parent_id: 'root', duration_ms: 100, start_ms: 0, kind: 'model', ...over }
}

function okTrace(spans: Span[]): Trace {
  return { status: 'ok', spans }
}

describe('buildFlow — a typed turn', () => {
  it('travels browser, BFF, agent, model and back when nothing was called (AC1)', () => {
    expect(route(buildFlow(input()))).toEqual([
      'browser>bff',
      'bff>agent',
      'agent>model',
      'model>agent',
      'agent>bff',
      'bff>browser',
    ])
  })

  it('draws an app call as a round trip to the BFF, between the model asking and the results going back (AC2)', () => {
    const flow = buildFlow(input({ turn: turnOf(twoToolTurn) }))

    expect(route(flow)).toEqual([
      'browser>bff',
      'bff>agent',
      'agent>model',
      'model>agent',
      'agent>bff',
      'bff>agent',
      'agent>mcp:microsoft_learn',
      'mcp:microsoft_learn>agent',
      'agent>model',
      'model>agent',
      'agent>bff',
      'bff>browser',
    ])
    expect(flow.hops[4]).toMatchObject({ kind: 'appCall', name: 'get_current_datetime' })
    expect(flow.hops[5]).toMatchObject({ kind: 'appResult', name: 'get_current_datetime' })
    expect(flow.hops[3].kind).toBe('modelAsks')
    expect(flow.hops[8].kind).toBe('results')
  })

  it('keeps the calls in their step order, not in the order they are listed (AC2)', () => {
    const turn = turnOf(twoToolTurn)
    const reversed = { ...turn, activities: [...turn.activities].reverse() }

    expect(route(buildFlow(input({ turn: reversed })))).toEqual(route(buildFlow(input({ turn }))))
  })

  it('sends an MCP call to a component named by its server, never through the BFF (AC3)', () => {
    const flow = buildFlow(input({ turn: turnOf(twoToolTurn) }))
    const mcp = flow.hops.filter((hop) => hop.kind === 'mcpCall' || hop.kind === 'mcpResult')

    expect(mcp).toHaveLength(2)
    expect(mcp.every((hop) => hop.from !== 'bff' && hop.to !== 'bff')).toBe(true)
    expect(flow.nodes).toContainEqual({ id: 'mcp:microsoft_learn', role: 'mcp', name: 'microsoft_learn' })
    expect(mcp[0]).toMatchObject({ server: 'microsoft_learn', name: 'microsoft_docs_search' })
  })

  it('keeps a call Foundry ran on Foundry side, named by the tool (AC3)', () => {
    const flow = buildFlow(input({ turn: turnOf(hostedTool), harness: 'hosted' }))

    expect(route(flow)).toContain('agent>tool:lookup_knowledge')
    expect(route(flow)).toContain('tool:lookup_knowledge>agent')
    expect(route(flow).filter((r) => r.includes('bff'))).toEqual(['browser>bff', 'bff>agent', 'agent>bff', 'bff>browser'])
  })

  it('numbers nothing that nothing measured (AC7)', () => {
    const flow = buildFlow(
      input({
        turn: turnOf(twoToolTurn),
        gateway: 'on',
        trace: okTrace([span({ span_id: 'm1' }), span({ name: 'execute_tool mcp_microsoft_learn.microsoft_docs_search', kind: 'tool', span_id: 't1', duration_ms: 106 })]),
      }),
    )
    const numbered = flow.hops.filter((hop) => hop.durationMs !== undefined).map((hop) => hop.kind)

    expect(numbered.sort()).toEqual(['appResult', 'mcpResult'])
  })
})

describe('gatewayState (AC4)', () => {
  const base = { spoken: false, harness: 'prompt' as const, defaultAgent: 'foundry-live-agent', usesGateway: true }

  it('follows the deployment flag for the default agent, or when no agent was chosen', () => {
    expect(gatewayState({ ...base, answeringAgent: 'foundry-live-agent' })).toBe('on')
    expect(gatewayState({ ...base, answeringAgent: undefined })).toBe('on')
    expect(gatewayState({ ...base, answeringAgent: 'foundry-live-agent', usesGateway: false })).toBe('off')
  })

  it('does not borrow the default agent answer for any other agent', () => {
    expect(gatewayState({ ...base, answeringAgent: 'dataagent' })).toBe('unknown')
  })

  it('cannot know for a hosted agent, which picks its model inside its container', () => {
    expect(gatewayState({ ...base, answeringAgent: 'foundry-live-agent', harness: 'hosted' })).toBe('unknown')
  })

  it('is never on a Voice Live path', () => {
    expect(gatewayState({ ...base, answeringAgent: 'foundry-live-agent', spoken: true })).toBe('off')
  })

  it('routes the model legs through the gateway only when it is on, and gives it no duration', () => {
    const on = buildFlow(input({ turn: turnOf(twoToolTurn), gateway: 'on' }))
    const off = buildFlow(input({ turn: turnOf(twoToolTurn), gateway: 'off' }))
    const toModel = (flow: Flow) => flow.hops.filter((hop) => hop.to === 'model')

    expect(toModel(on).every((hop) => hop.viaGateway === true && hop.durationMs === undefined)).toBe(true)
    expect(toModel(off).some((hop) => hop.viaGateway)).toBe(false)
    expect(on.gateway).toBe('on')
  })
})

describe('buildFlow — what the spans measured', () => {
  it('counts the model spans of the leg, in start order (AC5)', () => {
    const flow = buildFlow(
      input({
        trace: okTrace([
          span({ span_id: 'root', kind: 'agent', name: 'invoke_agent foundry-live-agent:3', duration_ms: 1348 }),
          span({ span_id: 'late', start_ms: 900, duration_ms: 1422 }),
          span({ span_id: 'early', start_ms: 10, duration_ms: 174 }),
        ]),
      }),
    )

    expect(flow.measurement).toBe('ok')
    expect(flow.model.callsMs).toEqual([174, 1422])
  })

  it('says the earlier leg is not counted when the turn had an app round trip (AC5)', () => {
    expect(buildFlow(input({ turn: turnOf(twoToolTurn), trace: okTrace([]) })).otherLeg).toBe(true)
    expect(buildFlow(input({ turn: turnOf(hostedTool), trace: okTrace([]) })).otherLeg).toBe(false)
  })

  it('gives no count while the spans are not read, and names why (AC5)', () => {
    expect(buildFlow(input()).measurement).toBe('loading')
    for (const status of ['pending', 'denied', 'failed', 'unavailable'] as const) {
      const flow = buildFlow(input({ trace: { status, spans: [] } }))
      expect(flow.measurement).toBe(status)
      expect(flow.model.callsMs).toBeUndefined()
    }
  })

  it('reads nothing for a turn with no response id, spoken or not (AC5)', () => {
    const typed = turnOf([{ type: 'text_delta', text: 'partial' }])
    expect(buildFlow(input({ turn: { ...typed, status: 'stopped' } })).measurement).toBe('no-id')
    expect(buildFlow(input({ turn: { ...turnOf(answered), trace: undefined }, spoken: true })).measurement).toBe('no-id')
  })

  it('takes an app call duration from its result (AC6)', () => {
    const flow = buildFlow(input({ turn: turnOf(twoToolTurn) }))
    expect(flow.hops.find((hop) => hop.kind === 'appResult')?.durationMs).toBe(3)
  })

  it('takes a Foundry call duration from the one span that carries its name (AC6)', () => {
    const flow = buildFlow(
      input({
        turn: turnOf(twoToolTurn),
        trace: okTrace([span({ name: 'execute_tool mcp_microsoft_learn.microsoft_docs_search', kind: 'tool', span_id: 't1', duration_ms: 106 })]),
      }),
    )
    expect(flow.hops.find((hop) => hop.kind === 'mcpResult')?.durationMs).toBe(106)
  })

  it('refuses to choose between two spans, or between two calls, of one name (AC6)', () => {
    const search = (id: string) => span({ name: 'execute_tool mcp_microsoft_learn.microsoft_docs_search', kind: 'tool', span_id: id })
    const twoSpans = buildFlow(input({ turn: turnOf(twoToolTurn), trace: okTrace([search('a'), search('b')]) }))
    expect(twoSpans.hops.find((hop) => hop.kind === 'mcpResult')?.durationMs).toBeUndefined()

    const mcp = twoToolTurn.find((e) => e.type === 'mcp_call') as AgentEvent
    const twice = turnOf([mcp, mcp, ...answered])
    const twoCalls = buildFlow(input({ turn: twice, trace: okTrace([search('a')]) }))
    expect(twoCalls.hops.filter((hop) => hop.kind === 'mcpResult').every((hop) => hop.durationMs === undefined)).toBe(true)
  })

  it('never matches a span by a name that merely contains the tool name (AC6)', () => {
    const flow = buildFlow(
      input({
        turn: turnOf(twoToolTurn),
        trace: okTrace([span({ name: 'execute_tool mcp_microsoft_learn.microsoft_docs_search_v2', kind: 'tool', span_id: 'x' })]),
      }),
    )
    expect(flow.hops.find((hop) => hop.kind === 'mcpResult')?.durationMs).toBeUndefined()
  })
})

describe('harnessOf (AC9)', () => {
  it('names who runs the loop from the harness the listing reports', () => {
    expect(harnessOf('prompt-agent')).toBe('prompt')
    expect(harnessOf('langgraph')).toBe('hosted')
    expect(harnessOf('')).toBe('unknown')
    expect(harnessOf(undefined)).toBe('unknown')
  })

  it('carries the harness on the flow', () => {
    expect(buildFlow(input({ harness: 'hosted' })).harness).toBe('hosted')
  })
})

describe('buildFlow — a spoken turn (AC8)', () => {
  const spoken = (events: AgentEvent[]) => ({ ...turnOf(events), trace: undefined, status: 'done' as const })

  it('travels through Voice Live both ways and never through the BFF when nothing was called', () => {
    const flow = buildFlow(input({ turn: spoken([{ type: 'text_delta', text: 'Oi.' }]), spoken: true }))

    expect(route(flow)).toEqual([
      'browser>voice',
      'voice>agent',
      'agent>model',
      'model>agent',
      'agent>voice',
      'voice>browser',
    ])
    expect(flow.mode).toBe('spoken')
    expect(flow.nodes.map((node) => node.id)).toContain('bff')
  })

  it('answers an app call on the session: agent, Voice Live, BFF, Voice Live, agent', () => {
    const flow = buildFlow(input({ turn: spoken(twoToolTurn), spoken: true }))

    expect(route(flow).slice(3, 8)).toEqual(['model>agent', 'agent>voice', 'voice>bff', 'bff>voice', 'voice>agent'])
    expect(flow.hops.find((hop) => hop.kind === 'voiceResult')?.durationMs).toBe(3)
  })

  it('carries no span-measured duration and reads no spans', () => {
    const flow = buildFlow(input({ turn: spoken(twoToolTurn), spoken: true, trace: okTrace([span({})]) }))

    expect(flow.measurement).toBe('no-id')
    expect(flow.model.callsMs).toBeUndefined()
    expect(flow.hops.filter((hop) => hop.durationMs !== undefined).map((hop) => hop.kind)).toEqual(['voiceResult'])
  })
})

describe('buildFlow — a turn that did not finish (AC10)', () => {
  it('draws only the request when nothing arrived, then the failure coming back', () => {
    const turn = turnOf([{ type: 'error', message: 'PermissionDeniedError', code: 'harness_error' }])
    const flow = buildFlow(input({ turn }))

    expect(route(flow)).toEqual(['browser>bff', 'bff>browser'])
    expect(flow.hops[1]).toMatchObject({ kind: 'failed', mark: 'failed' })
    expect(flow.errorCode).toBe('harness_error')
  })

  it('draws through the answer when text arrived before the failure', () => {
    const flow = buildFlow(input({ turn: turnOf(failedTurn) }))

    expect(route(flow)).toEqual([
      'browser>bff',
      'bff>agent',
      'agent>model',
      'model>agent',
      'agent>bff',
      'bff>browser',
      'bff>browser',
    ])
    expect(flow.hops.at(-1)).toMatchObject({ kind: 'failed', mark: 'failed' })
    expect(flow.errorCode).toBe('model_not_found')
  })

  it('draws the calls that arrived, and only those, when stopped mid-call', () => {
    const calling: AgentEvent[] = [twoToolTurn[2]]
    const flow = buildFlow(input({ turn: { ...turnOf(calling), status: 'stopped' } }))

    expect(route(flow)).toEqual(['browser>bff', 'bff>agent', 'agent>model', 'model>agent', 'agent>bff'])
    expect(flow.hops.at(-1)?.mark).toBe('stopped')
    expect(flow.hops.filter((hop) => hop.mark === 'failed')).toEqual([])
  })

  it('marks a call that failed on its own', () => {
    const failing: AgentEvent[] = [
      twoToolTurn[2],
      { type: 'tool_result', call_id: 'call_1', name: 'get_current_datetime', output: '', error: 'boom', duration_ms: 1 },
      ...answered,
    ]
    const flow = buildFlow(input({ turn: turnOf(failing) }))

    expect(flow.hops.find((hop) => hop.kind === 'appResult')?.mark).toBe('failed')
  })
})

describe('layoutFlow (AC17)', () => {
  it('lays the main path along one axis, with calls on a row below the agent', () => {
    const flow = buildFlow(input({ turn: turnOf(twoToolTurn) }))
    const placed = Object.fromEntries(layoutFlow(flow, 'horizontal').nodes.map((n) => [n.id, n]))

    expect(placed.browser.col).toBeLessThan(placed.bff.col)
    expect(placed.bff.col).toBeLessThan(placed.agent.col)
    expect(placed.agent.col).toBeLessThan(placed.model.col)
    expect(new Set([placed.browser.row, placed.bff.row, placed.agent.row, placed.model.row]).size).toBe(1)
    expect(placed['mcp:microsoft_learn'].row).toBeGreaterThan(placed.agent.row)
  })

  it('puts the gateway on the model leg when it is on, and beside it otherwise', () => {
    const at = (gateway: 'on' | 'off') => {
      const nodes = layoutFlow(buildFlow(input({ gateway })), 'horizontal').nodes
      return { gw: nodes.find((n) => n.id === 'gateway')!, agent: nodes.find((n) => n.id === 'agent')! }
    }
    expect(at('on').gw.row).toBe(at('on').agent.row)
    expect(at('off').gw.row).not.toBe(at('off').agent.row)
  })

  it('transposes the same layout for a narrow screen', () => {
    const flow = buildFlow(input({ turn: turnOf(twoToolTurn) }))
    const wide = layoutFlow(flow, 'horizontal')
    const tall = layoutFlow(flow, 'vertical')

    expect(tall.cols).toBe(wide.rows)
    expect(tall.rows).toBe(wide.cols)
    for (const node of wide.nodes) {
      expect(tall.nodes.find((n) => n.id === node.id)).toEqual({ id: node.id, col: node.row, row: node.col })
    }
  })

  it('places every node a hop names, and names an edge for every hop', () => {
    const flow = buildFlow(input({ turn: turnOf(twoToolTurn), gateway: 'on' }))
    const { nodes, edges } = layoutFlow(flow, 'horizontal')
    const ids = new Set(nodes.map((n) => n.id))

    for (const hop of flow.hops) {
      expect(ids.has(hop.from) && ids.has(hop.to)).toBe(true)
    }
    expect(edges).toContainEqual({ a: 'agent', b: 'gateway' })
    expect(edges).toContainEqual({ a: 'gateway', b: 'model' })
  })
})
