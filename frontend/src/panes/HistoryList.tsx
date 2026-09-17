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
 */
import { useState } from 'react'
import { PencilIcon, TrashIcon } from '../components/Icon'
import { useT } from '../i18n/context'
import { groupByAge, type AgeGroup, type StoredConversation } from '../state/history'
import type { StringKey } from '../i18n/strings'

interface Props {
  conversations: StoredConversation[]
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

export function HistoryList({
  conversations,
  storing,
  activeId,
  now,
  onOpen,
  onRename,
  onRemove,
}: Props) {
  const s = useT()
  const [editing, setEditing] = useState<string | null>(null)
  // Read once, when the list mounts. Groups that drift by a few minutes over a long session are not
  // worth a timer, and reading the clock on every render is both impure and pointless.
  const [mountedAt] = useState(() => Date.now())

  return (
    <div className="history">
      {conversations.length === 0 && <p className="sidebar__note">{s('history.empty')}</p>}

      {groupByAge(conversations, now ?? mountedAt).map(({ group, items }) => (
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
                      {conversation.title}
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
        conversations.length > 0 && <p className="history__note">{s('history.local')}</p>
      )}
    </div>
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
