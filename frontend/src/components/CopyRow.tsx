/**
 * One identifier, copyable (spec 014 AC1).
 *
 * The trace panel exists so that a run can be found again somewhere else, and an id you cannot get
 * out of the page does not serve that. The whole row is the control rather than a small icon at its
 * end: the value is 12px monospace, and a 24px target beside it is the wrong thing to ask a reader
 * to hit.
 *
 * The clipboard call itself lives in `useCopy`, shared with the answer's action row: "copied"
 * means the same thing everywhere because one place decides it (§4).
 *
 * A row with no value is not omitted. `otel_trace_id` and `gateway_request_id` are reserved for
 * spec 005, and a field that is silently absent looks exactly like one that is deliberately pending
 * (§5) — so the pending case renders, greyed, saying which spec brings it.
 */
import { useCopy } from '../hooks/useCopy'
import { useT } from '../i18n/context'
import { CopyIcon } from './Icon'

interface Props {
  label: string
  /** Absent for an identifier this build does not receive yet — pass `pending` instead. */
  value?: string
  /** Why there is no value. Renders in place of one, and makes the row inert. */
  pending?: string
}

export function CopyRow({ label, value, pending }: Props) {
  const s = useT()
  const { state, copy } = useCopy()

  if (!value) {
    return (
      <div className="copy-row copy-row--pending" data-testid="copy-row">
        <span className="copy-row__label">{label}</span>
        <span className="copy-row__pending">{pending}</span>
      </div>
    )
  }

  return (
    <div className="copy-row" data-testid="copy-row" data-state={state}>
      <span className="copy-row__label">{label}</span>
      <button
        type="button"
        className="copy-row__button"
        title={s('copy.label')}
        onClick={() => copy(value)}
      >
        <span className="copy-row__value">{value}</span>
        <CopyIcon size={12} className="copy-row__icon" />
      </button>
      {state !== 'idle' && (
        <span className="copy-row__feedback" role="status">
          {s(state === 'copied' ? 'copy.copied' : 'copy.failed')}
        </span>
      )}
    </div>
  )
}
