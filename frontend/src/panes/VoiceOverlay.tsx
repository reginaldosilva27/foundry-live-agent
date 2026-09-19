/**
 * The voice surface: a scrim, a dark card, and what the agent is doing while you talk to it.
 *
 * The activity list is the same `ToolRow` the chat renders, from the same events. That repetition
 * is the argument made visible — the agent calling `get_current_datetime` mid-sentence is not a
 * different kind of event because you happened to ask out loud.
 *
 * **Newest first, here and only here.** A spoken conversation is watched, not read back: what
 * matters is the line that just arrived, and scrolling for it during a call is the wrong ask. The
 * chat keeps the ordinary order, where you read a thread from the top.
 *
 * The head and the controls sit outside the scrolling region. A single tool result used to grow
 * the card until `End session` was off the bottom of the screen.
 */
import { useRef } from 'react'
import { formatClock } from '../components/format'
import { MicIcon } from '../components/Icon'
import { ReasoningCard } from '../components/ReasoningCard'
import { ToolRow } from '../components/ToolRow'
import { useElapsed } from '../hooks/useElapsed'
import { useT } from '../i18n/context'
import { useModalFocus } from '../hooks/useModalFocus'
import type { VoiceState } from '../hooks/useVoiceSession'

const BARS = 10

interface Props {
  voice: VoiceState
  elapsed: number
  /** Ends the session. The app decides what becomes of what it produced, not this card. */
  onEnd: () => void
}

export function VoiceOverlay({ voice, elapsed, onEnd }: Props) {
  const s = useT()
  const scrim = useRef<HTMLDivElement>(null)
  useModalFocus(scrim)
  const starting = voice.status === 'starting'

  // The call that is running, if any. Keyed so the stopwatch restarts per call rather than
  // timing the whole session.
  const running = voice.turn.activities.find((activity) => activity.status === 'running')
  // Named apart from the session's own `elapsed` prop: one times the call, the other the call.
  const toolElapsed = useElapsed(running ? `${running.step}` : null)

  return (
    <div
      className="voice-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={s('voice.title')}
      ref={scrim}
      tabIndex={-1}
    >
      <section className="voice-card">
        <header className="voice-card__head">
          <h2 className="voice-card__title">{s('voice.title')}</h2>
          <span className="voice-card__state" data-muted={voice.muted}>
            <span className="dot" aria-hidden="true" />
            {starting
              ? s('voice.connecting')
              : voice.muted
                ? s('voice.muted')
                : s('voice.listening')}
            <span className="voice-card__clock">{formatClock(elapsed)}</span>
          </span>
        </header>

        <div className="voice-bars" aria-hidden="true" data-idle={voice.muted || starting}>
          {Array.from({ length: BARS }, (_, index) => (
            <span key={index} className="vbar" style={{ animationDelay: `${index * 90}ms` }} />
          ))}
        </div>

        <div className="voice-card__body">
          <div className="voice-transcript" aria-live="polite">
            {voice.transcript.length === 0 ? (
              <p className="voice-transcript__empty">{s('voice.transcriptEmpty')}</p>
            ) : (
              [...voice.transcript].reverse().map((line, index) => (
                <p
                  key={voice.transcript.length - index}
                  className="voice-transcript__line"
                  data-testid="voice-line"
                  data-speaker={line.speaker}
                >
                  {/* Who spoke, said three ways: an icon, the accent colour, and a name in the
                      badge's title. Colour alone is not a label. */}
                  <span
                    className="voice-transcript__who"
                    data-speaker-badge={line.speaker}
                    title={line.speaker === 'user' ? s('turn.you') : s('turn.agent')}
                  >
                    {line.speaker === 'user' ? (
                      <MicIcon size={12} />
                    ) : (
                      <img src="/icon-foundry-live-agent-branco.svg" alt="" width="12" height="12" />
                    )}
                  </span>
                  {line.text}
                </p>
              ))
            )}
          </div>

          {/* The reasoning, when the session produced one (spec 039). Nothing when it did not —
              an empty card would claim a turn reasoned and said nothing about it (spec 015). */}
          {voice.turn.reasoning && (
            <ReasoningCard text={voice.turn.reasoning} streaming={false} />
          )}

          {voice.turn.activities.length > 0 && (
            <div className="voice-activity" data-testid="voice-activity">
              <p className="voice-activity__title">
                {s('voice.toolRunning')}
                {/* A tool round trip is silent, and the person demonstrating is saying "it is
                    searching Learn right now" with nothing on screen to corroborate it (spec 016
                    fixed this for the listener, not for them). Elapsed time is a fact about our
                    OBSERVATION, which is why it comes from a hook and never from the events. */}
                {running && (
                  <span className="voice-activity__elapsed" data-testid="voice-elapsed">
                    {s('voice.elapsed').replace('{seconds}', String(toolElapsed))}
                  </span>
                )}
              </p>
              {/* The fact, not the payload. A `lookup_knowledge` result is a page of JSON, and
                  inside a 460px card over a live conversation it buries what you are listening to.
                  There is no trace panel beside a voice session, so the detail is simply not
                  offered during one (this supersedes a non-goal of spec 009). */}
              {[...voice.turn.activities].reverse().map((activity, index) => (
                <ToolRow
                  key={voice.turn.activities.length - index}
                  activity={activity}
                  showStep={voice.turn.activities.length > 1}
                />
              ))}
            </div>
          )}
        </div>

        <footer className="voice-card__actions">
          <button
            type="button"
            className="pill-button"
            aria-pressed={voice.muted}
            onClick={voice.toggleMute}
            disabled={starting}
          >
            {voice.muted ? s('voice.unmute') : s('voice.mute')}
          </button>
          <button type="button" className="pill-button pill-button--end" onClick={onEnd}>
            {s('voice.end')}
          </button>
        </footer>
      </section>
    </div>
  )
}
