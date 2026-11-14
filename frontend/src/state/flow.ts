/**
 * A turn's journey, as data (spec 066).
 *
 * The flow view draws whatever this module returns and decides nothing itself, so every claim the
 * picture makes — which components the turn passed through, in what order, and how long a hop took
 * — is a fact a test can assert without rendering anything.
 *
 * **Three rules this module exists to keep:**
 *
 * - **Built from what the turn proved, never from a template.** The hops come from the turn's
 *   activities (who ran each call is `executor`, its place is `step`), its text and its status. A
 *   turn that failed before anything arrived draws the request to the BFF and the failure coming
 *   back — because the error may not have come from Foundry at all (§5).
 * - **The hops are logical, not one per model call.** "The model asks for calls" and "the results go
 *   back" summarise; how many times the model was really called is what the spans say, and only for
 *   the leg they cover. A turn with an app round trip is two legs and two traces, and the turn holds
 *   the id of the last one (`hadRoundTrip`, spec 029).
 * - **Nothing nobody measured gets a number.** An app call carries the duration its result reported;
 *   a Foundry-side call carries a span's duration only when one span and one call share its name;
 *   the model carries its spans. Network legs, audio and the gateway — which records nothing — never
 *   do.
 *
 * Geometry lives here too (`layoutFlow`), the way `timeline.ts` owns the band's: grid cells, never
 * pixels, so the view only scales.
 */
import { callKey, hadRoundTrip, type Activity, type Turn } from './turn'
import type { Span, Trace, TraceStatus } from '../types/trace'

/**
 * How long *play* stays on a hop (spec 066 AC11). Fixed on purpose: most hops were never measured,
 * so a pace that followed durations would draw a measurement nobody made (§5).
 */
export const FLOW_PACE_MS = 1600

/** Who runs the agent's loop. */
export type Harness = 'prompt' | 'hosted' | 'unknown'

/** Whether the model legs go through the bring-your-own-model gateway (spec 066 Q5). */
export type GatewayState = 'on' | 'off' | 'unknown'

/** What the flow knows about the spans: read, still loading, refused — or no id to read them by. */
export type Measurement = 'loading' | TraceStatus | 'no-id'

export type NodeRole = 'browser' | 'bff' | 'voice' | 'agent' | 'model' | 'gateway' | 'tool' | 'mcp'

export interface FlowNode {
  id: string
  role: NodeRole
  /** The turn's own name for it: the tool, the MCP server's label. Absent for fixed components. */
  name?: string
}

export type HopKind =
  | 'request'
  | 'forward'
  | 'askModel'
  | 'modelAsks'
  | 'appCall'
  | 'appResult'
  | 'foundryCall'
  | 'foundryResult'
  | 'mcpCall'
  | 'mcpResult'
  | 'results'
  | 'modelAnswers'
  | 'answerToBff'
  | 'answerToBrowser'
  | 'speechIn'
  | 'voiceToAgent'
  | 'agentToVoice'
  | 'speechOut'
  | 'voiceRelay'
  | 'voiceCall'
  | 'voiceResult'
  | 'voiceBack'
  | 'failed'

export interface Hop {
  from: string
  to: string
  kind: HopKind
  /** The tool the hop carries, for a call. */
  name?: string
  /** The MCP server the hop goes to or comes from. */
  server?: string
  /** Only ever a measurement — see the module rules. */
  durationMs?: number
  /** How the log reader addresses the call this hop belongs to (`callKey`). */
  callKey?: string
  /** On a model leg, when the gateway is on the path. */
  viaGateway?: boolean
  mark?: 'failed' | 'stopped'
}

export interface Flow {
  mode: 'typed' | 'spoken'
  nodes: FlowNode[]
  hops: Hop[]
  gateway: GatewayState
  harness: Harness
  model: {
    name?: string
    /** Each model span's duration, in start order — only when the spans were read. */
    callsMs?: number[]
  }
  measurement: Measurement
  /** The turn had an app round trip, so the spans cover its last leg only. */
  otherLeg: boolean
  errorCode?: string
}

export interface FlowInput {
  turn: Turn
  spoken: boolean
  harness: Harness
  gateway: GatewayState
  model?: string
  /** The span read for the turn's response id, once it answered. */
  trace?: Trace
}

/**
 * Who runs the loop, from the harness name the agents listing (or `GET /config`) reports.
 *
 * Not the kind-to-harness rule — that stays in `HARNESS_FOR_KIND` and arrives already applied. This
 * only says what each harness *is*: Foundry's prompt runtime, or our container running in Foundry.
 */
export function harnessOf(harness: string | undefined): Harness {
  if (harness === 'prompt-agent') return 'prompt'
  if (harness === 'langgraph') return 'hosted'
  return 'unknown'
}

/**
 * Is the gateway on this turn's path? (spec 066 Q5)
 *
 * `usesGateway` is the deployment's flag, and it describes the **default** agent's model. So it
 * answers for that agent only; any other agent is not known rather than borrowing that answer, and a
 * hosted agent chooses its model inside its container. Voice Live never passes through the gateway.
 */
