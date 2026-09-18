/**
 * What a reader can do with a finished answer (spec 021).
 *
 * Before this, a turn ended in a meta line and stopped there: an answer you could read and not
 * much else. Three actions, all local — nothing here calls the BFF, and nothing re-prompts the
 * model. Copying an answer is not a turn.
 *
 * A turn that failed keeps only **Trace**, which is the one thing there is to do with a failure.
 */
import { ActivityIcon, CopyIcon, DownloadIcon, RepeatIcon } from './Icon'
import { useCopy } from '../hooks/useCopy'
import { useT } from '../i18n/context'
import { MARKDOWN, saveFile } from '../state/download'
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
  /**
   * Ask the same question again (spec 026).
   *
   * A person pressing this is a person asking again — the app carries the message it is given and
   * decides nothing (§8). Absent where there is nothing to repeat into, such as a voice session
   * replayed into the chat with no question before it.
   */
  onRepeat?: () => void
  /** Set when this turn re-asked an earlier question, so the export says so (spec 026). */
  repeatOf?: { turnId: string; agent?: string }
  /** Why this conversation cannot be continued, if it cannot (021 AC18). */
  blocked?: string
}

export function AnswerActions({
  turn,
  question,
  agent,
  model,
  latencyMs,
  onOpenTrace,
  onRepeat,
  repeatOf,
  blocked,
}: Props) {
  const s = useT()
  const { state, copy } = useCopy()

  const save = () => {
    const document_ = turnToMarkdown({ question, turn, agent, model, latencyMs, repeatOf, at: Date.now() }, s)
    saveFile(exportFilename(question, new Date()), document_, MARKDOWN)
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

      {onRepeat && (
        <>
          <button
            type="button"
            className="answer-actions__button"
            title={blocked ?? s('answer.repeat')}
            aria-label={s('answer.repeat')}
            aria-describedby={blocked ? 'answer-repeat-blocked' : undefined}
            disabled={Boolean(blocked)}
            onClick={onRepeat}
          >
            <RepeatIcon size={14} />
          </button>
          {blocked && (
            <span id="answer-repeat-blocked" className="visually-hidden">
              {blocked}
            </span>
          )}
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
