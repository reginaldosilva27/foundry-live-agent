/**
 * A turn's journey, drawn (spec 066).
 *
 * The trace panel answers "what did this turn cost"; this answers "where did my message go" — for
 * someone who does not know the architecture yet, on a projector, one hop at a time.
 *
 * **It draws, and decides nothing.** Which components the turn passed through, in what order and for
 * how long all come from `buildFlow` (`state/flow.ts`); the grid comes from `layoutFlow`. What is left
 * here is turning grid cells into SVG and keeping the reader's place.
 *
 * **The picture is decoration; the list and the notes are the content.** Every fact in the SVG is
 * also in text: each hop, its caption, its measured duration, its mark and the door to its call in
 * the ordered list of steps; who runs the agent, what the spans measured of the model, the gateway
 * and — on a spoken turn — the BFF being off the audio path in the notes. So the SVG is
 * `aria-hidden`, and the text is what a screen reader and a keyboard use. The
 * same choice spec 029 made for the band, for the same reason: an SVG would need every platform
 * affordance rebuilt.
 *
 * **Play keeps time with nothing.** It walks the hops at `FLOW_PACE_MS`, because a pace that followed
 * durations would be drawing a measurement nobody made for most hops (§5). And it never writes the
 * live region: a step the reader took is announced, a step the timer took is not.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronIcon, CloseIcon, FlowIcon, PauseIcon, PlayIcon } from '../components/Icon'
import { formatMs } from '../components/format'
import { useModalFocus } from '../hooks/useModalFocus'
import { useT } from '../i18n/context'
import type { StringKey } from '../i18n/strings'
import { FLOW_PACE_MS, layoutFlow, type Flow, type FlowNode, type Hop } from '../state/flow'

interface Props {
  /** Absent when this browser holds no record of the turn the address named (AC15). */
  flow?: Flow
  orientation: 'horizontal' | 'vertical'
  /** Where this turn sits in the session — the trace panel's position, shared. */
  position?: { index: number; total: number }
  onStep?: (delta: number) => void
  onRetryTrace?: () => void
  onOpenCall?: (callKey: string) => void
  /** Another modal (the log reader) is open over this one, so Escape belongs to it. */
  covered?: boolean
  onClose: () => void
}

type Translate = (key: StringKey) => string

/** Cell and box sizes, in SVG units. The view scales the whole drawing; nothing here is a pixel. */
const CELL = { w: 200, h: 124 }
const BOX = { w: 168, h: 76 }

export function TurnFlow({
  flow,
  orientation,
  position,
  onStep,
  onRetryTrace,
  onOpenCall,
  covered,
  onClose,
}: Props) {
  const s = useT()
  const scrim = useRef<HTMLDivElement>(null)
  useModalFocus(scrim)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !covered) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [covered, onClose])

  return (
    <div
      className="flow-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={s('flow.title')}
      ref={scrim}
      tabIndex={-1}
    >
      <section className="flow" data-testid="turn-flow" data-orientation={orientation}>
        <header className="flow__head">
          <FlowIcon size={16} className="flow__icon" />
          <h2 className="flow__title">{s('flow.title')}</h2>
          {position && position.total > 1 && (
            <div className="flow__turns">
              <button
                type="button"
                className="flow__turn-step"
                aria-label={s('trace.previousTurn')}
                disabled={position.index === 0}
                onClick={() => onStep?.(-1)}
              >
                <ChevronIcon size={13} className="flow__back" />
              </button>
              <span className="flow__turn-position">
                {fill(s('trace.turnPosition'), { n: position.index + 1, total: position.total })}
              </span>
              <button
                type="button"
                className="flow__turn-step"
                aria-label={s('trace.nextTurn')}
                disabled={position.index >= position.total - 1}
                onClick={() => onStep?.(1)}
              >
                <ChevronIcon size={13} />
              </button>
            </div>
          )}
          <button type="button" className="flow__close" aria-label={s('flow.close')} onClick={onClose}>
            <CloseIcon size={15} />
          </button>
        </header>

        {flow ? (
          <FlowBody flow={flow} orientation={orientation} onRetryTrace={onRetryTrace} onOpenCall={onOpenCall} />
        ) : (
          <p className="flow__missing">{s('flow.notInBrowser')}</p>
        )}
      </section>
    </div>
  )
}

