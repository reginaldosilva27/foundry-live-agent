/**
 * The three-column shell: sidebar, main column, trace panel (AC1).
 *
 * Everything the screen shows is derived from two sources and nothing else — `GET /config` and the
 * `AgentEvent` stream. There is no state here that Foundry also holds, which is the frontend half
 * of constitution §8.
 */
import { useMemo, useState } from 'react'
import { Composer } from './panes/Composer'
import { Conversation } from './panes/Conversation'
import { Header } from './panes/Header'
import { Sidebar } from './panes/Sidebar'
import { TraceDrawer } from './panes/TraceDrawer'
import { LangContext } from './i18n/context'
import { detectLang, type Lang } from './i18n/strings'
import { useAgentStream } from './hooks/useAgentStream'
import { useConfig } from './hooks/useConfig'

export default function App() {
  const [lang, setLang] = useState<Lang>(() =>
    detectLang(typeof navigator === 'undefined' ? [] : navigator.languages),
  )
  const [tracesOpen, setTracesOpen] = useState(false)
  const { config, failed } = useConfig()
  const { messages, streaming, send, reset } = useAgentStream()

  const lastTurn = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'agent'),
    [messages],
  )

  return (
    <LangContext.Provider value={lang}>
      <div className="app" data-traces-open={tracesOpen}>
        <Sidebar
          config={config}
          lang={lang}
          onLang={setLang}
          onNewSession={() => {
            reset()
            setTracesOpen(false)
          }}
        />

        <main className="main">
          <Header
            config={config}
            configFailed={failed}
            streaming={streaming}
            tracesOpen={tracesOpen}
            onToggleTraces={() => setTracesOpen((v) => !v)}
          />
          <Conversation
            messages={messages}
            model={config?.model}
            onSuggestion={send}
            onOpenTrace={() => setTracesOpen(true)}
          />
          <Composer disabled={streaming} onSend={send} />
        </main>

        <TraceDrawer
          turn={lastTurn?.role === 'agent' ? lastTurn.turn : undefined}
          open={tracesOpen}
          onClose={() => setTracesOpen(false)}
        />
      </div>
    </LangContext.Provider>
  )
}
