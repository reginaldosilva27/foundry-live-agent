/**
 * The trace panel.
 *
 * It renders the identifiers the run actually produced and, where the mock drew span bars, it says
 * that span data arrives with the tracing spec. Drawing bars from numbers nobody queried is exactly
 * the kind of thing constitution §5 exists to stop.
 *
 * Below the responsive breakpoint the same element becomes an overlay drawer rather than a third
 * column (AC12) — that is CSS, not a second component.
 */
import { useEffect, useRef } from 'react'
import { CloseIcon, ExternalIcon } from '../components/Icon'
import { ToolRow } from '../components/ToolRow'
import { useT } from '../i18n/context'
import type { Turn } from '../state/turn'

interface Props {
  turn?: Turn
  open: boolean
  /** The call to bring into view, when the reader opened the panel by pressing its row. */
  selectedCall?: string
  /** Open one call in the reader. The column lists; the reader reads (spec 010). */
  onOpenCall?: (callId: string) => void
  onClose: () => void
}

export function TraceDrawer({ turn, open, selectedCall, onOpenCall, onClose }: Props) {
  const s = useT()
  const selected = useRef<HTMLDivElement>(null)

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
        <button type="button" className="trace__close" aria-label={s('trace.close')} onClick={onClose}>
          <CloseIcon size={15} />
        </button>
      </header>

      {turn?.trace ? (
        <>
          <dl className="trace__ids">
            <dt>{s('trace.responseId')}</dt>
            <dd>{turn.trace.responseId}</dd>
            {turn.trace.conversationId && (
              <>
                <dt>{s('trace.conversationId')}</dt>
                <dd>{turn.trace.conversationId}</dd>
              </>
            )}
          </dl>

          <section className="trace__activity" data-testid="trace-activity">
            <h3 className="trace__subtitle">{s('turn.activityTitle')}</h3>
            {turn.activities.length === 0 ? (
              <p className="trace__empty">{s('trace.activityEmpty')}</p>
            ) : (
              turn.activities.map((activity, index) => {
                const id = activity.kind === 'tool' ? activity.callId : `mcp_${index}`
                return (
                  <div key={id} ref={id === selectedCall ? selected : undefined} data-call={id}>
                    <ToolRow activity={activity} onOpen={() => onOpenCall?.(id)} />
                  </div>
                )
              })
            )}
          </section>

          <section className="trace__spans">
            <h3 className="trace__subtitle">{s('trace.spansTitle')}</h3>
            <p className="trace__empty">{s('trace.spansEmpty')}</p>
          </section>

          <a
            className="trace__portal"
            href="https://ai.azure.com"
            target="_blank"
            rel="noreferrer noopener"
          >
            {s('trace.openPortal')}
            <ExternalIcon size={13} />
          </a>
        </>
      ) : (
        <p className="trace__empty">{s('trace.noTurn')}</p>
      )}
    </aside>
  )
}
