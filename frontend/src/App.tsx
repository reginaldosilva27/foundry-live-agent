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
import { useTrace } from './hooks/useTrace'
import { useVoiceSession } from './hooks/useVoiceSession'
import type { VoiceErrorCode } from './voice/session'
import { voiceMessages } from './state/voiceLog'
import { ErrorCard } from './components/ErrorCard'
import { LogViewer } from './components/LogViewer'
import { useT } from './i18n/context'

export default function App() {
  const [lang, setLang] = useState<Lang>(() =>
    detectLang(typeof navigator === 'undefined' ? [] : navigator.languages),
  )
  const [tracesOpen, setTracesOpen] = useState(false)
  // Which turn the trace panel is showing, and which of its calls to bring into view. Empty means
  // the newest turn, which is what the header's Traces button opens (spec 009).
  const [trace, setTrace] = useState<{ turnId?: string; callId?: string }>({})
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

  /**
   * The turn the panel is on, and where it sits in the session (spec 014 AC4).
   *
   * Derived rather than stored: with no `turnId` the panel follows the newest turn, which is what
   * the header's Traces button opens, and a turn streaming in the background therefore does not
   * move a panel the reader has parked on an older one.
   */
  const shown = useMemo(() => {
    const agentMessages = messages.filter((m) => m.role === 'agent')
    const found = trace.turnId ? agentMessages.findIndex((m) => m.id === trace.turnId) : -1
    const index = found >= 0 ? found : agentMessages.length - 1
    return { message: agentMessages[index], index, total: agentMessages.length, agentMessages }
  }, [messages, trace.turnId])

  const shownTurn = shown.message

  /** Move to the adjacent turn, pinning the panel to it so the newest one stops pulling it away. */
  const stepTurn = useCallback(
    (delta: number) => {
      const next = shown.agentMessages[shown.index + delta]
      if (next) setTrace({ turnId: next.id })
    },
    [shown],
  )

  /**
   * The spans of whichever turn the panel is on (spec 005).
   *
   * Fetched only while the panel is open: a closed panel querying a workspace would bill for a
   * question nobody asked. Named `spanTrace` because `trace` above is the panel's *position*.
   */
  const shownResponseId =
    tracesOpen && shownTurn?.role === 'agent' ? shownTurn.turn.trace?.responseId : undefined
  const { trace: spanTrace, retry: retryTrace } = useTrace(shownResponseId)

  const openTrace = useCallback((turnId?: string, callId?: string) => {
    setTrace({ turnId, callId })
    setTracesOpen(true)
  }, [])

  /** The call the reader is showing, resolved from the turn the panel is on (spec 010). */
  const openCall = useMemo(() => {
    if (!trace.callId || shownTurn?.role !== 'agent') return undefined
    return shownTurn.turn.activities.find(
      (activity, index) =>
        (activity.kind === 'tool' ? activity.callId : `mcp_${index}`) === trace.callId,
    )
  }, [shownTurn, trace.callId])

  return (
    <LangContext.Provider value={lang}>
      <div className="app" data-traces-open={tracesOpen}>
        <Sidebar
          config={config}
          lang={lang}
          onLang={setLang}
          onNewSession={() => {
            reset()
            setTrace({})
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
            onToggleTraces={() => {
              setTrace({})
              setTracesOpen((v) => !v)
            }}
            onVoice={() => void voice.start()}
          />
          <Conversation
            messages={messages}
            model={config?.model}
            onSuggestion={send}
            onOpenTrace={openTrace}
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
          turn={shownTurn?.role === 'agent' ? shownTurn.turn : undefined}
          selectedCall={trace.callId}
          open={tracesOpen}
          position={shown.total > 0 ? { index: shown.index, total: shown.total } : undefined}
          model={config?.model}
          latencyMs={
            shownTurn?.endedAt ? shownTurn.endedAt - shownTurn.startedAt : undefined
          }
          trace={
            config?.tracing?.enabled === false
              ? { status: 'unavailable' as const, spans: [] }
              : spanTrace
          }
          usesGateway={config?.uses_gateway ?? false}
          onRetryTrace={retryTrace}
          onStep={stepTurn}
          onOpenCall={(callId) => setTrace((current) => ({ ...current, callId }))}
          onClose={() => setTracesOpen(false)}
        />

        {openCall && (
          <LogViewer
            activity={openCall}
            onClose={() => setTrace((current) => ({ ...current, callId: undefined }))}
          />
        )}
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
function VoiceFailure({ code }: { code: VoiceErrorCode }) {
  const s = useT()
  const key = {
    'mic-denied': 'voice.errorMicDenied',
    unsupported: 'voice.errorUnsupported',
    disabled: 'voice.errorDisabled',
    failed: 'voice.errorFailed',
    'audio-blocked': 'voice.errorAudioBlocked',
  } as const

  return <ErrorCard error={{ message: s(key[code]) }} />
}
