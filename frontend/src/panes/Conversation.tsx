/** The centre column: the empty state, then the turns, scrolled to the newest. */
import { useEffect, useRef } from 'react'
import { AnswerActions } from '../components/AnswerActions'
import { Sources } from '../components/Sources'
import { ErrorCard } from '../components/ErrorCard'
import { formatClock } from '../components/format'
import { Markdown } from '../components/Markdown'
import { MessageBubble } from '../components/MessageBubble'
import { MetaLine } from '../components/MetaLine'
import { useT } from '../i18n/context'
import type { Message } from '../hooks/useAgentStream'
import { useElapsed } from '../hooks/useElapsed'
import type { Pricing } from '../state/cost'
import { isSettled, turnStatus, type Turn } from '../state/turn'
import { sourcesOf } from '../state/sources'
import { ActivityPanel } from './ActivityPanel'
import { EmptyState } from './EmptyState'

interface Props {
  messages: Message[]
  model?: string
  /** Who is answering — it goes into the Markdown a reader downloads (spec 021). */
  agent?: string
  /** The declared rate table, or nothing (spec 028). Passed straight to the meta line. */
  pricing?: Pricing
  /** Which harness is answering, so a hosted turn can say what its estimate leaves out (AC11). */
  harness?: string
  /** Something true about the address the reader opened, when there is something (spec 024). */
  notice?: string
  onSuggestion: (text: string) => void
  /** Open the trace panel for a turn, optionally on one of its calls (spec 009). */
  onOpenTrace: (turnId: string, callId?: string) => void
  /** Ask a question again, and put one back in the composer (spec 026). */
  onRepeat: (turnId: string, question: string) => void
  onEdit: (text: string) => void
  /** Why this conversation cannot be continued, if it cannot (021 AC18). */
  blocked?: string
  /** Nothing may be asked again while a turn is in flight (026 AC10). */
  streaming?: boolean
}

/**
 * The line that says what the agent is doing right now (spec 011).
 *
 * Everything else in the stack renders only once it has content, so without this the turn is an
 * avatar and blank space for as long as the model takes to start — which reads as a frozen app
 * rather than as waiting (§5). `turnStatus` decides *what* is happening; this decides how to say
 * it, and says nothing once the answer is on screen to speak for itself.
 *
 * It also carries a clock (spec 015). A turn with seven tool-calling legs answered every call in
 * about a millisecond and spent all its seconds on the model in between, so a line that names the
 * running tool and nothing else sits unchanged through the only wait worth explaining. The clock
 * times the *current state* and restarts with it, which is why it is keyed on the status: the
 * question is "how long has this been going on", not "how long has the turn taken".
 */
function LiveLine({ turn }: { turn: Turn }) {
  const s = useT()
  const status = turnStatus(turn)
  const settled = status.kind === 'answering' || status.kind === 'settled'
  const elapsed = useElapsed(settled ? null : `${status.kind}:${status.name ?? ''}`)

  if (settled) return null

  return (
    <p className="turn__pending" data-testid="turn-pending" aria-live="polite">
      {status.kind === 'calling' ? (
        <>
          {status.step !== undefined && (
            <span className="turn__pending-step">
              {s('turn.step')} {status.step}
            </span>
          )}
          {s('turn.calling')}
          <span className="turn__pending-tool">{status.name}</span>
        </>
      ) : status.kind === 'thinking' ? (
        s('turn.thinking')
      ) : (
        s('turn.pending')
      )}
      {/* Seconds, unsuffixed by prose: it is a number, like every other number on this screen, and
          it needs no translation. */}
      {elapsed > 0 && <span className="turn__pending-elapsed">{elapsed}s</span>}
      <span className="turn__pending-dots" aria-hidden="true">
        <span className="turn__pending-dot" />
        <span className="turn__pending-dot" />
        <span className="turn__pending-dot" />
      </span>
    </p>
  )
}

/** How far from the bottom still counts as "following the stream". */
const STICKY_PX = 120