export function gatewayState(input: {
  spoken: boolean
  harness: Harness
  answeringAgent?: string
  defaultAgent?: string
  usesGateway: boolean
}): GatewayState {
  if (input.spoken) return 'off'
  if (input.harness === 'hosted') return 'unknown'
  const isDefault = !input.answeringAgent || input.answeringAgent === input.defaultAgent
  if (!isDefault) return 'unknown'
  return input.usesGateway ? 'on' : 'off'
}

export function buildFlow(input: FlowInput): Flow {
  const { turn, spoken, gateway } = input
  const measurement = measurementOf(turn, input.trace)
  const spans = measurement === 'ok' ? (input.trace?.spans ?? []) : []
  const front = spoken ? 'voice' : 'bff'
  const via = gateway === 'on' ? { viaGateway: true } : {}

  const calls = turn.activities
    .map((activity, index) => ({ activity, key: callKey(activity, index) }))
    .sort((a, b) => a.activity.step - b.activity.step)

  const opening: Hop[] = spoken
    ? [{ from: 'browser', to: 'voice', kind: 'speechIn' }, { from: 'voice', to: 'agent', kind: 'voiceToAgent' }]
    : [{ from: 'browser', to: 'bff', kind: 'request' }, { from: 'bff', to: 'agent', kind: 'forward' }]
  const askModel: Hop = { from: 'agent', to: 'model', kind: 'askModel', ...via }
  const callHops = calls.flatMap(({ activity, key }) =>
    hopsForCall(activity, key, spoken, durationFor(activity, turn.activities, spans)),
  )
  const answer: Hop[] = [
    { from: 'model', to: 'agent', kind: 'modelAnswers' },
    spoken
      ? { from: 'agent', to: 'voice', kind: 'agentToVoice' }
      : { from: 'agent', to: 'bff', kind: 'answerToBff' },
    spoken
      ? { from: 'voice', to: 'browser', kind: 'speechOut' }
      : { from: 'bff', to: 'browser', kind: 'answerToBrowser' },
  ]
  const modelAsks: Hop = { from: 'model', to: 'agent', kind: 'modelAsks' }
  const results: Hop = { from: 'agent', to: 'model', kind: 'results', ...via }

  let hops: Hop[]
  if (turn.status === 'done') {
    hops = [...opening, askModel, ...(calls.length ? [modelAsks, ...callHops, results] : []), ...answer]
  } else {
    // Only what the content proves (AC10). Text or a call means Foundry and the model were reached;
    // nothing at all proves only that the request reached the BFF.
    const reached = calls.length > 0 || turn.text !== '' || turn.reasoning !== ''
    hops = [opening[0]]
    if (reached) hops.push(opening[1], askModel)
    if (calls.length) hops.push(modelAsks, ...callHops)
    if (turn.text !== '') hops.push(...(calls.length ? [results] : []), ...answer)
    if (turn.status === 'error') {
      hops.push({ from: front, to: 'browser', kind: 'failed', mark: 'failed' })
    }
    if (turn.status === 'stopped' && hops.length) {
      hops[hops.length - 1] = { ...hops[hops.length - 1], mark: 'stopped' }
    }
  }

  return {
    mode: spoken ? 'spoken' : 'typed',
    nodes: nodesFor(turn.activities, spoken),
    hops,
    gateway,
    harness: input.harness,
    model: {
      name: input.trace?.model || input.model || undefined,
      callsMs:
        measurement === 'ok'
          ? spans
              .filter((span) => span.kind === 'model')
              .sort((a, b) => a.start_ms - b.start_ms || a.span_id.localeCompare(b.span_id))
              .map((span) => span.duration_ms)
          : undefined,
    },
    measurement,
    otherLeg: hadRoundTrip(turn),
    errorCode: turn.status === 'error' ? turn.error?.code || turn.error?.message : undefined,
  }
}

function measurementOf(turn: Turn, trace: Trace | undefined): Measurement {
  if (!turn.trace?.responseId) return 'no-id'
  return trace ? trace.status : 'loading'
}

function hopsForCall(activity: Activity, key: string, spoken: boolean, durationMs?: number): Hop[] {
  const answered = activity.status !== 'running'
  const failed = activity.status === 'failed' ? { mark: 'failed' as const } : {}
  const timed = durationMs === undefined ? {} : { durationMs }
  const base = { name: activity.name, callKey: key }

  if (activity.kind === 'mcp') {
    const node = `mcp:${activity.serverLabel}`
    const server = activity.serverLabel
    return [
      { from: 'agent', to: node, kind: 'mcpCall', server, ...base },
      ...(answered ? [{ from: node, to: 'agent', kind: 'mcpResult' as const, server, ...base, ...timed, ...failed }] : []),
    ]
  }
  if (activity.executor === 'foundry') {
    const node = `tool:${activity.name}`
    return [
      { from: 'agent', to: node, kind: 'foundryCall', ...base },
      ...(answered ? [{ from: node, to: 'agent', kind: 'foundryResult' as const, ...base, ...timed, ...failed }] : []),
    ]
  }
  if (spoken) {
    return [
      { from: 'agent', to: 'voice', kind: 'voiceRelay', ...base },
      { from: 'voice', to: 'bff', kind: 'voiceCall', ...base },
      ...(answered
        ? [
            { from: 'bff', to: 'voice', kind: 'voiceResult' as const, ...base, ...timed, ...failed },
            { from: 'voice', to: 'agent', kind: 'voiceBack' as const, ...base },
          ]
        : []),
    ]
  }
  return [
    { from: 'agent', to: 'bff', kind: 'appCall', ...base },
    ...(answered ? [{ from: 'bff', to: 'agent', kind: 'appResult' as const, ...base, ...timed, ...failed }] : []),
  ]
}

