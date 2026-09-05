/** A user turn. Blue, right-aligned, with the design's asymmetric corner. */
import { useT } from '../i18n/context'

interface Props {
  text: string
}

export function MessageBubble({ text }: Props) {
  const s = useT()
  return (
    <div className="bubble-row">
      <p className="bubble" aria-label={s('turn.you')}>
        {text}
      </p>
    </div>
  )
}
