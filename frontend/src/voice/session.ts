/**
 * The browser half of a voice session: microphone in, agent audio out.
 *
 * Native `RTCPeerConnection` and `getUserMedia`, no SDK. The flow is short enough to read in one
 * sitting, and reading it is the point — this is the file that shows where the credential *isn't*.
 *
 * The browser makes an offer and sends it to the BFF. The BFF holds the Voice Live control channel
 * and answers. From then on audio is peer-to-peer: it never transits our server, and our server is
 * not in the latency path of anything a person hears. Nothing on this side ever sees a token.
 *
 * Every dependency on the browser is injected, so the whole negotiation is testable without a
 * microphone (spec 006, AC7/AC8).
 */
import { BFF_URL } from '../config'

export type VoiceErrorCode =
  | 'unsupported'
  | 'mic-denied'
  | 'disabled'
  | 'failed'
  | 'audio-blocked'
  /** The call was live and the peer connection went away without anyone ending it. */
  | 'dropped'

export class VoiceError extends Error {
  readonly code: VoiceErrorCode

  constructor(code: VoiceErrorCode, message: string) {
    super(message)
    this.name = 'VoiceError'
    this.code = code
  }
}

export interface VoiceSession {
  readonly sessionId: string
  setMuted(muted: boolean): void
  stop(): Promise<void>
}

export interface StartVoiceOptions {
  bffUrl?: string
  /** Which agent to attach to; absent means the BFF's configured one (spec 019, AC8). */
  agent?: string
  /**
   * Which of the deployment's OFFERED voices to speak in (spec 043).
   *
   * Absent means its default. The BFF refuses anything outside the list it declared, so this is a
   * choice among things the deployment offered rather than a name the browser invented.
   */
  voice?: string
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  createPeer?: () => RTCPeerConnection
  fetchImpl?: typeof fetch
  /** The agent's voice. The caller attaches it to an `<audio>` element. */
  onRemoteStream?: (stream: MediaStream) => void
  /** Voice Live's own events — VAD, transcripts — straight off the data channel. */
  onServerEvent?: (event: unknown) => void
  onClosed?: () => void
}

/** The data channel Voice Live publishes its session events on. Its name is part of the protocol. */
const EVENTS_CHANNEL = 'voice-live-events'

export async function startVoice(options: StartVoiceOptions = {}): Promise<VoiceSession> {
  const {
    bffUrl = BFF_URL,
    getUserMedia = (c) => navigator.mediaDevices.getUserMedia(c),
    createPeer = () => new RTCPeerConnection(),
    fetchImpl = fetch,
    agent,
    voice,
    onRemoteStream,
    onServerEvent,
    onClosed,
  } = options

  const microphone = await openMicrophone(getUserMedia)

  let peer: RTCPeerConnection
  try {
    peer = createPeer()
  } catch (cause) {
    stopTracks(microphone)
    throw new VoiceError('unsupported', `this browser cannot open a WebRTC session: ${cause}`)
  }

  try {
    const events = peer.createDataChannel(EVENTS_CHANNEL)
    events.onmessage = (message: MessageEvent) => onServerEvent?.(parse(message.data))

    for (const track of microphone.getTracks()) peer.addTrack(track, microphone)
    // `event.streams` is empty when the remote SDP carries no msid — the track still arrives, but
    // `streams[0]` is `undefined` and the audio element would get no source at all. Wrapping the
    // track is the difference between hearing the agent and silence with nothing to explain it.
    peer.ontrack = (event) =>
      onRemoteStream?.(event.streams[0] ?? new MediaStream([event.track]))
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') onClosed?.()
    }

    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    await gathered(peer)

    const sdp = peer.localDescription?.sdp ?? offer.sdp
    const { session_id, sdp_answer } = await negotiate(fetchImpl, bffUrl, sdp!, agent, voice)
    await peer.setRemoteDescription({ type: 'answer', sdp: sdp_answer })

    return handles(session_id, peer, microphone, fetchImpl, bffUrl)
  } catch (cause) {
    stopTracks(microphone)
    peer.close()
    throw cause instanceof VoiceError
      ? cause
      : new VoiceError('failed', `the voice session could not be established: ${cause}`)
  }
}

async function openMicrophone(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
): Promise<MediaStream> {
  try {
    return await getUserMedia({ audio: true })
  } catch (cause) {
    const name = (cause as { name?: string })?.name
    // A refused permission is not a malfunction, and the UI has to say something different about
    // it: the user can fix it, but only if we tell them which thing went wrong.
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new VoiceError('mic-denied', 'microphone permission was refused')
    }
    if (name === 'NotFoundError') {
      throw new VoiceError('unsupported', 'no microphone is available')
    }
    throw new VoiceError('failed', `the microphone could not be opened: ${cause}`)
  }
}

async function negotiate(
  fetchImpl: typeof fetch,
  bffUrl: string,
  sdp: string,
  agent?: string,
  voice?: string,
): Promise<{ session_id: string; sdp_answer: string }> {
  const response = await fetchImpl(`${bffUrl}/voice/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sdp, agent, voice }),
  })

  if (response.status === 503) {
    throw new VoiceError('disabled', 'voice is not configured on this server')
  }
  if (!response.ok) {
    throw new VoiceError('failed', `the BFF refused the offer (${response.status})`)
  }
  return response.json()
}

function handles(
  sessionId: string,
  peer: RTCPeerConnection,
  microphone: MediaStream,
  fetchImpl: typeof fetch,
  bffUrl: string,
): VoiceSession {
  let stopped = false

  return {
    sessionId,
    setMuted(muted: boolean) {
      // Disabling the track, not closing the call: muting should be instant and reversible, and
      // renegotiating a peer connection is neither.
      for (const track of microphone.getAudioTracks()) track.enabled = !muted
    },
    async stop() {
      if (stopped) return
      stopped = true
      stopTracks(microphone)
      peer.close()
      // Tell the BFF to let go of the control channel. A closed tab cannot, which is why the
      // server also caps and times out sessions rather than trusting this call to arrive.
      await fetchImpl(`${bffUrl}/voice/session/${sessionId}`, { method: 'DELETE' }).catch(() => {})
    },
  }
}

/** Wait for ICE candidates, but never forever: a trickle-less offer is better than no offer. */
async function gathered(peer: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
  if (peer.iceGatheringState === 'complete') return
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, timeoutMs)
    peer.onicegatheringstatechange = () => {
      if (peer.iceGatheringState === 'complete') done()
    }
  })
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}

function parse(data: unknown): unknown {
  try {
    return typeof data === 'string' ? JSON.parse(data) : data
  } catch {
    return data
  }
}