/** An app call's own report, or the one span that can only be this call's (AC6). */
function durationFor(activity: Activity, all: readonly Activity[], spans: readonly Span[]): number | undefined {
  if (activity.kind === 'tool' && activity.executor === 'app') return activity.durationMs
  if (all.filter((other) => other.name === activity.name).length !== 1) return undefined
  const hits = spans.filter((span) => span.kind === 'tool' && measures(span.name, activity.name))
  return hits.length === 1 ? hits[0].duration_ms : undefined
}

/** `execute_tool <name>`, or `execute_tool <prefix>.<name>` — the recorded MCP shape. */
function measures(spanName: string, tool: string): boolean {
  const prefix = 'execute_tool '
  if (!spanName.startsWith(prefix)) return false
  const named = spanName.slice(prefix.length)
  return named === tool || named.endsWith(`.${tool}`)
}

function nodesFor(activities: readonly Activity[], spoken: boolean): FlowNode[] {
  const fixed: FlowNode[] = [
    { id: 'browser', role: 'browser' },
    ...(spoken ? [{ id: 'voice', role: 'voice' as const }] : []),
    { id: 'bff', role: 'bff' },
    { id: 'agent', role: 'agent' },
    { id: 'gateway', role: 'gateway' },
    { id: 'model', role: 'model' },
  ]
  const called = new Map<string, FlowNode>()
  for (const activity of [...activities].sort((a, b) => a.step - b.step)) {
    if (activity.kind === 'mcp') {
      const id = `mcp:${activity.serverLabel}`
      if (!called.has(id)) called.set(id, { id, role: 'mcp', name: activity.serverLabel })
    } else if (activity.executor === 'foundry') {
      const id = `tool:${activity.name}`
      if (!called.has(id)) called.set(id, { id, role: 'tool', name: activity.name })
    }
  }
  return [...fixed, ...called.values()]
}

// --- Geometry ---------------------------------------------------------------------------------

export interface PlacedNode {
  id: string
  col: number
  row: number
}

export interface FlowLayout {
  nodes: PlacedNode[]
  cols: number
  rows: number
  /** Each pair of components a hop joins, once, in a stable order. */
  edges: { a: string; b: string }[]
}

/**
 * Grid cells for the flow (AC17).
 *
 * Row 1 is the main path — browser, BFF or Voice Live, agent, model. Row 0 holds the gateway when
 * it is **not** on the path, beside the model leg instead of on it; when it is, it sits on that
 * leg. Row 2 holds what the agent called on Foundry's side and, on a spoken turn, the BFF, which is
 * off the audio path. `vertical` is the same grid transposed.
 */
export function layoutFlow(flow: Flow, orientation: 'horizontal' | 'vertical'): FlowLayout {
  const gatewayOn = flow.gateway === 'on'
  const modelCol = 4
  const cells: PlacedNode[] = [
    { id: 'browser', col: 0, row: 1 },
    { id: flow.mode === 'spoken' ? 'voice' : 'bff', col: 1, row: 1 },
    { id: 'agent', col: 2, row: 1 },
    { id: 'gateway', col: 3, row: gatewayOn ? 1 : 0 },
    { id: 'model', col: modelCol, row: 1 },
  ]
  if (flow.mode === 'spoken') cells.push({ id: 'bff', col: 1, row: 2 })

  const called = flow.nodes.filter((node) => node.role === 'tool' || node.role === 'mcp')
  called.forEach((node, index) => cells.push({ id: node.id, col: 2 + index, row: 2 }))

  const cols = Math.max(modelCol, ...cells.map((cell) => cell.col)) + 1
  const rows = 3
  const edges = edgesOf(flow.hops)
  if (orientation === 'horizontal') return { nodes: cells, cols, rows, edges }
  return {
    nodes: cells.map((cell) => ({ id: cell.id, col: cell.row, row: cell.col })),
    cols: rows,
    rows: cols,
    edges,
  }
}

function edgesOf(hops: readonly Hop[]): { a: string; b: string }[] {
  const seen = new Map<string, { a: string; b: string }>()
  const add = (x: string, y: string) => {
    const [a, b] = [x, y].sort()
    seen.set(`${a}|${b}`, { a, b })
  }
  for (const hop of hops) {
    if (hop.viaGateway) {
      add(hop.from, 'gateway')
      add('gateway', hop.to)
    } else {
      add(hop.from, hop.to)
    }
  }
  return [...seen.values()]
}
