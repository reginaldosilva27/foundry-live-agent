/**
 * Spec 007 AC3, AC5 — a voice session that ends lands in the chat, and the conversation continues.
 *
 * `startVoice` is mocked: this is about what the app does with a session, not about WebRTC, which
 * `voice/session.test.ts` already covers without a microphone.
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { AgentEvent } from './types/events'
import { asSseStream } from './test/fixtures'

const voice = vi.hoisted(() => ({
  onServerEvent: undefined as ((event: unknown) => void) | undefined,
  onRemoteStream: undefined as ((stream: MediaStream) => void) | undefined,
  stopped: false,
}))

vi.mock('./voice/session', () => ({
  VoiceError: class extends Error {},
  startVoice: vi.fn(
    async (options: {
      onServerEvent?: (event: unknown) => void
      onRemoteStream?: (stream: MediaStream) => void
    }) => {
    voice.onServerEvent = options.onServerEvent
    voice.onRemoteStream = options.onRemoteStream
    return {
      sessionId: 'sess_1',
      setMuted: () => {},
      stop: async () => {
        voice.stopped = true
      },
    }
    },
  ),
}))

const CONFIG = {
  harness: 'prompt-agent',
  agent_name: 'foundry-live-agent',
  agent_version: null,
  model: 'foundry-analytics-demo/gpt-4o',
  uses_gateway: true,
  project_name: 'proj-default',
  voice: { enabled: true, webrtc_api_version: '2026-01-01-preview' },
  event_types: [],
  event_mapping: { total: 16, verified: 5, unverified: [], note: '' },
}

/** `/config` answers, `/voice/.../events` stays quiet, `/chat` streams what it is given. */
function fakeBff(chat: AgentEvent[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).endsWith('/config')) {
        return new Response(JSON.stringify(CONFIG), { status: 200 })
      }
      if (String(url).includes('/voice/')) {
        return new Response(new ReadableStream({ start: (c) => c.close() }), { status: 200 })
      }
      return new Response(asSseStream(chat), { status: 200 })
    }),
  )
}

const say = (type: string, transcript: string) =>
  act(async () => {
    voice.onServerEvent?.({ type, transcript })
  })

const USER_SAID = 'conversation.item.input_audio_transcription.completed'
const AGENT_SAID = 'response.audio_transcript.done'

afterEach(() => vi.unstubAllGlobals())

describe('a voice session that ends', () => {
  it('puts the conversation in the chat, and a typed turn continues below it', async () => {
    fakeBff([
      { type: 'text_delta', text: 'typed answer' },
      { type: 'done', response_id: 'resp_1' },
    ])
    const user = userEvent.setup()
    render(<App />)

    // Two of them: the header pill and the composer's microphone. The header is the one under test.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /voice|voz/i })[0]).toBeEnabled(),
    )
    await user.click(screen.getAllByRole('button', { name: /voice|voz/i })[0])

    await say(USER_SAID, 'que horas são em São Paulo?')
    await say(AGENT_SAID, 'são 13:53')

    await user.click(screen.getByRole('button', { name: /end session|encerrar sess/i }))

    // AC5 — the block opens with a session divider.
    const divider = await screen.findByTestId('voice-divider')
    expect(divider).toHaveTextContent(/voice session|sessão de voz/i)

    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('que horas são em São Paulo?')
    expect(main).toHaveTextContent('são 13:53')

    // AC3 — what is typed next belongs to the same conversation, below what was spoken.
    await user.type(screen.getByRole('textbox'), 'e agora em texto')
    await user.click(screen.getByRole('button', { name: /send|enviar/i }))

    await waitFor(() => expect(screen.getAllByTestId('answer')).toHaveLength(2))
    expect(screen.getAllByTestId('answer').map((node) => node.textContent)).toEqual([
      'são 13:53',
      'typed answer',
    ])
  })
})


describe('the agent audio', () => {
  it('says so when the browser refuses to play it, instead of going quiet', async () => {
    // Autoplay can be blocked, or a codec can fail. The failure used to be swallowed: the session
    // ran, the transcript filled in, and the agent was simply inaudible with nothing on screen to
    // explain why (§5).
    fakeBff([])
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('NotAllowedError'))
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /voice|voz/i })[0]).toBeEnabled(),
    )
    await user.click(screen.getAllByRole('button', { name: /voice|voz/i })[0])

    await act(async () => {
      voice.onRemoteStream?.({} as MediaStream)
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /blocked the agent.s audio|bloqueou o áudio/i,
    )
  })
})


describe('the audio element', () => {
  it('lives in the document, where the browser will play it', async () => {
    // The documented WebRTC sample appends the element to the page before assigning `srcObject`;
    // ours never did. A detached element is exactly the shape of failure that produces a filling
    // transcript and no sound.
    fakeBff([])
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /voice|voz/i })[0]).toBeEnabled(),
    )
    await user.click(screen.getAllByRole('button', { name: /voice|voz/i })[0])

    await act(async () => {
      voice.onRemoteStream?.({} as MediaStream)
    })

    const element = document.querySelector('audio[data-testid="voice-audio"]')
    expect(element).not.toBeNull()
    expect(element!.isConnected).toBe(true)
  })
})
