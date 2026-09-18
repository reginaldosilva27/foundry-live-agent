/**
 * The conversations this browser kept (spec 021).
 *
 * The note above the list is not decoration. A list of past conversations in a chat app reads as a
 * server-side history, and this one is neither on a server nor Foundry's: it is a drawing this
 * browser kept beside the conversation ids Foundry gave it. Saying so once, quietly, is the §5 part
 * of the feature.
 *
 * Grouping is `groupByAge`, which omits an empty group — a heading over nothing says nothing. The
 * groups are the only headings: a `HISTORY` label above `TODAY` was a second level of the same
 * label, and in a 248px rail two rows of heading over two rows of content is what "cluttered"
 * looks like. The date already says what the list is.
 *
 * Since spec 027 it takes **search results** rather than conversations. With no query every
 * conversation is a result with nothing attached, so the unfiltered list is the same list it always
 * was; with a query, each row carries the one thing that matched and says where it was found. It
 * does not search — `searchConversations` does, and the rail owns the query (§4).
 */
import { useState } from 'react'
import { PencilIcon, TrashIcon } from '../components/Icon'
import { useT } from '../i18n/context'
import { groupByAge, type AgeGroup, type MatchField, type SearchHit } from '../state/history'
import type { StringKey } from '../i18n/strings'

interface Props {
  /** What the rail is showing: every conversation, or the ones a query matched (spec 027). */
  results: SearchHit[]
  /** Whether a query is in the field — an empty list means two different things otherwise. */
  searching?: boolean
  /** Whether this browser stores at all. `false` is a supported state, not an error (AC20). */
  storing: boolean
  activeId: string | null
  /** Injected so the grouping is testable against a fixed clock. */
  now?: number | undefined
  onOpen: (id: string) => void
  onRename: (id: string, title: string) => void
  onRemove: (id: string) => void
}

const GROUP_KEYS: Record<AgeGroup, StringKey> = {
  today: 'history.today',
  week: 'history.week',
  older: 'history.older',
}

/**
 * How a fragment is introduced.
 *
 * A title match gets none: the row already shows the title, and printing it twice in a 248px rail
 * is the kind of noise that makes a search worth turning off. A call match gets a word, because
 * `search_web` under a conversation title reads as something a person typed unless it is labelled.
 */
const MATCH_KEYS: Partial<Record<MatchField, StringKey>> = {
  tool: 'history.matchTool',
  mcp: 'history.matchServer',
}

export function HistoryList({
  results,
  searching,
  storing,
  activeId,
  now,
  onOpen,
  onRename,
  onRemove,
}: Props) {
  const s = useT()
  const [editing, setEditing] = useState<string | null>(null)
  // Grouping works on conversations, so the match travels alongside rather than through it — which
  // keeps `groupByAge` the pure, spec-021 function it already was.
  const matches = new Map(results.map((result) => [result.conversation.id, result.match]))
  // Read once, when the list mounts. Groups that drift by a few minutes over a long session are not
  // worth a timer, and reading the clock on every render is both impure and pointless.
  const [mountedAt] = useState(() => Date.now())

  return (
    <div className="history">
      {results.length === 0 && (
        <p className="sidebar__note">{s(searching ? 'history.searchEmpty' : 'history.empty')}</p>
      )}

      {groupByAge(
        results.map((result) => result.conversation),
        now ?? mountedAt,
      ).map(({ group, items }) => (
        <div key={group} className="history__group">
          <p className="sidebar__section-title">{s(GROUP_KEYS[group])}</p>
          <ul className="history__list">
            {items.map((conversation) => (
              <li key={conversation.id} className="history__row">
                {editing === conversation.id ? (
                  <RenameField
                    title={conversation.title}
                    onDone={(title) => {
                      setEditing(null)
                      if (title) onRename(conversation.id, title)
                    }}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      className="history__open"
                      aria-current={conversation.id === activeId ? 'true' : undefined}
                      onClick={() => onOpen(conversation.id)}
                    >
                      <span className="history__title">{conversation.title}</span>
                      <Fragment hit={matches.get(conversation.id)} />
                    </button>
                    <span className="history__actions">
                      <button
                        type="button"
                        className="history__action"
                        title={s('history.rename')}
                        aria-label={s('history.rename')}
                        onClick={() => setEditing(conversation.id)}
                      >
                        <PencilIcon size={13} />
                      </button>
                      <button
                        type="button"
                        className="history__action"
                        title={s('history.delete')}
                        aria-label={s('history.delete')}
                        onClick={() => onRemove(conversation.id)}
                      >
                        <TrashIcon size={13} />
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Where these live is worth one line — but only once there is something living there. Under
          an empty list it read as a warning about nothing. A browser that refuses storage is told
          either way, because that one IS about something (AC20). */}
      {!storing ? (
        <p className="history__note">{s('history.unavailable')}</p>
      ) : (
        results.length > 0 && <p className="history__note">{s('history.local')}</p>
      )}
    </div>
  )
}

/** Why this row matched, when it is not simply its title (spec 027 AC2). */
function Fragment({ hit }: { hit?: SearchHit['match'] }) {
  const s = useT()
  if (!hit || hit.field === 'title') return null

  const label = MATCH_KEYS[hit.field]
  return (
    <span className="history__fragment">
      {label && <span className="history__fragment-label">{s(label)}</span>}
      {hit.fragment}
    </span>
  )
}

/** One title, edited in place. `Escape` abandons it; the old title is never overwritten blindly. */
function RenameField({ title, onDone }: { title: string; onDone: (title: string | null) => void }) {
  const s = useT()
  const [value, setValue] = useState(title)

  return (
    <form
      className="history__rename"
      onSubmit={(event) => {
        event.preventDefault()
        onDone(value.trim() || null)
      }}
    >
      <input
        autoFocus
        className="history__rename-input"
        value={value}
        aria-label={s('history.rename')}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && onDone(null)}
        onBlur={() => onDone(null)}
      />
    </form>
  )
}
