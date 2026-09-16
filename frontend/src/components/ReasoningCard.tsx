/**
 * The summarised chain of thought, when there is one.
 *
 * The card must explain itself when it is empty (constitution §5) — an empty box reads as a bug in
 * this app. While the turn is streaming it stays out of the way; once the turn has settled with
 * nothing to show, it collapses to one line that states the fact and stops there.
 *
 * That line says *this turn* and nothing more, because more turned out to be false. It used to tell
 * the reader the model emitted no summaries and to point the deployment at a reasoning model; the
 * deployment was `gpt-5.5` with `reasoning.summary` configured, which spent reasoning tokens on the
 * very turn that displayed the message and simply chose not to summarise (spec 015). What the agent
 * did is told by the numbered rows underneath, from events — not by prose written here.
 */
import { useState } from 'react'
import { useT } from '../i18n/context'
import { ChevronIcon } from './Icon'
import { Markdown } from './Markdown'

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
      <p className="reasoning-absent" data-testid="reasoning-absent">
        {s('reasoning.absentBody')}
      </p>
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
        <div className="reasoning-card__body" data-testid="reasoning-body">
          {/* The summary arrives as markdown — each phase opens with its own `**Title**`, and
              Foundry's part boundaries come through as paragraph breaks. Rendered as one blob of
              text the phases collided, because HTML collapses the newlines the model sent. This is
              the same renderer the answer uses (§4). */}
          <Markdown text={text.trimStart()} />
          {streaming && <span className="caret" aria-hidden="true" />}
        </div>
      )}
    </section>
  )
}