export function Conversation({
  messages,
  model,
  agent,
  pricing,
  harness,
  notice,
  onSuggestion,
  onOpenTrace,
  onRepeat,
  onEdit,
  blocked,
  streaming,
}: Props) {
  const s = useT()
  const column = useRef<HTMLDivElement>(null)

  /**
   * Follow the newest token — but only for a reader who is already at the bottom.
   *
   * Two things this deliberately does not do. It does not use `scrollIntoView`, which walks every
   * scrollable ancestor and can scroll the document out from under the app. And it does not scroll
   * a reader who has moved up: during a long answer every token is a re-render, and yanking the
   * column down on each one makes the answer impossible to read from the start.
   */
  useEffect(() => {
    const element = column.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    if (distance <= STICKY_PX) element.scrollTop = element.scrollHeight
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="conversation conversation--empty" ref={column}>
        {notice && <Notice text={notice} />}
        <EmptyState onSuggestion={onSuggestion} />
      </div>
    )
  }

  return (
    <div className="conversation" ref={column}>
      <div className="conversation__inner">
        {notice && <Notice text={notice} />}
        {messages.map((message) =>
          message.role === 'voice-session' ? (
            <p key={message.id} className="turn__divider" data-testid="voice-divider">
              {s('voice.title')}
              <span className="turn__divider-clock">{formatClock(message.seconds)}</span>
            </p>
          ) : message.role === 'user' ? (
            <MessageBubble
              key={message.id}
              text={message.text}
              onEdit={streaming || blocked ? undefined : () => onEdit(message.text)}
            />
          ) : (
            <section key={message.id} className="turn" aria-label={s('turn.agent')}>
              <div className="turn__avatar" aria-hidden="true">
                <img src="/icon-foundry-live-agent-branco.svg" alt="" width="12" height="12" />
              </div>

              <div className="turn__stack">
                {message.repeatOf && (
                  <p className="turn__repeat" data-testid="turn-repeat">
                    {s('turn.repeatOf').replace(
                      '{agent}',
                      message.repeatOf.agent ?? agent ?? '',
                    )}
                  </p>
                )}

                <ActivityPanel
                  turn={message.turn}
                  onOpenCall={(callId) => onOpenTrace(message.id, callId)}
                />

                <LiveLine turn={message.turn} />

                {message.turn.text && (
                  <div className="turn__answer" data-testid="answer">
                    {/* Controls appear when the TURN settles, not when a fence closes: a button
                        arriving mid-paragraph moves the text under the reader (spec 035). */}
                    <Markdown text={message.turn.text} settled={isSettled(message.turn)} />
                    {message.turn.status === 'streaming' && (
                      <span className="caret" aria-hidden="true" />
                    )}
                  </div>
                )}

                {message.turn.error && <ErrorCard error={message.turn.error} />}

                {/* The reader stopped listening. We say the two things we can verify: it was
                    interrupted here, and the run was never cancelled — nothing about tokens or
                    cost, which nobody has measured (spec 023, §5). */}
                {message.turn.status === 'stopped' && (
                  <p className="turn__stopped" data-testid="turn-stopped" role="status">
                    {s('turn.stopped')}
                  </p>
                )}

                {isSettled(message.turn) && (
                  <>
                    {/* Only once the turn settles (spec 034, AC10) — a list that grew as calls
                        landed would reflow the text somebody is reading, and a source is only
                        evidence once the answer that used it exists. */}
                    <Sources
                      sources={sourcesOf(message.turn)}
                      onOpenCall={(callKey) => onOpenTrace(message.id, callKey)}
                    />
                    <AnswerActions
                      turn={message.turn}
                      question={questionFor(messages, message.id)}
                      agent={agent}
                      model={model}
                      repeatOf={message.repeatOf}
                      blocked={blocked}
                      onRepeat={
                        streaming
                          ? undefined
                          : () => onRepeat(message.id, questionFor(messages, message.id))
                      }
                      latencyMs={
                        message.endedAt ? message.endedAt - message.startedAt : undefined
                      }
                      onOpenTrace={() => onOpenTrace(message.id)}
                    />
                    <MetaLine
                      turn={message.turn}
                      model={model}
                      pricing={pricing}
                      harness={harness}
                      latencyMs={
                        message.endedAt ? message.endedAt - message.startedAt : undefined
                      }
                      onOpenTrace={() => onOpenTrace(message.id)}
                    />
                  </>
                )}
              </div>
            </section>
          ),
        )}
      </div>
    </div>
  )
}

/** One line about the address, not about the conversation. */
function Notice({ text }: { text: string }) {
  return (
    <p className="conversation__notice" data-testid="conversation-notice" role="status">
      {text}
    </p>
  )
}

/**
 * The question a turn is answering: the last user message before it.
 *
 * Read from the transcript rather than stored on the turn, because that is where it already is —
 * and a copy would be a second home for the same fact (§4). A turn with nothing before it (a voice
 * session replayed into the chat) reports an empty question, and the export falls back to the
 * product name.
 */
function questionFor(messages: Message[], turnId: string): string {
  const index = messages.findIndex((message) => message.id === turnId)
  for (let at = index - 1; at >= 0; at--) {
    const message = messages[at]
    if (message.role === 'user') return message.text
  }
  return ''
}
