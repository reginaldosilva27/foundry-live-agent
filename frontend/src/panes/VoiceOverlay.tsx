/**
 * The voice surface: a scrim, a dark card, and what the agent is doing while you talk to it.
 *
 * The activity list is the same `ToolCard` the chat renders, from the same events. That repetition
 * is the argument made visible — the agent calling `get_current_datetime` mid-sentence is not a
 * different kind of event because you happened to ask out loud.
 */
import { ToolCard } from '../components/ToolCard'
import { useT } from '../i18n/context'
import type { VoiceState } from '../hooks/useVoiceSession'

const BARS = 10

interface Props {
  voice: VoiceState
  elapsed: number
}

export function VoiceOverlay({ voice, elapsed }: Props) {
  const s = useT()
  const starting = voice.status === 'starting'

  return (
    <div className="voice-scrim" role="dialog" aria-modal="true" aria-label={s('voice.title')}>
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
            <span className="voice-card__clock">{clock(elapsed)}</span>
          </span>
        </header>

        <div className="voice-bars" aria-hidden="true" data-idle={voice.muted || starting}>
          {Array.from({ length: BARS }, (_, index) => (
            <span key={index} className="vbar" style={{ animationDelay: `${index * 90}ms` }} />
          ))}
        </div>

        <div className="voice-transcript" aria-live="polite">
          {voice.transcript.length === 0 ? (
            <p className="voice-transcript__empty">{s('voice.transcriptEmpty')}</p>
          ) : (
            voice.transcript.map((line, index) => (
              <p key={index} className="voice-transcript__line" data-speaker={line.speaker}>
                {line.text}
              </p>
            ))
          )}
        </div>

        {voice.turn.activities.length > 0 && (
          <div className="voice-activity">
            <p className="voice-activity__title">{s('voice.toolRunning')}</p>
            {voice.turn.activities.map((activity, index) => (
              <ToolCard key={index} activity={activity} />
            ))}
          </div>
        )}

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
          <button type="button" className="pill-button pill-button--end" onClick={voice.stop}>
            {s('voice.end')}
          </button>
        </footer>
      </section>
    </div>
  )
}

/** mm:ss — mono, like every other number on this screen. */
function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
