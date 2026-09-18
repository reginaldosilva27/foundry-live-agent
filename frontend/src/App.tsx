/**
 * The three-column shell: sidebar, main column, trace panel (spec 004 AC1).
 *
 * Everything the screen shows is derived from two sources and nothing else — `GET /config` and the
 * `AgentEvent` stream. Spec 021 added a third that is not a source of truth at all: this browser's
 * own record of conversations it has already drawn. It is never read as truth, never sent back, and
 * never used to decide anything — the pointer beside it, Foundry's `conversation_id`, is what makes
 * reopening a resumption. That is the frontend half of constitution §8 intact.
 *
 * The main column shows one of two views. Two booleans' worth of navigation, so no router: nothing
 * here is addressable, and a URL scheme would have to be redesigned for spec 020 anyway.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgentChip } from './panes/AgentChip'
import { AgentsScreen } from './panes/AgentsScreen'
import { Composer } from './panes/Composer'
import { Conversation } from './panes/Conversation'
import { Header } from './panes/Header'
import { Sidebar, type View } from './panes/Sidebar'
import { TraceDrawer } from './panes/TraceDrawer'
import { VoiceOverlay } from './panes/VoiceOverlay'
import { LangContext } from './i18n/context'
import { detectLang, t as translate, type Lang } from './i18n/strings'
import { useAgentStream } from './hooks/useAgentStream'
import { useKeys } from './hooks/useKeys'
import { useRoute } from './hooks/useRoute'
import { CommandPalette } from './panes/CommandPalette'
import { HistoryScreen } from './panes/HistoryScreen'
import { type Command } from './state/keys'
import { type Entry } from './state/palette'
import { useAgents } from './state/agents'
import { favouriteRows, useFavourites } from './state/favourites'
import { titleFrom, useHistory } from './state/history'
import { useCollapsed } from './state/ui'
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
  /**
   * The address (spec 024). `view` is derived from it rather than stored beside it: two homes for
   * "which screen is showing" is the drift §4 is about, and the route is the one that survives a
   * reload. `/compare` is reserved for spec 020 and renders the chat until that spec builds it.
   */
  const { route, navigate } = useRoute()
  const view: View = route.name === 'agents' || route.name === 'history' ? route.name : 'chat'
  const setView = useCallback(
    (next: View) => navigate({ name: next === 'chat' ? 'chat' : next }),
    [navigate],
  )
  const [tracesOpen, setTracesOpen] = useState(route.name === 'trace')
  /** The response the address names, for a turn this browser may not have at all (AC6). */
  const routeResponseId = route.name === 'trace' ? route.responseId : undefined
  /** An address pointing at a conversation this browser does not have (AC7). */
  const [missing, setMissing] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const composer = useRef<HTMLTextAreaElement>(null)
  /** A question put back for editing (spec 026). The composer owns its own text otherwise. */
  const [draft, setDraft] = useState<{ text: string; at: number } | undefined>(undefined)
  const [collapsed, toggleCollapsed] = useCollapsed()
  /** The stored conversation on screen, if this session opened or saved one (spec 021). */
  const [activeId, setActiveId] = useState<string | null>(null)
  // Which turn the trace panel is showing, and which of its calls to bring into view. Empty means
  // the newest turn, which is what the header's Traces button opens (spec 009).
  const [trace, setTrace] = useState<{ turnId?: string; callId?: string }>({})
  const { config, failed } = useConfig()
  const { messages, streaming, conversationId, send, stop, append, restore, reset } =
    useAgentStream()
  const history = useHistory()
  const favourites = useFavourites()

  /**
   * Switching agents starts a new conversation (AC7).
   *
   * A Foundry conversation belongs to one agent, so carrying its id across would be the state leak
   * §8 is about — and the second agent would be answering about a thread it never had. Resetting
   * here is the one place that id is dropped; `useAgentStream` owns it and nothing else reads it.
   */
  const newConversation = useCallback(() => {
    reset()
    setActiveId(null)
    setTrace({})
    setTracesOpen(false)
    setMissing(false)
    // The address comes too. Left behind, it would still name the conversation being left, and the
    // effect below would put it straight back (spec 024).
    navigate({ name: 'chat' })
  }, [navigate, reset])

  const agents = useAgents({ onSwitch: newConversation })
  const voice = useVoiceSession()
  const elapsed = useElapsed(voice.status === 'live')

  /** Every turn names the chosen agent, or nothing at all — which is the configured one (AC12). */
  const { clearNotice, selected: selectedAgent, selectedRow } = agents
  /** Who answers, as the screen says it: the selection, else the agent the BFF is configured with. */
  const answering = selectedAgent ?? config?.agent_name
  const sendToSelected = useCallback(
    (text: string) => {
      clearNotice()
      return send(text, selectedAgent ?? undefined)
    },
    [clearNotice, selectedAgent, send],
  )

  /**
   * Choosing an agent, from wherever it was chosen.
   *
   * The card and the rail's favourites both land here so they cannot drift: `select` starts a new
   * conversation (019 AC7), and the reader is put back in the chat where that conversation is.
   */
  const selectAgent = useCallback(
    (name: string) => {
      agents.select(name)
      setView('chat')
    },
    [agents, setView],
  )

  const startVoiceSession = useCallback(
    () => void voice.start(selectedAgent ?? undefined),
    [selectedAgent, voice],
  )

  // A session that ends hands back what it produced; the chat is where it becomes readable, and
  // where it sits next to the typed turns it is meant to be compared with (spec 007).
  const endVoice = useCallback(async () => {
    const seconds = elapsed
    append(voiceMessages(await voice.stop(), seconds))
  }, [append, elapsed, voice])

  /**
   * Keep this browser's record of the conversation up to date (spec 021 AC16).
   *
   * Written when a turn settles, not on every token: a record that is rewritten sixty times a
   * second buys nothing and costs a synchronous `localStorage` write per frame. The title is taken
   * once, from the first thing the person typed, and never overwritten — a reader who renamed a
   * conversation has said what it is called.
   *
   * Deliberately keyed on `streaming` alone. The effect runs on the render where the turn settled,
   * and closes over that render's messages, which are the finished ones.
   */
  const settled = useRef(false)
  useEffect(() => {
    const justFinished = settled.current && !streaming
    settled.current = streaming
    if (!justFinished || messages.length === 0) return

    const id = activeId ?? `c_${Date.now()}`
    if (!activeId) {
      setActiveId(id)
      // `replace`, not push: this is the conversation the reader is already in acquiring a name,
      // not somewhere they navigated to. Back should leave the chat, not un-name it (spec 024).
      navigate({ name: 'conversation', id }, { replace: true })
    }

    const first = messages.find((message) => message.role === 'user')
    history.save({
      id,
      conversationId,
      agent: selectedAgent,
      title:
        history.conversations.find((c) => c.id === id)?.title ??
        titleFrom(first?.role === 'user' ? first.text : '', translate('history.untitled', lang)),
      updatedAt: Date.now(),
      messages,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on the settling edge only
  }, [streaming])

  /**
   * Reopen a stored conversation: its drawing, its Foundry id, and the agent that held it.
   *
   * `adopt` rather than `select` on purpose — restoring a conversation is not switching away from
   * one, and `select` would reset the very conversation being restored (019 AC7).
   */
  const openConversation = useCallback(
    (id: string) => navigate({ name: 'conversation', id }),
    [navigate],
  )

  /**
   * Apply the address to the screen (spec 024).
   *
   * The route is an **input**: it selects what is already in memory or in this browser's storage,
   * and never fetches. An address naming a conversation this browser does not have renders the chat
   * and says so (AC7) — it does not redirect, because rewriting the reader's address bar would lose
   * the evidence of what they opened.
   *
   * Keyed on the route alone. It reacts to where the reader asked to be, not to every render that
   * happens while they are there.
   */
  useEffect(() => {
    if (route.name === 'trace') setTracesOpen(true)

    if (route.name !== 'conversation') {
      setMissing(false)
      return
    }
    if (route.id === activeId) {
      setMissing(false)
      return
    }

    const stored = history.conversations.find((conversation) => conversation.id === route.id)
    if (!stored) {
      setMissing(true)
      return
    }

    setMissing(false)
    restore(stored.messages, stored.conversationId)
    agents.adopt(stored.agent)
    setActiveId(stored.id)
    setTrace({})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the address, not the render
  }, [route])

  /**
   * Why the restored conversation cannot be continued, when it cannot (AC18).
   *
   * Only when the listing is in: an app that could not read the project does not know that an agent
   * is missing, and refusing on a guess would be worse than letting the BFF answer for itself.
   */
  const blocked = useMemo(() => {
    const stored = activeId
      ? history.conversations.find((conversation) => conversation.id === activeId)
      : undefined
    if (!stored?.agent || agents.loading || agents.error) return undefined
    const row = agents.agents.find((agent) => agent.name === stored.agent)
    return row?.selectable ? undefined : translate('agents.blocked', lang)
  }, [activeId, agents.agents, agents.error, agents.loading, history.conversations, lang])

  /**
   * Ask a question again, and put one back in the composer (spec 026).
   *
   * `repeatTurn` is the same call the composer makes, with the origin turn named so the new one can
   * say it is a repeat. A person pressed the control; the app carries the message it was given and
   * decides nothing (§8) — which is why `noAutoRepeat.test.ts` watches this file for a `send` that
   * could be reached from a turn ending.
   *
   * `editQuestion` sends nothing at all: it fills the composer and focuses it, through the ref spec
   * 025 already put there for the `focusComposer` command.
   */
  const repeatTurn = useCallback(
    (turnId: string, question: string) => {
      if (!question || blocked) return
      clearNotice()
      void send(question, selectedAgent ?? undefined, turnId)
    },
    [blocked, clearNotice, selectedAgent, send],
  )

  const editQuestion = useCallback((text: string) => {
    setDraft({ text, at: Date.now() })
    composer.current?.focus()
  }, [])

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
  const turnResponseId = shownTurn?.role === 'agent' ? shownTurn.turn.trace?.responseId : undefined
  const shownResponseId = tracesOpen ? (turnResponseId ?? routeResponseId) : undefined
  const { trace: spanTrace, retry: retryTrace } = useTrace(shownResponseId)

  /** Where the reader goes when the panel closes: back to what they were reading. */
  const leaveTrace = useCallback(() => {
    setTracesOpen(false)
    if (route.name !== 'trace') return
    navigate(activeId ? { name: 'conversation', id: activeId } : { name: 'chat' })
  }, [activeId, navigate, route.name])

  const openTrace = useCallback(
    (turnId?: string, callId?: string) => {
      setTrace({ turnId, callId })
      setTracesOpen(true)

      // Only a turn Foundry has already identified has an address. One still streaming does not,
      // and the panel opens without one rather than inventing a placeholder id (§5).
      const target = messages.find((message) => message.id === turnId)
      const responseId = target?.role === 'agent' ? target.turn.trace?.responseId : undefined
      if (responseId) navigate({ name: 'trace', responseId })
    },
    [messages, navigate],
  )

  /** The call the reader is showing, resolved from the turn the panel is on (spec 010). */
  const openCall = useMemo(() => {
    if (!trace.callId || shownTurn?.role !== 'agent') return undefined
    return shownTurn.turn.activities.find(
      (activity, index) =>
        (activity.kind === 'tool' ? activity.callId : `mcp_${index}`) === trace.callId,
    )
  }, [shownTurn, trace.callId])

  /** One place the header, the key and the palette all go through, so the three cannot drift. */
  const toggleTraces = useCallback(() => {
    if (tracesOpen) {
      leaveTrace()
      return
    }
    setTrace({})
    openTrace(shown.agentMessages[shown.agentMessages.length - 1]?.id)
  }, [leaveTrace, openTrace, shown.agentMessages, tracesOpen])

  /**
   * Run a command (spec 025).
   *
   * Every branch calls a handler that already existed — the rail's, the screen's, the header's. A
   * command is a second *way in*, never a second implementation, which is what stops the palette
   * becoming a fourth way to choose an agent that behaves slightly differently (§4).
   */
  const run = useCallback(
    (command: Command) => {
      const actions: Record<Command, () => void> = {
        openPalette: () => setPaletteOpen(true),
        toggleRail: toggleCollapsed,
        focusComposer: () => composer.current?.focus(),
        newConversation: () => {
          clearNotice()
          newConversation()
        },
        toggleTraces,
        previousTurn: () => tracesOpen && stepTurn(-1),
        nextTurn: () => tracesOpen && stepTurn(1),
        startVoice: startVoiceSession,
        switchLanguage: () => setLang((current) => (current === 'en' ? 'pt' : 'en')),
        openHistory: () => navigate({ name: 'history' }),
      }
      actions[command]()
    },
    [
      clearNotice,
      navigate,
      newConversation,
      startVoiceSession,
      stepTurn,
      toggleCollapsed,
      toggleTraces,
      tracesOpen,
    ],
  )

  useKeys(run)

  /** What the palette chose. Agents and conversations go where the rail sends them (AC6, AC7). */
  const runEntry = useCallback(
    (entry: Entry) => {
      setPaletteOpen(false)
      if (entry.target.kind === 'agent') return selectAgent(entry.target.name)
      if (entry.target.kind === 'conversation') return openConversation(entry.target.id)
      run(entry.target.command)
    },
    [openConversation, run, selectAgent],
  )

  return (
    <LangContext.Provider value={lang}>
      <div className="app" data-traces-open={tracesOpen}>
        <Sidebar
          config={config}
          configFailed={failed}
          agents={agents}
          favourites={favouriteRows(agents.agents, favourites.names)}
          onSelectAgent={selectAgent}
          lang={lang}
          view={view}
          history={history}
          activeId={activeId}
          onLang={setLang}
          onView={setView}
          onOpenConversation={openConversation}
          onNewSession={() => run('newConversation')}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <main className="main">
          <Header
            config={config}
            selectedAgent={selectedAgent}
            selectedHarness={selectedRow?.harness ?? null}
            configFailed={failed}
            streaming={streaming}
            tracesOpen={tracesOpen}
            voiceLive={voice.status === 'live'}
            onToggleTraces={toggleTraces}
            onVoice={startVoiceSession}
          />
          {view === 'history' ? (
            <HistoryScreen history={history} onOpen={openConversation} />
          ) : view === 'agents' ? (
            <AgentsScreen
              agents={agents.agents}
              error={agents.error}
              loading={agents.loading}
              answering={answering}
              configuredAgent={config?.agent_name}
              favourites={favourites.names}
              onSelect={selectAgent}
              onFavourite={favourites.toggle}
            />
          ) : (
            <>
              <Conversation
                messages={messages}
                model={config?.model}
                agent={answering}
                notice={missing ? translate('route.conversationMissing', lang) : undefined}
                onSuggestion={sendToSelected}
                onOpenTrace={openTrace}
                onRepeat={repeatTurn}
                onEdit={editQuestion}
                blocked={blocked}
                streaming={streaming}
              />
              <Composer
                streaming={streaming}
                onStop={stop}
                voiceEnabled={config?.voice?.enabled ?? false}
                blocked={blocked}
                chip={
                  <AgentChip
                    agents={agents.agents}
                    answering={answering}
                    onSelect={agents.select}
                    onSeeAll={() => setView('agents')}
                  />
                }
                onSend={sendToSelected}
                onVoice={startVoiceSession}
                inputRef={composer}
                draft={draft}
              />
            </>
          )}

          {voice.error && <VoiceFailure code={voice.error} />}
        </main>

        {(voice.status === 'live' || voice.status === 'starting') && (
          <VoiceOverlay voice={voice} elapsed={elapsed} onEnd={endVoice} />
        )}

        <TraceDrawer
          turn={shownTurn?.role === 'agent' ? shownTurn.turn : undefined}
          responseId={routeResponseId}
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
          onClose={leaveTrace}
        />

        {paletteOpen && (
          <CommandPalette
            agents={agents.agents}
            conversations={history.conversations}
            voiceEnabled={config?.voice?.enabled ?? false}
            onRun={runEntry}
            onClose={() => setPaletteOpen(false)}
          />
        )}

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
