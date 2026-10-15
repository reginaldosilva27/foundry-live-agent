/**
 * The first screen: who is answering, a greeting, and what that agent is worth being asked.
 *
 * The greeting goes by this browser's clock (spec 060). It names nobody — the app has no sign-in and
 * knows no one's name (§5).
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
import { Monogram } from '../components/Monogram'
import { useLang, useT } from '../i18n/context'
import { greetingKey } from '../state/greeting'

export interface Suggestion {
  en: string
  pt: string
}

interface Props {
  /** The answering agent's own examples. Empty renders nothing at all. */
  suggestions?: Suggestion[]
  onSuggestion: (text: string) => void
  /** Who is answering, for the chip above the greeting. Absent renders no chip. */
  agent?: string
  /** The clock, injectable so a test can pin the hour. */
  now?: Date
}

export function EmptyState({ suggestions = [], onSuggestion, agent, now = new Date() }: Props) {
  const s = useT()
  const lang = useLang()

  return (
    <div className="empty">
      {agent && (
        <p className="empty__agent" data-testid="empty-agent">
          <Monogram name={agent} size={20} />
          <span>{agent}</span>
        </p>
      )}
      <h1 className="empty__headline">{s(greetingKey(now.getHours()))}</h1>
      <p className="empty__subtitle">{s('greeting.lead')}</p>
      {suggestions.length > 0 && (
        <ul className="empty__suggestions">
          {suggestions.map((suggestion) => {
            // The definition carries both languages, so the card needs no string table.
            const text = suggestion[lang]
            return (
              <li key={suggestion.en}>
                <button type="button" className="empty__card" onClick={() => onSuggestion(text)}>
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
