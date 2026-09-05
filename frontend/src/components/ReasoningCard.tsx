/**
 * The summarised chain of thought, when there is one.
 *
 * The card must explain itself when it is empty (constitution §5). Behind the reference
 * environment's gateway connection the only model exposed is `gpt-4o`, which emits no reasoning
 * summaries at all — an empty box there would read as a bug in this app rather than as a property
 * of the deployment. So: while the turn is streaming the card stays out of the way, and once the
 * turn has settled with nothing to show it says why.
 */
import { useState } from 'react'
import { useT } from '../i18n/context'
import { ChevronIcon } from './Icon'

interface Props {
  text: string
  streaming: boolean
}

export function ReasoningCard({ text, streaming }: Props) {
  const s = useT()
  const [open, setOpen] = useState(true)

  if (!text) {
    if (streaming) return null
    return (
      <aside className="reasoning-card reasoning-card--absent" data-testid="reasoning-absent">
        <span className="reasoning-card__title">{s('reasoning.absentTitle')}</span>
        <p className="reasoning-card__note">{s('reasoning.absentBody')}</p>
      </aside>
    )
  }

  return (
    <section className="reasoning-card" data-open={open}>
      <button
        type="button"
        className="reasoning-card__toggle"
        aria-expanded={open}
        aria-label={s('reasoning.toggle')}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronIcon size={14} className="reasoning-card__chevron" />
        <span className="reasoning-card__title">{s('reasoning.title')}</span>
        {streaming && <span className="reasoning-card__live">{s('reasoning.streaming')}</span>}
      </button>

      {open && (
        <p className="reasoning-card__body" data-testid="reasoning-body">
          {text}
          {streaming && <span className="caret" aria-hidden="true" />}
        </p>
      )}
    </section>
  )
}
