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
import { useCallback, useEffect, useRef, useState } from 'react'
import { BFF_URL } from '../config'
import { createFrameParser } from '../state/sse'
import { emptyTurn, reduceTurn, type Turn } from '../state/turn'
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
  stop: () => Promise<void>
  toggleMute: () => void
}

export function useVoiceSession(): VoiceState {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<VoiceErrorCode | null>(null)
  const [muted, setMuted] = useState(false)
  const [transcript, setTranscript] = useState<VoiceState['transcript']>([])
  const [turn, setTurn] = useState<Turn>(emptyTurn)

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
  }, [])

  const start = useCallback(async () => {
    if (session.current) return
    setStatus('starting')
    setError(null)
    setTranscript([])
    setTurn(emptyTurn())

    try {
      const live = await startVoice({
        onRemoteStream: (stream) => {
          const element = new Audio()
          element.srcObject = stream
          element.autoplay = true
          void element.play().catch(() => {})
          audio.current = element
        },
        onServerEvent: (event) => appendTranscript(event, setTranscript),
        onClosed: () => setStatus('idle'),
      })
      session.current = live
      setStatus('live')
      activity.current = followActivity(live.sessionId, setTurn)
    } catch (cause) {
      setError(cause instanceof VoiceError ? cause.code : 'failed')
      setStatus('error')
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      session.current?.setMuted(!wasMuted)
      return !wasMuted
    })
  }, [])

  // A tab closed mid-conversation must not leave a control channel open on the server.
  useEffect(() => () => void stop(), [stop])

  return { status, error, muted, transcript, turn, start, stop, toggleMute }
}

/** Subscribe to the session's tool activity — the same `AgentEvent`s the chat renders. */
function followActivity(
  sessionId: string,
  setTurn: (update: (turn: Turn) => Turn) => void,
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
          setTurn((current) => reduceTurn(current, event))
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
function appendTranscript(
  event: unknown,
  setTranscript: (update: (lines: VoiceState['transcript']) => VoiceState['transcript']) => void,
): void {
  const frame = event as { type?: string; transcript?: string; delta?: string }
  if (!frame?.type) return

  if (frame.type === 'conversation.item.input_audio_transcription.completed' && frame.transcript) {
    setTranscript((lines) => [...lines, { speaker: 'user', text: frame.transcript! }])
  }
  if (frame.type === 'response.audio_transcript.done' && frame.transcript) {
    setTranscript((lines) => [...lines, { speaker: 'agent', text: frame.transcript! }])
  }
}
