/** The input. The mic opens a voice session; it is disabled when the server has no Voice Live. */
import { useState } from 'react'
import { MicIcon, SendIcon } from '../components/Icon'
import { useT } from '../i18n/context'

interface Props {
  disabled: boolean
  voiceEnabled: boolean
  onSend: (text: string) => void
  onVoice: () => void
}

export function Composer({ disabled, voiceEnabled, onSend, onVoice }: Props) {
  const s = useT()
  const [value, setValue] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const text = value.trim()
    if (!text || disabled) return
    setValue('')
    onSend(text)
  }

  return (
    <form className="composer" onSubmit={submit}>
      <input
        className="composer__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={s('composer.placeholder')}
        aria-label={s('composer.placeholder')}
        disabled={disabled}
      />
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
        disabled={disabled || !value.trim()}
        aria-label={s('composer.send')}
      >
        <SendIcon size={17} />
      </button>
    </form>
  )
}
