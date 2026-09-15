/** The centre column: the empty state, then the turns, scrolled to the newest. */
import { useEffect, useRef } from 'react'
import { ErrorCard } from '../components/ErrorCard'
import { formatClock } from '../components/format'
import { Markdown } from '../components/Markdown'
import { MessageBubble } from '../components/MessageBubble'
import { MetaLine } from '../components/MetaLine'
import { useT } from '../i18n/context'
import type { Message } from '../hooks/useAgentStream'
import type { Turn } from '../state/turn'
import { ActivityPanel } from './ActivityPanel'
import { EmptyState } from './EmptyState'

interface Props {
  messages: Message[]
  model?: string
  onSuggestion: (text: string) => void
  onOpenTrace: () => void
}

/**
 * A turn that is streaming and has produced nothing yet: no reasoning, no tool, no token.
 *
 * Everything else in the stack renders only once it has content, so without this the turn is an
 * avatar and blank space for as long as the model takes to start — which reads as a frozen app
 * rather than as waiting (constitution §5).
 */
function pending(turn: Turn): boolean {
  return (
    turn.status === 'streaming' &&
    !turn.text &&
    !turn.reasoning &&
    turn.activities.length === 0
  )
}

export function Conversation({ messages, model, onSuggestion, onOpenTrace }: Props) {
  const s = useT()
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="conversation conversation--empty">
        <EmptyState onSuggestion={onSuggestion} />
      </div>
    )
  }

  return (
    <div className="conversation">
      <div className="conversation__inner">
        {messages.map((message) =>
          message.role === 'voice-session' ? (
            <p key={message.id} className="turn__divider" data-testid="voice-divider">
              {s('voice.title')}
              <span className="turn__divider-clock">{formatClock(message.seconds)}</span>
            </p>
          ) : message.role === 'user' ? (
            <MessageBubble key={message.id} text={message.text} />
          ) : (
            <section key={message.id} className="turn" aria-label={s('turn.agent')}>
              <div className="turn__avatar" aria-hidden="true">
                <img src="/icon-foundry-live-agent-branco.svg" alt="" width="12" height="12" />
              </div>

              <div className="turn__stack">
                <ActivityPanel turn={message.turn} />

                {pending(message.turn) && (
                  <p className="turn__pending" data-testid="turn-pending">
                    {s('turn.pending')}
                    <span className="caret" aria-hidden="true" />
                  </p>
                )}

                {message.turn.text && (
                  <div className="turn__answer" data-testid="answer">
                    <Markdown text={message.turn.text} />
                    {message.turn.status === 'streaming' && (
                      <span className="caret" aria-hidden="true" />
                    )}
                  </div>
                )}

                {message.turn.error && <ErrorCard error={message.turn.error} />}

                {message.turn.status !== 'streaming' && (
                  <MetaLine
                    turn={message.turn}
                    model={model}
                    latencyMs={
                      message.endedAt ? message.endedAt - message.startedAt : undefined
                    }
                    onOpenTrace={onOpenTrace}
                  />
                )}
              </div>
            </section>
          ),
        )}
        <div ref={end} />
      </div>
    </div>
  )
}
