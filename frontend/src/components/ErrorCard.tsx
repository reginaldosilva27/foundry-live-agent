/**
 * A terminal `error` event, rendered as an error.
 *
 * The design mock has no treatment for this because its scripted turn always succeeds. It matters
 * more than a happy path does: the contract exists so that a failed run *says so* instead of the
 * stream going quiet, and that guarantee is worth nothing if the UI renders it as nothing.
 */
import { useT } from '../i18n/context'
import { AlertIcon } from './Icon'

interface Props {
  error: { message: string; code?: string }
}

export function ErrorCard({ error }: Props) {
  const s = useT()
  return (
    <aside className="error-card" role="alert">
      <header className="error-card__head">
        <AlertIcon size={15} />
        <span className="error-card__title">{s('error.title')}</span>
        {error.code && <code className="error-card__code">{error.code}</code>}
      </header>
      <p className="error-card__message">{error.message}</p>
      <p className="error-card__hint">{s('error.hint')}</p>
    </aside>
  )
}
