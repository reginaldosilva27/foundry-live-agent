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
  /** `agent` names who speaks; absent means the BFF's configured one (spec 019, AC8). */
  /** `voice` names which of the deployment's offered voices to speak in (spec 043). */
  start: (agent?: string, voice?: string) => Promise<void>
  /** Ends the session and hands back what it produced, in the order it happened (spec 007). */
  stop: () => Promise<VoiceLogEntry[]>
  toggleMute: () => void
}

export interface VoiceOptions {
  /**
   * The call ended without anyone pressing end — the peer connection failed or closed.
   *
   * Receives the log, so what was said still lands in the chat the way an ended session's does
   * (spec 007): the overlay is gone the moment the session is, so this is the only way out.
   */
  onDropped?: (log: VoiceLogEntry[]) => void
}

export function useVoiceSession({ onDropped }: VoiceOptions = {}): VoiceState {
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
  /**
   * A start still negotiating, and whether an end arrived during it.
   *
   * `session.current` is only set once the start resolves, so before these a second click opened a
   * second session, and an end pressed while `starting` found nothing to end — then the start
   * resolved and the call went live with the reader believing it was over (assessment 2026-10-15).
   */
  const pending = useRef(false)
  const cancelled = useRef(false)
  const dropped = useRef(onDropped)
  useEffect(() => {
    dropped.current = onDropped
  }, [onDropped])

  /** Everything an end releases: the activity stream, the peer and microphone, the `<audio>`. */
  const teardown = useCallback(async () => {
    activity.current?.abort()
    activity.current = null
    const current = session.current
    session.current = null
    await current?.stop()
    audio.current?.pause()
    audio.current?.remove()
    audio.current = null
    setMuted(false)
  }, [])

  const stop = useCallback(async () => {
    if (pending.current) cancelled.current = true
    await teardown()
    setStatus('idle')
    return entries.current
  }, [teardown])

  const start = useCallback(async (agent?: string, voice?: string) => {
    if (session.current || pending.current) return
    pending.current = true
    cancelled.current = false
    setStatus('starting')
    setError(null)
    entries.current = []
    setLog([])

    try {
      let live: VoiceSession | null = null
      live = await startVoice({
        agent,
        voice,
        onRemoteStream: (stream) => {
          // **Attached to the document, like the documented sample does.** A detached `new Audio()`
          // is the shape of failure that leaves a filling transcript and no sound: the element
          // exists, `srcObject` is set, nothing is heard and nothing is reported.
          const element = document.createElement('audio')
          element.dataset.testid = 'voice-audio'
          element.autoplay = true
          element.srcObject = stream
          document.body.appendChild(element)
          audio.current = element

          // A rejected `play()` — autoplay blocked, a codec the browser will not decode — used to
          // be swallowed, and the session then ran with a filling transcript and an inaudible
          // agent. It is reported instead; the session itself is fine and keeps going (§5).
          const started = element.play?.()
          if (started?.catch) started.catch(() => setError('audio-blocked'))
        },
        onServerEvent: (event) => appendTranscript(event, record),
        // The peer went away by itself. Only the session still on screen is torn down: a close that
        // follows an end the reader pressed (or a newer session) is not a drop.
        onClosed: () => {
          if (!live || session.current !== live) return
          void teardown().then(() => {
            setError('dropped')
            setStatus('error')
            dropped.current?.(entries.current)
          })
        },
      })
      pending.current = false
      if (cancelled.current) {
        await live.stop()
        setStatus('idle')
        return
      }
      session.current = live
      setStatus('live')
      activity.current = followActivity(live.sessionId, record)
    } catch (cause) {
      pending.current = false
      if (cancelled.current) {
        setStatus('idle')
        return
      }
      setError(cause instanceof VoiceError ? cause.code : 'failed')
      setStatus('error')
    }
  }, [record, teardown])

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
