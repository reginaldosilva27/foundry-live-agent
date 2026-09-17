/**
 * The input. The mic opens a voice session; it is disabled when the server has no Voice Live.
 *
 * Spec 021 added the row above it: the chip naming who is about to answer, and — when a restored
 * conversation cannot be continued — the reason, in place of an input that would fail on send.
 *
 * Spec 023 made the field a real one. A question worth asking this agent is often three lines with
 * a snippet in it, and typed into a single line it became a smear the author could not re-read
 * before sending. The same spec gave the primary control a second job: while a turn is streaming it
 * stops that turn, in the same position, so the hand that pressed send is already on it.
 */
import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { MicIcon, SendIcon, StopIcon } from '../components/Icon'
import { useT } from '../i18n/context'

interface Props {
  /** A turn is in flight: the field waits, and the primary control stops instead of sending. */
  streaming: boolean
  voiceEnabled: boolean
  /** Why this conversation cannot be continued, if it cannot (spec 021 AC18). */
  blocked?: string
  /** The agent chip. Passed in rather than built here: the composer knows nothing about agents. */
  chip?: ReactNode
  onSend: (text: string) => void
  /** Stop the turn in flight. The browser stops listening; Foundry's run does not stop (spec 023). */
  onStop: () => void
  onVoice: () => void
  /** So the `focusComposer` command can reach it (spec 025). */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
}

/** Past this the field scrolls itself rather than eating the conversation. Mirrored in the CSS. */
const MAX_HEIGHT = '40vh'

export function Composer({
  streaming,
  voiceEnabled,
  blocked,
  chip,
  onSend,
  onStop,
  onVoice,
  inputRef,
}: Props) {
  const s = useT()
  const [value, setValue] = useState('')
  const own = useRef<HTMLTextAreaElement>(null)
  const field = inputRef ?? own
  const stopped = streaming || Boolean(blocked)

  /**
   * Grow with the content.
   *
   * Height is reset before it is read: `scrollHeight` on an element already tall enough reports the
   * old height, so a field that grew would never shrink again. Layout effect rather than effect, so
   * the two writes happen in one frame and the field never flickers at the wrong size.
   */
  useLayoutEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [field, value])

  function submit() {
    const text = value.trim()
    if (!text || stopped) return
    setValue('')
    onSend(text)
  }

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {blocked && (
        <p className="composer__blocked" role="status">
          {blocked}
        </p>
      )}

      <textarea
        ref={field}
        rows={1}
        className="composer__input"
        style={{ maxHeight: MAX_HEIGHT }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(event) => {
          // `Shift+Enter` breaks a line; plain `Enter` sends. `isComposing` is not optional: without
          // it, `Enter` confirming an input method's candidate would send half a word instead.
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
          event.preventDefault()
          submit()
        }}
        placeholder={s('composer.placeholder')}
        aria-label={s('composer.placeholder')}
        aria-describedby="composer-newline-hint"
        disabled={stopped}
      />
      <span id="composer-newline-hint" className="visually-hidden">
        {s('composer.newline')}
      </span>

      {/* One row under the question: who answers on the left, what to do with it on the right.
          The controls used to sit beside the input with the chip stranded underneath them, which
          read as two unrelated bars stacked. */}
      <div className="composer__row">
        {chip}
        <div className="composer__actions">
          <button
            type="button"
            className="composer__mic"
            disabled={!voiceEnabled || streaming}
            title={voiceEnabled ? undefined : s('header.voiceUnavailable')}
            aria-label={s('composer.voiceInput')}
            onClick={onVoice}
          >
            <MicIcon size={17} />
          </button>
          {streaming ? (
            <button
              type="button"
              className="composer__stop"
              aria-label={s('composer.stop')}
              title={s('composer.stop')}
              onClick={onStop}
            >
              <StopIcon size={17} />
            </button>
          ) : (
            <button
              type="submit"
              className="composer__send"
              disabled={stopped || !value.trim()}
              aria-label={s('composer.send')}
            >
              <SendIcon size={17} />
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
