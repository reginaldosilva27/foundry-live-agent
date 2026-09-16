/**
 * The trace panel.
 *
 * It renders the identifiers the run actually produced, the numbers it cost, and the calls it made
 * — and nothing it did not measure. Where the mock drew span bars, it says where real spans come
 * from instead. Drawing bars from numbers nobody queried is exactly the kind of thing constitution
 * §5 exists to stop; the bars under the calls are the one exception that is not one, because their
 * lengths are `duration_ms` the events carried and they are given no time axis (spec 014).
 *
 * The panel holds no list of turns and no state of its own. It is told where it is (`position`) and
 * given a way to ask to move (`onStep`), which keeps §8 true on this side: there is nothing here to
 * decide, because everything is a projection of what the events said.
 *
 * Below the responsive breakpoint the same element becomes an overlay drawer rather than a third
 * column (AC12) — that is CSS, not a second component.
 */
import { useEffect, useMemo, useRef } from 'react'
import { CopyRow } from '../components/CopyRow'
import { ChevronIcon, CloseIcon, ExternalIcon } from '../components/Icon'
import { ToolRow } from '../components/ToolRow'
import { SpanTree } from '../components/SpanTree'
import { TraceNumbers } from '../components/TraceNumbers'
import { useT } from '../i18n/context'
import { longestDuration, type Turn } from '../state/turn'
import type { Trace } from '../types/trace'

interface Props {
  turn?: Turn
  open: boolean
  /** Where this turn sits in the session, so the panel can say so and offer the two arrows. */
  position?: { index: number; total: number }
  /** Model and latency come from the app, which is the only place that holds both. */
  model?: string
  latencyMs?: number
  /** The run's spans, once read. Absent while nothing has been asked for (spec 005). */
  trace?: Trace
  /** Whether this deployment's inference routes through the gateway, from `GET /config`. */
  usesGateway?: boolean
  /** Ask for the spans again — the answer to `pending`, which is the common case. */
  onRetryTrace?: () => void
  /** The call to bring into view, when the reader opened the panel by pressing its row. */
  selectedCall?: string
  /** Move to the adjacent turn. `-1` is older, `1` is newer. */
  onStep?: (delta: number) => void
  /** Open one call in the reader. The column lists; the reader reads (spec 010). */
  onOpenCall?: (callId: string) => void
  onClose: () => void
}

/**
 * Which turn, and the two arrows that move between them (spec 014 AC4, AC5).
 *
 * A session is short, so this is a stepper and not a list: a list of turns inside a 320px column
 * would be a second sidebar. It renders the position 1-based and takes it 0-based, which is the one
 * piece of arithmetic in the panel and the reason it lives in a named function.
 */
function TurnStepper({
  position,
  onStep,
}: {
  position: { index: number; total: number }
  onStep?: (delta: number) => void
}) {
  const s = useT()

  return (
    <div className="trace__turn" role="group">
      <button
        type="button"
        className="trace__turn-step"
        aria-label={s('trace.previousTurn')}
        disabled={position.index === 0}
        onClick={() => onStep?.(-1)}
      >
        <ChevronIcon size={13} className="trace__turn-back" />
      </button>
      <span className="trace__position" data-testid="trace-position">
        {s('trace.turnPosition')
          .replace('{n}', String(position.index + 1))
          .replace('{total}', String(position.total))}
      </span>
      <button
        type="button"
        className="trace__turn-step"
        aria-label={s('trace.nextTurn')}
        disabled={position.index >= position.total - 1}
        onClick={() => onStep?.(1)}
      >
        <ChevronIcon size={13} />
      </button>
    </div>
  )
}

