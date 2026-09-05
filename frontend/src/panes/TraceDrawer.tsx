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
import { CloseIcon, ExternalIcon } from '../components/Icon'
import { useT } from '../i18n/context'
import type { Turn } from '../state/turn'

interface Props {
  turn?: Turn
  open: boolean
  onClose: () => void
}

export function TraceDrawer({ turn, open, onClose }: Props) {
  const s = useT()
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
