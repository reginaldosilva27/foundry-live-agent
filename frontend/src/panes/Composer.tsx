/**
 * The input. The mic opens a voice session; it is disabled when the server has no Voice Live.
 *
 * Spec 021 added the row above it: the chip naming who is about to answer, and — when a restored
 * conversation cannot be continued — the reason, in place of an input that would fail on send.
 */
import type { ReactNode } from 'react'
import { useState } from 'react'
import { MicIcon, SendIcon } from '../components/Icon'
import { useT } from '../i18n/context'

interface Props {
  disabled: boolean
  voiceEnabled: boolean
  /** Why this conversation cannot be continued, if it cannot (spec 021 AC18). */
  blocked?: string
  /** The agent chip. Passed in rather than built here: the composer knows nothing about agents. */
  chip?: ReactNode
  onSend: (text: string) => void
  onVoice: () => void
}

export function Composer({ disabled, voiceEnabled, blocked, chip, onSend, onVoice }: Props) {
  const s = useT()
  const [value, setValue] = useState('')
  const stopped = disabled || Boolean(blocked)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const text = value.trim()
    if (!text || stopped) return
    setValue('')
    onSend(text)
  }

  return (
    <form className="composer" onSubmit={submit}>
      {blocked && (
        <p className="composer__blocked" role="status">
          {blocked}
        </p>
      )}

      <input
        className="composer__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={s('composer.placeholder')}
        aria-label={s('composer.placeholder')}
        disabled={stopped}
      />

      {/* One row under the question: who answers on the left, what to do with it on the right.
          The controls used to sit beside the input with the chip stranded underneath them, which
          read as two unrelated bars stacked. */}
      <div className="composer__row">
        {chip}
        <div className="composer__actions">
          <button
            type="button"
            className="composer__mic"
            disabled={!voiceEnabled}
            title={voiceEnabled ? undefined : s('header.voiceUnavailable')}
            aria-label={s('composer.voiceInput')}
            onClick={onVoice}
          >
            <MicIcon size={17} />
          </button>
          <button
            type="submit"
            className="composer__send"
            disabled={stopped || !value.trim()}
            aria-label={s('composer.send')}
          >
            <SendIcon size={17} />
          </button>
        </div>
      </div>
    </form>
  )
}
