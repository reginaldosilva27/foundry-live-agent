/**
 * One identifier, copyable (spec 014 AC1).
 *
 * The trace panel exists so that a run can be found again somewhere else, and an id you cannot get
 * out of the page does not serve that. The whole row is the control rather than a small icon at its
 * end: the value is 12px monospace, and a 24px target beside it is the wrong thing to ask a reader
 * to hit.
 *
 * It is also the app's only clipboard call, which is deliberate — "copied" means the same thing
 * everywhere because one component decides it (§4).
 *
 * A row with no value is not omitted. `otel_trace_id` and `gateway_request_id` are reserved for
 * spec 005, and a field that is silently absent looks exactly like one that is deliberately pending
 * (§5) — so the pending case renders, greyed, saying which spec brings it.
 */
import { useEffect, useState } from 'react'
import { useT } from '../i18n/context'
import { CopyIcon } from './Icon'

interface Props {
  label: string
  /** Absent for an identifier this build does not receive yet — pass `pending` instead. */
  value?: string
  /** Why there is no value. Renders in place of one, and makes the row inert. */
  pending?: string
}

/** How long "copied" stays up. Long enough to read, short enough not to become the label. */
const FEEDBACK_MS = 1600

type State = 'idle' | 'copied' | 'failed'

export function CopyRow({ label, value, pending }: Props) {
  const s = useT()
  const [state, setState] = useState<State>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [state])

  if (!value) {
    return (
      <div className="copy-row copy-row--pending" data-testid="copy-row">
        <span className="copy-row__label">{label}</span>
        <span className="copy-row__pending">{pending}</span>
      </div>
    )
  }

  const copy = () => {
    // Absent on every insecure origin that is not localhost, and in jsdom. Optional chaining
    // rather than a feature check, so the missing case takes the same path as a rejected one:
    // the reader is told it did not work either way.
    navigator.clipboard
      ?.writeText(value)
      .then(() => setState('copied'))
      .catch(() => setState('failed'))
    if (!navigator.clipboard) setState('failed')
  }

  return (
    <div className="copy-row" data-testid="copy-row" data-state={state}>
      <span className="copy-row__label">{label}</span>
      <button type="button" className="copy-row__button" title={s('trace.copy')} onClick={copy}>
        <span className="copy-row__value">{value}</span>
        <CopyIcon size={12} className="copy-row__icon" />
      </button>
      {state !== 'idle' && (
        <span className="copy-row__feedback" role="status">
          {s(state === 'copied' ? 'trace.copied' : 'trace.copyFailed')}
        </span>
      )}
    </div>
  )
}
