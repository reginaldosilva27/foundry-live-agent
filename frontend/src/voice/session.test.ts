/**
 * Spec 006 AC7, AC8 — the browser half of the voice session.
 *
 * `getUserMedia`, `RTCPeerConnection` and `fetch` are faked at the boundary, because that boundary
 * is exactly what the browser owns and CI does not have: there is no microphone here, and no
 * network. Everything above it — the order of the negotiation, what reaches the BFF, what happens
 * when a permission is refused — is real code running real paths.
 *
 * What these tests deliberately do **not** claim: that a human can hear the agent. No assertion in
 * CI can. That is checked by hand and recorded as checked by hand (§5).
 */
import { describe, expect, it, vi } from 'vitest'
import { startVoice, VoiceError } from './session'

const ANSWER = 'v=0\r\no=str0m 1 2 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\nm=audio 9 RTP/SAVPF 111\r\n'

class FakePeer {
  static last: FakePeer | null = null

  localDescription: RTCSessionDescriptionInit | null = null
  remoteDescription: RTCSessionDescriptionInit | null = null
  iceGatheringState: RTCIceGatheringState = 'complete'
  closed = false
  channels: string[] = []
  senders: { track: MediaStreamTrack }[] = []
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null
  onicegatheringstatechange: (() => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  connectionState: RTCPeerConnectionState = 'new'

  constructor() {
    FakePeer.last = this
  }

  createDataChannel(label: string) {
    this.channels.push(label)
    return { onmessage: null, onopen: null, close: () => {} }
  }
  addTrack(track: MediaStreamTrack) {
    this.senders.push({ track })
  }
  async createOffer() {
    return { type: 'offer' as const, sdp: 'v=0\r\nOFFER\r\n' }
  }
  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description
  }
  close() {
    this.closed = true
  }
}

function fakeTrack(): MediaStreamTrack {
  return { enabled: true, stop: vi.fn(), kind: 'audio' } as unknown as MediaStreamTrack
}

function fakeStream(track: MediaStreamTrack): MediaStream {
  return { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream
}

function harness(overrides: Record<string, unknown> = {}) {
  const track = fakeTrack()
  const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') return new Response(null, { status: 204 })
    return new Response(JSON.stringify({ session_id: 'sess-1', sdp_answer: ANSWER }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })

  return {
    track,
    fetchImpl,
    options: {
      getUserMedia: vi.fn(async () => fakeStream(track)),
      createPeer: () => new FakePeer() as unknown as RTCPeerConnection,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ...overrides,
    },
  }
}

describe('starting a voice session', () => {
  it('sends the browser offer to the BFF and applies the answer', async () => {
    const { options, fetchImpl } = harness()

    const session = await startVoice(options)

    expect(session.sessionId).toBe('sess-1')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toMatch(/\/voice\/session$/)
    expect(JSON.parse(init!.body as string)).toEqual({ sdp: 'v=0\r\nOFFER\r\n' })
    expect(FakePeer.last!.remoteDescription).toEqual({ type: 'answer', sdp: ANSWER })
  })

  it('asks for audio only, and opens the data channel Voice Live names', async () => {
    const { options } = harness()

    await startVoice(options)

    expect(options.getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(FakePeer.last!.channels).toContain('voice-live-events')
    expect(FakePeer.last!.senders).toHaveLength(1)
  })

  it('never sends a credential, because it never has one', async () => {
    const { options, fetchImpl } = harness()

    await startVoice(options)

    const init = fetchImpl.mock.calls[0][1]!
    expect(Object.keys(init.headers ?? {})).toEqual(['content-type'])
  })

  it('hands the agent audio to the caller to play', async () => {
    const remote = fakeStream(fakeTrack())
    const onRemoteStream = vi.fn()
    const { options } = harness()

    await startVoice({ ...options, onRemoteStream })
    FakePeer.last!.ontrack!({ streams: [remote] })

    expect(onRemoteStream).toHaveBeenCalledWith(remote)
  })
})

describe('controlling a live session', () => {
  it('mutes by disabling the microphone track, not by tearing down the call', async () => {
    const { options, track } = harness()

    const session = await startVoice(options)
    session.setMuted(true)
    expect(track.enabled).toBe(false)
    expect(FakePeer.last!.closed).toBe(false)

    session.setMuted(false)
    expect(track.enabled).toBe(true)
  })

  it('stops the microphone, closes the peer and tells the BFF to hang up', async () => {
    const { options, track, fetchImpl } = harness()

    const session = await startVoice(options)
    await session.stop()

    expect(track.stop).toHaveBeenCalled()
    expect(FakePeer.last!.closed).toBe(true)
    const [url, init] = fetchImpl.mock.calls.at(-1)!
    expect(init!.method).toBe('DELETE')
    expect(url).toMatch(/\/voice\/session\/sess-1$/)
  })

  it('is safe to stop twice', async () => {
    const { options, fetchImpl } = harness()

    const session = await startVoice(options)
    await session.stop()
    await session.stop()

    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
  })
})

describe('when it cannot start', () => {
  it('says the microphone was refused, distinctly from anything else', async () => {
    const { options } = harness({
      getUserMedia: vi.fn(async () => {
        throw Object.assign(new Error('denied'), { name: 'NotAllowedError' })
      }),
    })

    await expect(startVoice(options)).rejects.toMatchObject({ code: 'mic-denied' })
  })

  it('says the browser cannot do it, rather than failing obscurely', async () => {
    const { options } = harness({
      createPeer: () => {
        throw new TypeError('RTCPeerConnection is not defined')
      },
    })

    await expect(startVoice(options)).rejects.toMatchObject({ code: 'unsupported' })
  })

  it('reports a refused negotiation and releases the microphone', async () => {
    const { options, track } = harness({
      fetchImpl: vi.fn(async () => new Response('no', { status: 502 })),
    })

    await expect(startVoice(options)).rejects.toBeInstanceOf(VoiceError)
    expect(track.stop).toHaveBeenCalled()
  })

  it('reports a server with voice switched off as its own case', async () => {
    const { options } = harness({
      fetchImpl: vi.fn(async () => new Response('off', { status: 503 })),
    })

    await expect(startVoice(options)).rejects.toMatchObject({ code: 'disabled' })
  })
})
