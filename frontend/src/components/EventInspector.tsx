/**
 * The contract, working, on screen (spec 038).
 *
 * The nine event types are the most reusable thing this repository has, and until now a reader
 * could see only their effects — a tool row, a reasoning card, a usage figure. Watching the stream
 * meant opening the browser's network inspector and reading an SSE body by hand, which is exactly
 * the audience this project tries not to require that of.
 *
 * **It reads what the app already received.** No second stream, no request of its own. The events
 * are retained on the message whether this panel is open or not, so opening it mid-turn shows the
 * whole turn rather than the remainder of one.
 *
 * **The vocabulary comes from `GET /config`**, which comes from `contract.py`. A list of type names
 * here would be a fourth place the contract is written down (§4).
 *
 * Nothing here changes what the app does: there is no inject, no replay, no edit. An app that could
 * inject an event would be an app that could fake a run.
 */
import { useState } from 'react'
import { CopyIcon } from './Icon'
import { useCopy } from '../hooks/useCopy'
import { useT } from '../i18n/context'
import { runsOf, type EventRun } from '../state/events'

interface Props {
  events: unknown[]
  /** Whether the turn hit the retention cap, so the panel can say so rather than imply completeness. */
  truncated?: boolean
  /** The contract's own vocabulary and its honesty report, from `GET /config`. */
  types: string[]
  mapping?: { total: number; verified: number; unverified: string[]; note: string }
  onClose: () => void
}

export function EventInspector({ events, truncated, types, mapping, onClose }: Props) {
  const s = useT()
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<EventRun | null>(null)
  const { state, copy } = useCopy()

  const runs = runsOf(events).filter((run) => !filter || run.type === filter)

  return (
    <aside className="events" aria-label={s('events.title')}>
      <header className="events__head">
        <h3 className="events__title">{s('events.title')}</h3>
        <button type="button" className="events__close" onClick={onClose}>
          {s('events.close')}
        </button>
      </header>

      {mapping && (
        <section className="events__contract">
          {/* §10 in numeric form, and the reason to build this panel rather than a prettier one. */}
          <p className="events__count">
            {s('events.verified')
              .replace('{verified}', String(mapping.verified))
              .replace('{total}', String(mapping.total))}
          </p>
          {mapping.unverified.length > 0 && (
            <ul className="events__unverified" data-testid="events-unverified">
              {mapping.unverified.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="events__filter" data-testid="events-filter">
        <button
          type="button"
          aria-pressed={filter === ''}
          onClick={() => setFilter('')}
        >
          {s('events.all')}
        </button>
        {/* The nine, as the config reports them. Never translated: they are contract identifiers
            a reader compares with `contract.py`. */}
        {types.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={filter === type}
            onClick={() => setFilter(type)}
          >
            {type}
          </button>
        ))}
      </div>

      {runs.length === 0 ? (
        <p className="events__empty">{s('events.empty')}</p>
      ) : (
        <ol className="events__list" data-testid="events-list">
          {runs.map((run) => (
            <li key={`${run.at}-${run.type}`}>
              <button
                type="button"
                className="events__row"
                aria-expanded={open?.at === run.at}
                onClick={() => setOpen(open?.at === run.at ? null : run)}
              >
                <span className="events__at">{run.at}</span>
                <span className="events__type">{run.type}</span>
                {run.count > 1 && (
                  <span className="events__run">
                    {s('events.runOf').replace('{count}', String(run.count))}
                  </span>
                )}
                <span className="events__summary">{run.summary}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {truncated && <p className="events__truncated">{s('events.truncated')}</p>}

      {open && (
        <section className="events__payload">
          <button
            type="button"
            className="events__copy"
            aria-label={s('events.copy')}
            title={s('events.copy')}
            onClick={() => copy(JSON.stringify(open.raw.length === 1 ? open.raw[0] : open.raw, null, 2))}
          >
            <CopyIcon size={14} />
          </button>
          {state !== 'idle' && (
            <span role="status">{s(state === 'copied' ? 'copy.copied' : 'copy.failed')}</span>
          )}
          <pre data-testid="event-payload">
            {JSON.stringify(open.raw.length === 1 ? open.raw[0] : open.raw, null, 2)}
          </pre>
        </section>
      )}
    </aside>
  )
}
