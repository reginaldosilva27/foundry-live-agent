/**
 * The first screen.
 *
 * The headline uses the brand's trademark move: a Light sentence with a SemiBold half inside it.
 * The three suggestions are the three things this app can actually demonstrate — one app-executed
 * tool, one Foundry-executed MCP call, and one plain answer.
 */
import { useT } from '../i18n/context'
import { type StringKey } from '../i18n/strings'

const SUGGESTIONS: StringKey[] = ['empty.suggestion1', 'empty.suggestion2', 'empty.suggestion3']

interface Props {
  onSuggestion: (text: string) => void
}

export function EmptyState({ onSuggestion }: Props) {
  const s = useT()
  return (
    <div className="empty">
      <h1 className="empty__headline">
        <span className="ds-headline-light">{s('empty.headlineLight')}</span>{' '}
        <span className="ds-headline-strong">{s('empty.headlineStrong')}</span>
      </h1>
      <p className="empty__subtitle">{s('empty.subtitle')}</p>
      <ul className="empty__suggestions">
        {SUGGESTIONS.map((key) => (
          <li key={key}>
            <button type="button" className="chip" onClick={() => onSuggestion(s(key))}>
              {s(key)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
