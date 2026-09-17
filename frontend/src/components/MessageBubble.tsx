/** A user turn. Blue, right-aligned, with the design's asymmetric corner. */
import { PencilIcon } from './Icon'
import { useT } from '../i18n/context'

interface Props {
  text: string
  /**
   * Put this question back in the composer (spec 026).
   *
   * It sends nothing. A question that came out wrong could only be fixed by retyping it, and the
   * text is already on screen — this is the control that says so. Absent while a turn is streaming
   * and when the conversation cannot be continued.
   */
  onEdit?: () => void
}

export function MessageBubble({ text, onEdit }: Props) {
  const s = useT()
  return (
    <div className="bubble-row">
      {onEdit && (
        <button
          type="button"
          className="bubble__edit"
          title={s('question.edit')}
          aria-label={s('question.edit')}
          onClick={onEdit}
        >
          <PencilIcon size={13} />
        </button>
      )}
      <p className="bubble" aria-label={s('turn.you')}>
        {text}
      </p>
    </div>
  )
}
