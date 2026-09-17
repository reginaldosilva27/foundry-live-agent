/**
 * The agents kept to hand, in the rail (spec 022).
 *
 * The project has ten agents and two of them are the point of this repository. The agents screen
 * lists all ten, correctly — this is the shortcut back to the two, one click from anywhere.
 *
 * It renders **rows**, resolved from stored names against the current listing by `favouriteRows`,
 * so a favourite carries the project's own `selectable` — starring an agent cannot make this build
 * able to drive it.
 */
import { Monogram } from '../components/Monogram'
import { useT } from '../i18n/context'
import type { AgentRow } from '../types/agents'

interface Props {
  /** Already resolved against the listing; an empty list renders nothing at all. */
  rows: AgentRow[]
  answering?: string
  onSelect: (name: string) => void
}

export function Favourites({ rows, answering, onSelect }: Props) {
  const s = useT()

  if (rows.length === 0) return null

  return (
    <div className="favourites">
      <p className="sidebar__section-title">{s('favourites.title')}</p>
      <ul className="favourites__list">
        {rows.map((agent) => (
          <li key={agent.name}>
            <button
              type="button"
              className="favourites__row"
              data-agent={agent.name}
              disabled={!agent.selectable}
              aria-current={agent.name === answering ? 'true' : undefined}
              onClick={() => onSelect(agent.name)}
            >
              <Monogram name={agent.name} size={20} />
              <span className="favourites__name">{agent.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
