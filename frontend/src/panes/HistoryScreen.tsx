/**
 * The record this browser kept, and the three things you can do to all of it (spec 027).
 *
 * Spec 021 moved the agents listing out of the rail because ten agents with five facts each do not
 * fit in 248px. The same argument put this here, and one sentence is the proof: clearing has to say
 * that Foundry's conversations survive it, and that sentence has nowhere to go in a rail.
 *
 * **Nothing here talks to the BFF.** Search, export and import are reads and writes of
 * `localStorage`, which is the whole reason they are allowed to exist: what Foundry holds is
 * Foundry's, and this screen manages only the drawing beside the pointer (§8, spec 021's three
 * rules). Import writes the pointer verbatim and validates it against nothing — asking the service
 * whether a `conversation_id` exists would be this app deriving a decision from its own storage.
 */
import { useRef, useState } from 'react'
import { ClockIcon, DownloadIcon, SearchIcon, TrashIcon, UploadIcon } from '../components/Icon'
import { useT } from '../i18n/context'
import { JSON_FILE, MARKDOWN, saveFile } from '../state/download'
import { conversationToMarkdown, exportFilename } from '../state/exportTurn'
import {
  CAP,
  searchConversations,
  toExportFile,
  type HistoryState,
  type StoredConversation,
} from '../state/history'

interface Props {
  history: HistoryState
  onOpen: (id: string) => void
  /** Injected so a test can pin the clock a filename is named after. */
  now?: number
}

/** What the last import did, until the next one. `invalid` is a refusal, not a failure to report. */
type Report = { kept: number; dropped: number } | 'invalid' | null

export function HistoryScreen({ history, onOpen, now }: Props) {
  const s = useT()
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [report, setReport] = useState<Report>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const { conversations } = history
  const results = searchConversations(conversations, query)
  const at = () => new Date(now ?? Date.now())

  const exportOne = (conversation: StoredConversation) =>
    saveFile(
      exportFilename(conversation.title, at()),
      conversationToMarkdown(conversation, s),
      MARKDOWN,
    )

  const exportAll = () =>
    saveFile(
      `foundry-live-agent-history-${at().toISOString().slice(0, 10)}.json`,
      JSON.stringify(toExportFile(conversations, at().getTime()), null, 2),
      JSON_FILE,
    )

  const importFrom = async (file: File) => {
    setReport(history.importFile(await file.text()) ?? 'invalid')
    // Cleared so importing the same file twice in a row still fires a change event.
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <section className="history-screen">
      <header className="history-screen__head">
        <h1 className="history-screen__title">
          <ClockIcon size={18} />
          {s('nav.history')}
        </h1>
        <p className="history-screen__count">
          {s('history.screenNote').replace('{count}', String(conversations.length))}
        </p>
      </header>

      <div className="history-screen__actions">
        {conversations.length > 0 && (
          <button type="button" className="history-screen__action" onClick={exportAll}>
            <DownloadIcon size={15} />
            {s('history.exportAll')}
          </button>
        )}

        {/* A label wrapping a hidden input: the control reads as a button and is still a file
            input, which is the only element that can open a file picker. */}
        <label className="history-screen__action">
          <UploadIcon size={15} />
          {s('history.import')}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            aria-label={s('history.import')}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importFrom(file)
            }}
          />
        </label>

        {conversations.length > 0 && !confirming && (
          <button
            type="button"
            className="history-screen__action history-screen__action--danger"
            onClick={() => setConfirming(true)}
          >
            <TrashIcon size={15} />
            {s('history.clear')}
          </button>
        )}
      </div>

      {report && (
        <p className="history-screen__report" role="status">
          {report === 'invalid'
            ? s('history.importInvalid')
            : report.dropped > 0
              ? s('history.importedDropped')
                  .replace('{kept}', String(report.kept))
                  .replace('{dropped}', String(report.dropped))
                  .replace('{cap}', String(CAP))
              : s('history.imported').replace('{kept}', String(report.kept))}
        </p>
      )}

      {/* The one irreversible control on the screen states the cost before it is paid (AC13). The
          second sentence exists because a reader who believed this deleted their Foundry
          conversations would be wrong in a way that matters (§5). */}
      {confirming && (
        <div className="history-screen__confirm">
          <p className="history-screen__confirm-title">
            {s('history.clearConfirmTitle').replace('{count}', String(conversations.length))}
          </p>
          <p className="history-screen__confirm-body">{s('history.clearConfirmBody')}</p>
          <div className="history-screen__confirm-actions">
            <button type="button" className="history-screen__action" onClick={() => setConfirming(false)}>
              {s('history.clearCancel')}
            </button>
            <button
              type="button"
              className="history-screen__action history-screen__action--danger"
              onClick={() => {
                history.clear()
                setConfirming(false)
              }}
            >
              {s('history.clearConfirm')}
            </button>
          </div>
        </div>
      )}

      {conversations.length > 0 && (
        <div className="history-screen__search">
          <SearchIcon size={15} />
          <input
            type="search"
            className="history-screen__search-input"
            value={query}
            aria-label={s('history.search')}
            placeholder={s('history.search')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}

      {results.length === 0 && (
        <p className="history-screen__note">
          {s(query.trim() ? 'history.searchEmpty' : 'history.empty')}
        </p>
      )}

      <ul className="history-screen__list">
        {results.map(({ conversation, match }) => (
          <li key={conversation.id} className="history-screen__row">
            <button
              type="button"
              className="history-screen__open"
              onClick={() => onOpen(conversation.id)}
            >
              <span className="history-screen__row-title">{conversation.title}</span>
              {match && match.field !== 'title' && (
                <span className="history-screen__fragment">{match.fragment}</span>
              )}
            </button>

            <span className="history-screen__meta">
              {conversation.agent && (
                <span className="history-screen__agent">{conversation.agent}</span>
              )}
              <span>{`${turnCount(conversation)} ${s('history.turns')}`}</span>
              <time dateTime={new Date(conversation.updatedAt).toISOString()}>
                {new Date(conversation.updatedAt).toLocaleDateString()}
              </time>
            </span>

            <button
              type="button"
              className="history-screen__action"
              title={s('history.exportOne')}
              aria-label={s('history.exportOne')}
              onClick={() => exportOne(conversation)}
            >
              <DownloadIcon size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** How many turns this conversation holds — the answers, which is what a reader counts. */
function turnCount(conversation: StoredConversation): number {
  return conversation.messages.filter((message) => message.role === 'agent').length
}
