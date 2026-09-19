/**
 * The first screen.
 *
 * The headline uses the brand's trademark move: a Light sentence with a SemiBold half inside it.
 *
 * **The suggestions belong to the agent, not to this file** (spec 037). They arrive on the agent's
 * row from `GET /agents`, which reads them from the definition in `agent_core.yaml`. This component
 * renders what it is given and derives nothing: it does not look at the agent's tools, its name or
 * its kind, and it never asks a model what to ask it — that would be the app running inference on
 * its own behalf (§8).
 *
 * An agent this repository did not write has none, and then the screen shows none. That is the
 * honest state rather than an error: we do not know what somebody else's agent is for, and
 * suggesting a question it cannot answer is worse than suggesting nothing.
 */
import { useLang, useT } from '../i18n/context'

export interface Suggestion {
  en: string
  pt: string
}

interface Props {
  /** The answering agent's own examples. Empty renders nothing at all. */
  suggestions?: Suggestion[]
  onSuggestion: (text: string) => void
}

export function EmptyState({ suggestions = [], onSuggestion }: Props) {
  const s = useT()
  const lang = useLang()

  return (
    <div className="empty">
      <h1 className="empty__headline">
        <span className="ds-headline-light">{s('empty.headlineLight')}</span>{' '}
        <span className="ds-headline-strong">{s('empty.headlineStrong')}</span>
      </h1>
      <p className="empty__subtitle">{s('empty.subtitle')}</p>
      {suggestions.length > 0 && (
        <ul className="empty__suggestions">
          {suggestions.map((suggestion) => {
            // The definition carries both languages, so the chip needs no string table.
            const text = suggestion[lang]
            return (
              <li key={suggestion.en}>
                <button type="button" className="chip" onClick={() => onSuggestion(text)}>
                  {text}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
