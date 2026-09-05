/** The centre column: the empty state, then the turns, scrolled to the newest. */
import { useEffect, useRef } from 'react'
import { ErrorCard } from '../components/ErrorCard'
import { Markdown } from '../components/Markdown'
import { MessageBubble } from '../components/MessageBubble'
import { MetaLine } from '../components/MetaLine'
import { useT } from '../i18n/context'
import type { Message } from '../hooks/useAgentStream'
import { ActivityPanel } from './ActivityPanel'
import { EmptyState } from './EmptyState'

interface Props {
  messages: Message[]
  model?: string
  onSuggestion: (text: string) => void
  onOpenTrace: () => void
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
          message.role === 'user' ? (
            <MessageBubble key={message.id} text={message.text} />
          ) : (
            <section key={message.id} className="turn" aria-label={s('turn.agent')}>
              <div className="turn__avatar" aria-hidden="true">
                <img src="/icon-dataside-branco.svg" alt="" width="12" height="12" />
              </div>

              <div className="turn__stack">
                <ActivityPanel turn={message.turn} />

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
