/**
 * The three-column shell: sidebar, main column, trace panel (AC1).
 *
 * Everything the screen shows is derived from two sources and nothing else — `GET /config` and the
 * `AgentEvent` stream. There is no state here that Foundry also holds, which is the frontend half
 * of constitution §8.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Composer } from './panes/Composer'
import { Conversation } from './panes/Conversation'
import { Header } from './panes/Header'
import { Sidebar } from './panes/Sidebar'
import { TraceDrawer } from './panes/TraceDrawer'
import { VoiceOverlay } from './panes/VoiceOverlay'
import { LangContext } from './i18n/context'
import { detectLang, type Lang } from './i18n/strings'
import { useAgentStream } from './hooks/useAgentStream'
import { useConfig } from './hooks/useConfig'
import { useSpokenAnswers } from './hooks/useSpokenAnswers'
import { useVoiceSession } from './hooks/useVoiceSession'
import { voiceMessages } from './state/voiceLog'
import { ErrorCard } from './components/ErrorCard'
import { useT } from './i18n/context'

export default function App() {
  const [lang, setLang] = useState<Lang>(() =>
    detectLang(typeof navigator === 'undefined' ? [] : navigator.languages),
  )
  const [tracesOpen, setTracesOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const { config, failed } = useConfig()
  const { messages, streaming, send, append, reset } = useAgentStream()
  const voice = useVoiceSession()
  const elapsed = useElapsed(voice.status === 'live')

  // A session that ends hands back what it produced; the chat is where it becomes readable, and
  // where it sits next to the typed turns it is meant to be compared with (spec 007).
  const endVoice = useCallback(async () => {
    const seconds = elapsed
    append(voiceMessages(await voice.stop(), seconds))
  }, [append, elapsed, voice])

  const spoken = useSpokenAnswers(messages, lang, speaking)

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
            voiceLive={voice.status === 'live'}
            speaking={speaking}
            onToggleTraces={() => setTracesOpen((v) => !v)}
            onVoice={() => void voice.start()}
            onToggleSpeaking={() => setSpeaking((v) => !v)}
            onStopSpeaking={spoken.stop}
          />
          <Conversation
            messages={messages}
            model={config?.model}
            onSuggestion={send}
            onOpenTrace={() => setTracesOpen(true)}
          />
          <Composer
            disabled={streaming}
            voiceEnabled={config?.voice?.enabled ?? false}
            onSend={send}
            onVoice={() => void voice.start()}
          />

          {voice.error && <VoiceFailure code={voice.error} />}
        </main>

        {(voice.status === 'live' || voice.status === 'starting') && (
          <VoiceOverlay voice={voice} elapsed={elapsed} onEnd={endVoice} />
        )}

        <TraceDrawer
          turn={lastTurn?.role === 'agent' ? lastTurn.turn : undefined}
          open={tracesOpen}
          onClose={() => setTracesOpen(false)}
        />
      </div>
    </LangContext.Provider>
  )
}

/**
 * Seconds since the session went live. Display only — nothing depends on it.
 *
 * The start instant lives inside the interval's closure rather than in state: the only writes
 * happen on a timer tick, which is the external system this effect exists to synchronise with.
 */
function useElapsed(running: boolean): number {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!running) return
    const startedAt = Date.now()
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [running])

  return running ? seconds : 0
}

/** Why voice did not start, in the language the app is in. */
function VoiceFailure({ code }: { code: 'unsupported' | 'mic-denied' | 'disabled' | 'failed' }) {
  const s = useT()
  const key = {
    'mic-denied': 'voice.errorMicDenied',
    unsupported: 'voice.errorUnsupported',
    disabled: 'voice.errorDisabled',
    failed: 'voice.errorFailed',
  } as const

  return <ErrorCard error={{ message: s(key[code]) }} />
}
