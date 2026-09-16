/**
 * What a reader can do with a finished answer (spec 021).
 *
 * Before this, a turn ended in a meta line and stopped there: an answer you could read and not
 * much else. Three actions, all local — nothing here calls the BFF, and nothing re-prompts the
 * model. Copying an answer is not a turn.
 *
 * A turn that failed keeps only **Trace**, which is the one thing there is to do with a failure.
 */
import { ActivityIcon, CopyIcon, DownloadIcon } from './Icon'
import { useCopy } from '../hooks/useCopy'
import { useT } from '../i18n/context'
import { exportFilename, turnToMarkdown } from '../state/exportTurn'
import type { Turn } from '../state/turn'

interface Props {
  turn: Turn
  /** The question that caused the turn — the export opens with it. */
  question: string
  agent?: string
  model?: string
  latencyMs?: number
  onOpenTrace: () => void
}

export function AnswerActions({ turn, question, agent, model, latencyMs, onOpenTrace }: Props) {
  const s = useT()
  const { state, copy } = useCopy()

  const save = () => {
    const document_ = turnToMarkdown({ question, turn, agent, model, latencyMs, at: Date.now() }, s)
    saveFile(exportFilename(question, new Date()), document_)
  }

  return (
    <div className="answer-actions" data-testid="answer-actions">
      {turn.text && (
        <>
          <button
            type="button"
            className="answer-actions__button"
            title={s('answer.copy')}
            aria-label={s('answer.copy')}
            onClick={() => copy(turn.text)}
          >
            <CopyIcon size={14} />
          </button>
          <button
            type="button"
            className="answer-actions__button"
            title={s('answer.download')}
            aria-label={s('answer.download')}
            onClick={save}
          >
            <DownloadIcon size={14} />
          </button>
        </>
      )}

      <button
        type="button"
        className="answer-actions__button"
        title={s('answer.trace')}
        aria-label={s('answer.trace')}
        onClick={onOpenTrace}
      >
        <ActivityIcon size={14} />
      </button>

      {state !== 'idle' && (
        <span className="answer-actions__feedback" role="status">
          {s(state === 'copied' ? 'copy.copied' : 'copy.failed')}
        </span>
      )}
    </div>
  )
}

/**
 * Hand a file to the browser.
 *
 * An object URL and a synthetic click, which is the only way a page saves a file it generated. The
 * URL is revoked immediately after: it holds the blob alive until something lets go of it.
 */
function saveFile(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}
