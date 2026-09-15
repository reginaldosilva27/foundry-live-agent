/**
 * Spec 008 AC1, AC4, AC5, AC6 — the toggle, end to end against a faked BFF.
 *
 * What is asserted is what the BFF is *asked to synthesise*: the audio itself is out of jsdom's
 * reach, and `speech/player.test.ts` covers the ordering with an injected element.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { AgentEvent } from './types/events'
import { asSseStream } from './test/fixtures'

const CONFIG = {
  harness: 'prompt-agent',
  agent_name: 'foundry-live-agent',
  agent_version: null,
  model: 'conn/gpt-4o',
  uses_gateway: true,
  project_name: 'proj',
  speech: { enabled: true },
  voice: { enabled: false, webrtc_api_version: '2026-01-01-preview' },
  event_types: [],
  event_mapping: { total: 16, verified: 5, unverified: [], note: '' },
}

const ANSWER: AgentEvent[] = [
  { type: 'text_delta', text: 'São 13:53 em São Paulo. ' },
  { type: 'text_delta', text: 'Quer o horário de outra cidade?' },
  { type: 'done', response_id: 'resp_1' },
]

const FAILED: AgentEvent[] = [
  { type: 'error', message: 'model deployment was not found', code: 'harness_error' },
]

/** Returns the text of every `POST /speech` the app made. */
function fakeBff(turn: AgentEvent[], config: unknown = CONFIG) {
  const spoken: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/config')) {
        return new Response(JSON.stringify(config), { status: 200 })
      }
      if (String(url).endsWith('/speech')) {
        spoken.push(JSON.parse(String(init?.body)).text)
        return new Response(new Blob(['audio']), { status: 200 })
      }
      return new Response(asSseStream(turn), { status: 200 })
    }),
  )
  return spoken
}

async function ask(text = 'que horas são?') {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox'), text)
  await user.click(screen.getByRole('button', { name: /send|enviar/i }))
  return user
}

const speakToggle = () => screen.getByRole('button', { name: /^(speak|falar)$/i })

afterEach(() => vi.unstubAllGlobals())

describe('spoken answers', () => {
  it('says nothing at all while the toggle is off (AC1)', async () => {
    const spoken = fakeBff(ANSWER)
    render(<App />)
    await ask()

    await waitFor(() => expect(screen.getByTestId('answer')).toHaveTextContent('13:53'))
    expect(spoken).toEqual([])
  })

  it('reads each sentence of the answer once the toggle is on (AC2, AC7)', async () => {
    const spoken = fakeBff(ANSWER)
    render(<App />)

    await waitFor(() => expect(speakToggle()).toBeEnabled())
    await userEvent.setup().click(speakToggle())
    await ask()

    await waitFor(() =>
      expect(spoken).toEqual(['São 13:53 em São Paulo.', 'Quer o horário de outra cidade?']),
    )
  })

  it('holds the choice across turns, and the turn survives being stopped (AC4, AC5)', async () => {
    const spoken = fakeBff(ANSWER)
    render(<App />)

    await waitFor(() => expect(speakToggle()).toBeEnabled())
    const user = userEvent.setup()
    await user.click(speakToggle())

    await ask()
    await waitFor(() => expect(spoken.length).toBe(2))

    await user.click(screen.getByRole('button', { name: /stop speaking|parar de falar/i }))
    expect(screen.getByTestId('answer')).toHaveTextContent('13:53')

    await ask('e em Lisboa?')
    await waitFor(() => expect(spoken.length).toBe(4))
    expect(speakToggle()).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not read an error out as if it were an answer (AC6)', async () => {
    const spoken = fakeBff(FAILED)
    render(<App />)

    await waitFor(() => expect(speakToggle()).toBeEnabled())
    await userEvent.setup().click(speakToggle())
    await ask()

    await screen.findByRole('alert')
    expect(spoken).toEqual([])
  })

  it('does not offer the toggle when the BFF has no speech configuration (AC9)', async () => {
    fakeBff(ANSWER, { ...CONFIG, speech: { enabled: false } })
    render(<App />)

    await waitFor(() => expect(screen.getByTestId('harness-badge')).toHaveTextContent('prompt'))
    expect(speakToggle()).toBeDisabled()
  })
})
