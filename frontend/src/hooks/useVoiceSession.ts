/**
 * Voice as a small state machine, plus the two streams that arrive while it is live.
 *
 * Transcripts come off the **WebRTC data channel**, straight from Voice Live. Tool activity comes
 * over **SSE from the BFF**, because that is where the tools are executed. Two sources, two
 * transports, and the split is not an accident: it is the same boundary the whole project argues
 * about — the browser gets what it can get directly, and the server keeps what needs a credential.
 *
 * Like `useAgentStream`, this hook decides nothing. It projects events.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BFF_URL } from '../config'
import { createFrameParser } from '../state/sse'
import { emptyTurn, reduceTurn, type Turn } from '../state/turn'
import type { VoiceLogEntry } from '../state/voiceLog'
import { isKnownEvent } from '../types/events'
import { startVoice, VoiceError, type VoiceErrorCode, type VoiceSession } from '../voice/session'

export type VoiceStatus = 'idle' | 'starting' | 'live' | 'error'

export interface VoiceState {
  status: VoiceStatus
  error: VoiceErrorCode | null
  muted: boolean
  /** What has been said, newest last. Whose turn it was matters to the reader. */
  transcript: { speaker: 'user' | 'agent'; text: string }[]
  /** Tool calls and results, in the same shape the chat's activity panel renders. */
  turn: Turn
  start: () => Promise<void>
  /** Ends the session and hands back what it produced, in the order it happened (spec 007). */
  stop: () => Promise<VoiceLogEntry[]>
  toggleMute: () => void
}

export function useVoiceSession(): VoiceState {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<VoiceErrorCode | null>(null)
  const [muted, setMuted] = useState(false)
  // One ordered log, not two piles. Which answer a tool call belonged to is an ordering fact, and
  // two independent lists throw it away (spec 007).
  //
  // The ref is the log; the state is its mirror, there to re-render the overlay. `stop` is called
  // from an event handler and from unmount cleanup, and must hand back the log as it stands at
  // that moment rather than as it stood when the callback was created.
  const entries = useRef<VoiceLogEntry[]>([])
  const [log, setLog] = useState<VoiceLogEntry[]>([])

  const record = useCallback((entry: VoiceLogEntry) => {
    entries.current = [...entries.current, entry]
    setLog(entries.current)
  }, [])

  const session = useRef<VoiceSession | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const activity = useRef<AbortController | null>(null)

  const stop = useCallback(async () => {
    activity.current?.abort()
    activity.current = null
    await session.current?.stop()
    session.current = null
    audio.current?.pause()
    audio.current = null
    setStatus('idle')
    setMuted(false)
    return entries.current
  }, [])

  const start = useCallback(async () => {
    if (session.current) return
    setStatus('starting')
    setError(null)
    entries.current = []
    setLog([])

    try {
      const live = await startVoice({
        onRemoteStream: (stream) => {
          const element = new Audio()
          element.srcObject = stream
          element.autoplay = true
          void element.play().catch(() => {})
          audio.current = element
        },
        onServerEvent: (event) => appendTranscript(event, record),
        onClosed: () => setStatus('idle'),
      })
      session.current = live
      setStatus('live')
      activity.current = followActivity(live.sessionId, record)
    } catch (cause) {
      setError(cause instanceof VoiceError ? cause.code : 'failed')
      setStatus('error')
    }
  }, [record])

  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      session.current?.setMuted(!wasMuted)
      return !wasMuted
    })
  }, [])

  // A tab closed mid-conversation must not leave a control channel open on the server.
  useEffect(() => () => void stop(), [stop])

  const transcript = useMemo(
    () => log.filter((entry) => entry.kind === 'said').map(({ speaker, text }) => ({ speaker, text })),
    [log],
  )
  const turn = useMemo(
    () =>
      log.reduce(
        (current, entry) => (entry.kind === 'event' ? reduceTurn(current, entry.event) : current),
        emptyTurn(),
      ),
    [log],
  )

  return { status, error, muted, transcript, turn, start, stop, toggleMute }
}

/** Subscribe to the session's tool activity — the same `AgentEvent`s the chat renders. */
function followActivity(
  sessionId: string,
  record: (entry: VoiceLogEntry) => void,
): AbortController {
  const controller = new AbortController()

  void (async () => {
    try {
      const response = await fetch(`${BFF_URL}/voice/session/${sessionId}/events`, {
        signal: controller.signal,
      })
      if (!response.body) return

      const parse = createFrameParser()
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        for (const event of parse(decoder.decode(value, { stream: true }))) {
          // Unknown types are dropped here rather than logged: the log is replayed into the chat,
          // and `reduceTurn` counts them when the overlay derives its turn from it.
          if (isKnownEvent(event)) record({ kind: 'event', event })
        }
      }
    } catch {
      // An aborted stream is the normal way this ends. A failed one leaves the last state
      // standing rather than blanking the panel mid-conversation.
    }
  })()

  return controller
}

/**
 * Voice Live's own session events, as they arrive on the data channel.
 *
 * Only the two transcript events are read. The rest — VAD edges, response lifecycle — are the
 * service's business, and inventing UI for them would be inventing behaviour.
 */
function appendTranscript(event: unknown, record: (entry: VoiceLogEntry) => void): void {
  const frame = event as { type?: string; transcript?: string; delta?: string }
  if (!frame?.type || !frame.transcript) return

  const speaker =
    frame.type === 'conversation.item.input_audio_transcription.completed'
      ? 'user'
      : frame.type === 'response.audio_transcript.done'
        ? 'agent'
        : null

  if (speaker) record({ kind: 'said', speaker, text: frame.transcript })
}
