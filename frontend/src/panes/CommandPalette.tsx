/**
 * One field that reaches everything (spec 025).
 *
 * Spec 021 put the agents on their own screen and spec 022 put favourites in the rail, both
 * correctly — and between them the ten agents, the stored conversations, the language switch and
 * the voice session ended up in four different places. This is the fast path to all of them, and
 * the map of what the app can do.
 *
 * It decides nothing. Every entry runs a handler the rail or a screen already calls, so there is no
 * fourth way to choose an agent that behaves slightly differently — and nothing here composes a
 * prompt, picks a tool, or re-runs a turn (§8).
 *
 * **Enter can never land on something that would fail.** An entry the build cannot run is shown,
 * with its reason said in the reader's language (§7), and the arrows step over it.
 */
import { useMemo, useRef, useState } from 'react'
import { useModalFocus } from '../hooks/useModalFocus'
import { useT } from '../i18n/context'
import { buildEntries, filterEntries, type Entry, type EntryGroup } from '../state/palette'
import { type StringKey } from '../i18n/strings'
import type { StoredConversation } from '../state/history'
import type { AgentRow } from '../types/agents'

interface Props {
  agents: AgentRow[]
  conversations: StoredConversation[]
  voiceEnabled: boolean
  onRun: (entry: Entry) => void
  onClose: () => void
}

const GROUP_LABELS: Record<EntryGroup, StringKey> = {
  agents: 'palette.agents',
  conversations: 'palette.conversations',
  actions: 'palette.actions',
}

/** The codes `GET /agents` sends instead of prose, said here in the reader's language (§7). */
const REASON_KEYS: Record<string, StringKey> = {
  no_harness: 'agents.reason.no_harness',
  disabled: 'agents.reason.disabled',
  version_not_active: 'agents.reason.version_not_active',
}

export function CommandPalette({ agents, conversations, voiceEnabled, onRun, onClose }: Props) {
  const s = useT()
  const dialog = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)

  useModalFocus(dialog)

  const entries = useMemo(
    () => filterEntries(buildEntries({ agents, conversations, voiceEnabled }), query),
    [agents, conversations, voiceEnabled, query],
  )

  // The arrows walk the runnable entries only, which is what makes "Enter never fails" true rather
  // than merely intended. The unrunnable ones stay rendered — hiding them would answer "why is that
  // agent missing?" with silence (§5).
  const runnable = entries.filter((entry) => entry.runnable)
  const highlighted = runnable[Math.min(at, Math.max(runnable.length - 1, 0))]

  const move = (delta: number) =>
    setAt((current) => {
      const next = current + delta
      return next < 0 ? 0 : next > runnable.length - 1 ? runnable.length - 1 : next
    })

  return (
    <div className="palette__scrim" onClick={onClose}>
      <div
        ref={dialog}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label={s('palette.open')}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        // Its own `Escape`, like every other overlay in the app. The binding table deliberately does
        // not carry one: closing the thing you are in is component behaviour, and a global handler
        // would collide with the four that already exist (spec 025).
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
      >
        <input
          className="palette__field"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-label={s('palette.placeholder')}
          placeholder={s('palette.placeholder')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setAt(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              move(1)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              move(-1)
            } else if (event.key === 'Enter' && highlighted) {
              event.preventDefault()
              onRun(highlighted)
            }
          }}
        />

        {entries.length === 0 ? (
          <p className="palette__empty">{s('palette.empty')}</p>
        ) : (
          <ul className="palette__list" id="palette-list" role="listbox">
            {entries.map((entry, index) => {
              const previous = entries[index - 1]
              return (
                <li key={entry.id}>
                  {entry.group !== previous?.group && (
                    <p className="palette__group">{s(GROUP_LABELS[entry.group])}</p>
                  )}
                  <div
                    role="option"
                    aria-selected={entry.id === highlighted?.id}
                    aria-disabled={entry.runnable ? undefined : true}
                    className="palette__entry"
                    data-runnable={entry.runnable}
                    tabIndex={entry.runnable ? 0 : -1}
                    onClick={() => entry.runnable && onRun(entry)}
                  >
                    <span className="palette__label">
                      {entry.translated ? s(entry.label as StringKey) : entry.label}
                    </span>
                    {entry.reason && REASON_KEYS[entry.reason] && (
                      <span className="palette__reason">{s(REASON_KEYS[entry.reason])}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