function FlowBody({
  flow,
  orientation,
  onRetryTrace,
  onOpenCall,
}: {
  flow: Flow
  orientation: 'horizontal' | 'vertical'
  onRetryTrace?: () => void
  onOpenCall?: (callKey: string) => void
}) {
  const s = useT()
  const last = flow.hops.length - 1
  /** `-1` is *show all*, which is where the view opens. */
  const [index, setIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [announced, setAnnounced] = useState('')
  // Derived, so reaching the last hop stops the timer without an effect having to notice.
  const running = playing && index < last

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setIndex((current) => Math.min(current + 1, last)), FLOW_PACE_MS)
    return () => clearInterval(timer)
  }, [running, last])

  const step = (to: number) => {
    const next = Math.max(0, Math.min(to, last))
    setPlaying(false)
    setIndex(next)
    setAnnounced(caption(flow.hops[next], flow, s))
  }
  const play = () => {
    if (index >= last) setIndex(-1)
    setPlaying(true)
  }

  const current = index >= 0 ? flow.hops[index] : undefined

  return (
    <div className="flow__body">
      <div className="flow__stage">
        <Diagram flow={flow} orientation={orientation} current={current} onOpenCall={onOpenCall} />

        <div className="flow__controls">
          <button
            type="button"
            className="flow__control"
            aria-label={s('flow.previous')}
            disabled={index <= 0}
            onClick={() => step(index - 1)}
          >
            <ChevronIcon size={14} className="flow__back" />
          </button>
          <button
            type="button"
            className="flow__control flow__control--play"
            aria-label={running ? s('flow.pause') : s('flow.play')}
            onClick={running ? () => setPlaying(false) : play}
          >
            {running ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
          </button>
          <button
            type="button"
            className="flow__control"
            aria-label={s('flow.next')}
            disabled={index >= last}
            onClick={() => step(index + 1)}
          >
            <ChevronIcon size={14} />
          </button>
          <button
            type="button"
            className="flow__show-all"
            aria-pressed={index === -1}
            onClick={() => {
              setPlaying(false)
              setIndex(-1)
            }}
          >
            {s('flow.showAll')}
          </button>
          <span className="flow__position">
            {index === -1
              ? fill(s('flow.allShown'), { total: flow.hops.length })
              : fill(s('flow.position'), { n: index + 1, total: flow.hops.length })}
          </span>
        </div>

        <p className="flow__caption" data-testid="flow-caption">
          {current ? caption(current, flow, s) : ''}
        </p>
        <p className="visually-hidden" aria-live="polite" data-testid="flow-live">
          {announced}
        </p>

        <Notes flow={flow} onRetryTrace={onRetryTrace} />
      </div>

      <section className="flow__steps-panel" aria-label={s('flow.steps')}>
        <h3 className="flow__steps-title">{s('flow.steps')}</h3>
        <ol className="flow__steps" data-testid="flow-steps">
          {flow.hops.map((hop, i) => (
            <li
              key={i}
              className="flow__step"
              data-mark={hop.mark}
              aria-current={i === index ? 'step' : undefined}
            >
              <span className="flow__step-n" aria-hidden="true">
                {i + 1}
              </span>
              <span className="flow__step-text">
                {caption(hop, flow, s)}
                {hop.durationMs !== undefined && (
                  <span className="flow__step-ms">{formatMs(Math.round(hop.durationMs))}</span>
                )}
                {hop.mark && hop.kind !== 'failed' && (
                  <span className="flow__step-mark">{s(hop.mark === 'failed' ? 'flow.mark.failed' : 'flow.mark.stopped')}</span>
                )}
              </span>
              {hop.callKey && opensCall(hop) && onOpenCall && (
                <button
                  type="button"
                  className="flow__step-open"
                  aria-label={fill(s('flow.openCall'), { name: hop.name ?? '' })}
                  title={fill(s('flow.openCall'), { name: hop.name ?? '' })}
                  onClick={() => onOpenCall(hop.callKey!)}
                >
                  <ChevronIcon size={12} />
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

/** One door per call, on the hop that starts it, so the list does not offer the same call twice. */
function opensCall(hop: Hop): boolean {
  return hop.kind === 'appCall' || hop.kind === 'mcpCall' || hop.kind === 'foundryCall' || hop.kind === 'voiceRelay'
}

function Notes({ flow, onRetryTrace }: { flow: Flow; onRetryTrace?: () => void }) {
  const s = useT()
  const gatewayKey: StringKey =
    flow.mode === 'spoken'
      ? 'flow.gateway.voice'
      : flow.gateway === 'on'
        ? 'flow.gateway.on'
        : flow.gateway === 'off'
          ? 'flow.gateway.off'
          : flow.harness === 'hosted'
            ? 'flow.gateway.unknownHosted'
            : 'flow.gateway.unknown'

  // The drawing is `aria-hidden`, so what its boxes say beyond a name is said here too: who runs the
  // loop, what the spans measured of the model, and — on a spoken turn — that the BFF is off the
  // audio path. Same `labelsFor`, so the two cannot word it differently.
  const facts = flow.nodes.filter(
    (node) => node.role === 'agent' || node.role === 'model' || (node.role === 'bff' && flow.mode === 'spoken'),
  )

  return (
    <div className="flow__notes" data-testid="flow-notes">
      {facts.map((node) => {
        const [title, ...rest] = labelsFor(node, flow, s)
        return (
          <p key={node.id} className="flow__note" data-testid={`flow-fact-${node.role}`}>
            <span className="flow__note-label">{title}</span> {rest.filter(Boolean).join(' · ')}
          </p>
        )
      })}
      <p className="flow__note" data-testid="flow-gateway">
        <span className="flow__note-label">{s('flow.node.gateway')}</span> {s(gatewayKey)}
      </p>
      <Measured flow={flow} onRetryTrace={onRetryTrace} />
    </div>
  )
}

function Measured({ flow, onRetryTrace }: { flow: Flow; onRetryTrace?: () => void }) {
  const s = useT()
  switch (flow.measurement) {
    case 'no-id':
      return (
        <>
          <p className="flow__note">{s('flow.noId')}</p>
          {flow.mode === 'spoken' && <p className="flow__note">{s('flow.noIdSpoken')}</p>}
        </>
      )
    case 'loading':
      return <p className="flow__note">{s('trace.spansLoading')}</p>
    case 'pending':
      return (
        <p className="flow__note">
          <span>{s('trace.spansPending')}</span>{' '}
          {onRetryTrace && (
            <button type="button" className="flow__retry" onClick={onRetryTrace}>
              {s('trace.spansRetry')}
            </button>
          )}
        </p>
      )
    case 'denied':
      return <p className="flow__note">{s('trace.spansDenied')}</p>
    case 'failed':
      return <p className="flow__note">{s('trace.spansFailed')}</p>
    case 'unavailable':
      return <p className="flow__note">{s('trace.spansUnavailable')}</p>
    case 'ok':
      return (
        <>
          <p className="flow__note">{s('timeline.axisNote')}</p>
          {flow.otherLeg && <p className="flow__note">{s('timeline.otherLeg')}</p>}
        </>
      )
  }
}

function Diagram({
  flow,
  orientation,
  current,
  onOpenCall,
}: {
  flow: Flow
  orientation: 'horizontal' | 'vertical'
  current?: Hop
  onOpenCall?: (callKey: string) => void
}) {
  const s = useT()
  const grid = useMemo(() => layoutFlow(flow, orientation), [flow, orientation])
  const at = useMemo(() => new Map(grid.nodes.map((node) => [node.id, centre(node.col, node.row)])), [grid])
  const byId = new Map(flow.nodes.map((node) => [node.id, node]))
  const active = current ? new Set([current.from, current.to, ...(current.viaGateway ? ['gateway'] : [])]) : new Set()
  const segments = current
    ? current.viaGateway
      ? [[current.from, 'gateway'], ['gateway', current.to]]
      : [[current.from, current.to]]
    : []

  return (
    <svg
      className="flow__diagram"
      data-testid="flow-diagram"
      viewBox={`0 0 ${grid.cols * CELL.w} ${grid.rows * CELL.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <marker
          id="flow-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="14"
          markerHeight="14"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" className="flow__arrowhead" />
        </marker>
      </defs>

      {grid.edges.map(({ a, b }) => {
        const [p, q] = clip(at.get(a)!, at.get(b)!)
        return <line key={`${a}|${b}`} className="flow__edge" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
      })}

      {segments.map(([from, to]) => {
        const [p, q] = clip(at.get(from)!, at.get(to)!)
        return (
          <line
            key={`hop-${from}-${to}`}
            className="flow__edge flow__edge--active"
            data-mark={current?.mark}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            markerEnd="url(#flow-arrow)"
          />
        )
      })}

      {grid.nodes.map((placed) => {
        const node = byId.get(placed.id)
        if (!node) return null
        const { x, y } = at.get(placed.id)!
        const [full, sub, extra] = labelsFor(node, flow, s)
        const title = fit(full)
        const lines = [sub, extra].filter(Boolean).length
        const call = callOf(node, flow)
        return (
          <g
            key={node.id}
            className="flow__node"
            data-testid={`flow-node-${node.id}`}
            data-role={node.role}
            data-active={active.has(node.id) || undefined}
            data-state={nodeState(node, flow)}
            onClick={call && onOpenCall ? () => onOpenCall(call) : undefined}
          >
            <rect x={x - BOX.w / 2} y={y - BOX.h / 2} width={BOX.w} height={BOX.h} rx={12} className="flow__box" />
            <text x={x} y={y + 5 - lines * 10} className="flow__label">
              {title}
            </text>
            {sub && (
              <text x={x} y={y + 16 - (lines - 1) * 8} className="flow__sub">
                {sub}
              </text>
            )}
            {extra && (
              <text x={x} y={y + 24} className="flow__sub">
                {extra}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** What a component is called on the drawing, and up to two lines under its name. */
function labelsFor(node: FlowNode, flow: Flow, s: Translate): [string, string?, string?] {
  switch (node.role) {
    case 'browser':
      return [s('flow.node.browser'), undefined]
    case 'bff':
      return [s('flow.node.bff'), flow.mode === 'spoken' ? s('flow.sub.offAudio') : s('flow.sub.bff')]
    case 'voice':
      return [s('flow.node.voice'), s('flow.sub.voice')]
    case 'agent':
      if (flow.harness === 'hosted') return [s('flow.node.container'), s('flow.sub.inFoundry')]
      return [s('flow.node.agent'), flow.harness === 'prompt' ? s('flow.sub.promptRuntime') : undefined]
    case 'gateway':
      return [s('flow.node.gateway'), undefined]
    case 'model': {
      const calls = flow.model.callsMs
      const name = flow.model.name || s('flow.node.model')
      if (!calls) return [name, s('flow.notMeasured')]
      const times = calls.map((ms) => formatMs(Math.round(ms))).join(' · ')
      return [name, fill(s('flow.modelCalls'), { n: calls.length }), times || undefined]
    }
    case 'mcp':
      return [node.name ?? '', s('flow.sub.mcp')]
    case 'tool':
      return [node.name ?? '', s('agent.executedByFoundry')]
  }
}

/** The gateway's state, and whether the BFF is off the path — what the stylesheet dims. */
function nodeState(node: FlowNode, flow: Flow): string | undefined {
  if (node.role === 'gateway') return flow.gateway
  if (node.role === 'bff' && flow.mode === 'spoken') return 'off'
  return undefined
}

/** The first call that went to this component, for a pointer that presses it. */
function callOf(node: FlowNode, flow: Flow): string | undefined {
  if (node.role !== 'mcp' && node.role !== 'tool') return undefined
  return flow.hops.find((hop) => hop.to === node.id && hop.callKey)?.callKey
}

function caption(hop: Hop, flow: Flow, s: Translate): string {
  return fill(s(`flow.hop.${hop.kind}` as StringKey), {
    name: hop.name ?? '',
    server: hop.server ?? '',
    model: flow.model.name || s('flow.node.model'),
    code: flow.errorCode ?? '',
  })
}

/**
 * A name short enough for its box. The drawing is decoration — the full name is in the steps list —
 * so shortening it here loses nothing a reader cannot find.
 */
function fit(name: string, max = 19): string {
  return name.length > max ? `${name.slice(0, max - 1)}\u2026` : name
}

function fill(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, String(value)), text)
}

function centre(col: number, row: number): { x: number; y: number } {
  return { x: col * CELL.w + CELL.w / 2, y: row * CELL.h + CELL.h / 2 }
}

/** The segment between two boxes, trimmed to their edges so an arrowhead lands on a border. */
function clip(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const scale = Math.min(
    dx === 0 ? Infinity : BOX.w / 2 / Math.abs(dx),
    dy === 0 ? Infinity : BOX.h / 2 / Math.abs(dy),
  )
  const gap = 4
  const t = Math.min(0.5, scale + gap / Math.hypot(dx, dy))
  return [
    { x: a.x + dx * t, y: a.y + dy * t },
    { x: b.x - dx * t, y: b.y - dy * t },
  ] as const
}