export function TraceDrawer({
  turn,
  open,
  position,
  model,
  latencyMs,
  trace,
  usesGateway,
  onRetryTrace,
  selectedCall,
  onStep,
  onOpenCall,
  onClose,
}: Props) {
  const s = useT()
  const selected = useRef<HTMLDivElement>(null)

  // One scan of the turn rather than one per row: each bar is a fraction of this.
  const longest = useMemo(() => (turn ? longestDuration(turn) : 0), [turn])

  // A run with several calls is taller than the panel; opening it on the call the reader pressed
  // is what makes "one press away" true.
  useEffect(() => {
    selected.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedCall, open])

  if (!open) return null

  return (
    <aside className="trace" data-testid="trace-panel">
      <header className="trace__head">
        <h2 className="trace__title">{s('trace.title')}</h2>
        {position && <TurnStepper position={position} onStep={onStep} />}
        <button type="button" className="trace__close" aria-label={s('trace.close')} onClick={onClose}>
          <CloseIcon size={15} />
        </button>
      </header>

      {turn?.trace ? (
        <>
          <section className="trace__run">
            <h3 className="trace__subtitle">{s('trace.numbersTitle')}</h3>
            <TraceNumbers turn={turn} model={model} latencyMs={latencyMs} trace={trace} />
          </section>

          <section className="trace__ids">
            <CopyRow label={s('trace.responseId')} value={turn.trace.responseId} />
            {turn.trace.conversationId && (
              <CopyRow label={s('trace.conversationId')} value={turn.trace.conversationId} />
            )}
            {/* Real now, and read from the spans rather than from the stream: no harness emits it,
                and none needs to — `gen_ai.response.id` on every span is the join (spec 005, O-B). */}
            {trace?.status === 'ok' && trace.otel_trace_id && (
              <CopyRow label={s('trace.otelTraceId')} value={trace.otel_trace_id} />
            )}

            {/* No `gateway request id` field. APIM has no diagnostic settings, so there is no such
                id to show — and a labelled empty box claims there could be one. What is true is
                that the run went through the gateway and the gateway did not write it down, which
                is worth more than a blank (spec 005, AC7\u2033). */}
            <div className="trace__gateway" data-testid="trace-gateway">
              <span className="copy-row__label">{s('trace.gatewayTitle')}</span>
              <p className="trace__gateway-note">
                {usesGateway ? s('trace.gatewayCarried') : s('trace.gatewayNone')}
              </p>
            </div>
          </section>

          <section className="trace__activity" data-testid="trace-activity">
            <h3 className="trace__subtitle">{s('turn.activityTitle')}</h3>
            {turn.activities.length === 0 ? (
              <p className="trace__empty">{s('trace.activityEmpty')}</p>
            ) : (
              turn.activities.map((activity, index) => {
                const id = activity.kind === 'tool' ? activity.callId : `mcp_${index}`
                const duration = activity.kind === 'tool' ? activity.durationMs : undefined
                return (
                  <div key={id} ref={id === selectedCall ? selected : undefined} data-call={id}>
                    <ToolRow
                      activity={activity}
                      durationRatio={
                        duration !== undefined && longest > 0 ? duration / longest : undefined
                      }
                      showStep={turn.activities.length > 1}
                      onOpen={() => onOpenCall?.(id)}
                    />
                  </div>
                )
              })
            )}
          </section>

          <section className="trace__spans">
            <h3 className="trace__subtitle">{s('trace.spansTitle')}</h3>
            {trace?.status === 'ok' ? (
              <SpanTree spans={trace.spans} />
            ) : (
              <p className="trace__empty" data-testid="trace-spans-state">
                {trace?.status === 'pending'
                  ? s('trace.spansPending')
                  : trace?.status === 'unavailable'
                    ? s('trace.spansUnavailable')
                    : trace?.status === 'denied'
                      ? `${s('trace.spansDenied')} ${trace.message ?? ''}`
                      : trace?.status === 'failed'
                        ? `${s('trace.spansFailed')} ${trace.message ?? ''}`
                        : s('trace.spansLoading')}
              </p>
            )}
            {trace?.status === 'pending' && onRetryTrace && (
              <button type="button" className="trace__retry" onClick={onRetryTrace}>
                {s('trace.spansRetry')}
              </button>
            )}
          </section>

          <footer className="trace__foot">
            <a
              className="trace__portal"
              href="https://ai.azure.com"
              target="_blank"
              rel="noreferrer noopener"
            >
              {s('trace.openPortal')}
              <ExternalIcon size={13} />
            </a>
          </footer>
        </>
      ) : (
        <p className="trace__empty">{s('trace.noTurn')}</p>
      )}
    </aside>
  )
}
