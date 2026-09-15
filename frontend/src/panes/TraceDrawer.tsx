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
import { TraceNumbers } from '../components/TraceNumbers'
import { useT } from '../i18n/context'
import { longestDuration, type Turn } from '../state/turn'

interface Props {
  turn?: Turn
  open: boolean
  /** Where this turn sits in the session, so the panel can say so and offer the two arrows. */
  position?: { index: number; total: number }
  /** Model and latency come from the app, which is the only place that holds both. */
  model?: string
  latencyMs?: number
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
            <TraceNumbers turn={turn} model={model} latencyMs={latencyMs} />
          </section>

          <section className="trace__ids">
            <CopyRow label={s('trace.responseId')} value={turn.trace.responseId} />
            {turn.trace.conversationId && (
              <CopyRow label={s('trace.conversationId')} value={turn.trace.conversationId} />
            )}
            {/* Reserved for spec 005. Rendered whether or not a harness emits them yet, because a
                field that is silently absent and one that is deliberately pending look identical
                from the screen (§5). No flag: presence alone decides which way it renders, so the
                day a harness sends one it needs no change here. */}
            <CopyRow
              label={s('trace.otelTraceId')}
              value={turn.trace.otelTraceId}
              pending={s('trace.pendingTracing')}
            />
            <CopyRow
              label={s('trace.gatewayRequestId')}
              value={turn.trace.gatewayRequestId}
              pending={s('trace.pendingTracing')}
            />
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
                      onOpen={() => onOpenCall?.(id)}
                    />
                  </div>
                )
              })
            )}
          </section>

          <footer className="trace__foot">
            <p className="trace__spans-note">{s('trace.spansFooter')}</p>
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
