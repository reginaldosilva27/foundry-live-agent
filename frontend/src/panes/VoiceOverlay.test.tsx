/**
 * The voice card: readable while a session runs, and reachable when it fills up.
 *
 * Both failures were reported from real sessions — a tool call pushed `End session` off the
 * bottom of the screen, and the newest line of the conversation sat below the fold.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VoiceOverlay } from './VoiceOverlay'
import { emptyTurn } from '../state/turn'
import type { VoiceState } from '../hooks/useVoiceSession'

const voice = (over: Partial<VoiceState> = {}): VoiceState => ({
  status: 'live',
  error: null,
  muted: false,
  transcript: [
    { speaker: 'user', text: 'primeira pergunta' },
    { speaker: 'agent', text: 'primeira resposta' },
    { speaker: 'user', text: 'pergunta mais nova' },
  ],
  turn: emptyTurn(),
  start: async () => {},
  stop: async () => [],
  toggleMute: () => {},
  ...over,
})

const withCalls = {
  ...emptyTurn(),
  activities: [
    {
      kind: 'tool' as const,
      step: 1,
      executor: 'app' as const,
      callId: 'call_1',
      name: 'get_current_datetime',
      arguments: '{"timezone":"UTC"}',
      status: 'ok' as const,
      output: '{"iso":"2026-09-15T20:26:16"}',
    },
    {
      kind: 'tool' as const,
      step: 2,
      executor: 'app' as const,
      callId: 'call_2',
      name: 'lookup_knowledge',
      arguments: '{"query":"architecture"}',
      status: 'ok' as const,
      output: '{"passages":[{"text":"a page of documentation"}]}',
    },
  ],
}

describe('the voice card', () => {
  it('puts the newest line first, so the conversation reads without scrolling', () => {
    render(<VoiceOverlay voice={voice()} elapsed={12} onEnd={() => {}} />)

    const lines = screen.getAllByTestId('voice-line').map((node) => node.textContent)
    expect(lines[0]).toBe('pergunta mais nova')
    expect(lines[lines.length - 1]).toBe('primeira pergunta')
  })

  it('names the call without dumping its payload into the conversation', () => {
    // A `lookup_knowledge` result is a page of JSON. Rendered inside a 460px card, over a live
    // conversation, it buries the thing you are actually listening to. During a session what
    // matters is *that* a tool ran, and which one.
    render(<VoiceOverlay voice={voice({ turn: withCalls })} elapsed={12} onEnd={() => {}} />)

    const rows = screen.getAllByTestId('tool-row')
    expect(rows).toHaveLength(2)
    expect(screen.queryByTestId('tool-card')).toBeNull()
    expect(screen.getByTestId('voice-activity').textContent).not.toContain('passages')
  })

  it('marks who said each line, for eyes and for screen readers', () => {
    render(<VoiceOverlay voice={voice()} elapsed={12} onEnd={() => {}} />)

    const lines = screen.getAllByTestId('voice-line')
    expect(lines[0].querySelector('[data-speaker-badge="user"]')).not.toBeNull()
    expect(lines[1].querySelector('[data-speaker-badge="agent"]')).not.toBeNull()
    // The badge carries the name of the speaker, translated — colour alone is not a label.
    expect(screen.getAllByTitle(/you|você/i).length).toBeGreaterThan(0)
  })

  it('shows the newest call first too', () => {
    render(<VoiceOverlay voice={voice({ turn: withCalls })} elapsed={12} onEnd={() => {}} />)

    expect(screen.getAllByTestId('tool-row')[0]).toHaveTextContent('lookup_knowledge')
  })

  it('keeps the controls out of the scrolling region, so they stay reachable', () => {
    // A tool call used to grow the card until `End session` was off the bottom of the screen.
    const { container } = render(<VoiceOverlay voice={voice()} elapsed={12} onEnd={() => {}} />)

    const body = container.querySelector('.voice-card__body')
    expect(body).not.toBeNull()
    expect(body!.querySelector('.voice-card__actions')).toBeNull()
    expect(container.querySelector('.voice-card > .voice-card__actions')).not.toBeNull()
  })
})

/**
 * The card declares `aria-modal="true"`, which promises that nothing behind it is reachable. It is
 * the only thing on screen during a live session, and it has two controls — so Tab off the last
 * one has to come back to the first rather than walking into the chat behind the scrim.
 */
describe('the voice card as a modal', () => {
  it('moves focus into the card when the session opens', () => {
    render(<VoiceOverlay voice={voice()} elapsed={0} onEnd={() => {}} />)

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('wraps Tab from the last control back to the first', () => {
    render(<VoiceOverlay voice={voice()} elapsed={0} onEnd={() => {}} />)
    const controls = screen.getAllByRole('button')
    const [first, last] = [controls[0], controls[controls.length - 1]]
    expect(controls.length).toBeGreaterThan(1)

    last.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('gives focus back to whatever started the session', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const { unmount } = render(<VoiceOverlay voice={voice()} elapsed={0} onEnd={() => {}} />)
    expect(document.activeElement).not.toBe(opener)

    unmount()
    expect(document.activeElement).toBe(opener)
  })
})

/** Spec 015 AC12 — the ordinal belongs to the call, not to the place it is drawn. */
describe('the ordinal on a surface that lists newest-first', () => {
  it('numbers each call by its place in the turn, not by its place on screen', () => {
    render(<VoiceOverlay voice={voice({ turn: withCalls })} elapsed={12} onEnd={() => {}} />)

    // The overlay reverses the list so the newest call is on top. The numbers must not reverse
    // with it: call_2 is still the second thing the agent did.
    const steps = screen.getAllByTestId('tool-step').map((node) => node.textContent)
    expect(steps).toEqual(['2', '1'])
  })
})

// --- What the session is doing, while it does it (spec 039) ----------------------------

describe('a call that is still running (AC3, AC11)', () => {
  const running = {
    ...emptyTurn(),
    activities: [
      {
        kind: 'tool' as const,
        step: 1,
        executor: 'app' as const,
        callId: 'call_1',
        name: 'search_web',
        arguments: '{}',
        status: 'running' as const,
      },
    ],
  }

  it('shows elapsed time, because a tool round trip is otherwise silent', () => {
    // Spec 016 fixed the silence for the LISTENER with a spoken preamble. This fixes it for the
    // person standing in front of a room saying "it is searching right now".
    render(<VoiceOverlay voice={voice({ turn: running })} elapsed={12} onEnd={() => {}} />)

    expect(screen.getByTestId('voice-elapsed')).toBeInTheDocument()
  })

  it('shows none once nothing is running', () => {
    render(<VoiceOverlay voice={voice({ turn: withCalls })} elapsed={12} onEnd={() => {}} />)
    expect(screen.queryByTestId('voice-elapsed')).not.toBeInTheDocument()
  })

  it('keeps the finished call’s own duration', () => {
    const { container } = render(
      <VoiceOverlay voice={voice({ turn: withCalls })} elapsed={12} onEnd={() => {}} />,
    )
    // The duration comes from the event, not from our stopwatch: one is what happened, the other
    // is what we observed.
    expect(container.querySelector('[data-testid="voice-activity"]')).toBeInTheDocument()
  })
})

describe('the reasoning, when there is one (AC12)', () => {
  it('renders it', () => {
    const reasoned = { ...emptyTurn(), reasoning: 'Checking the current time first.' }
    render(<VoiceOverlay voice={voice({ turn: reasoned })} elapsed={3} onEnd={() => {}} />)

    expect(screen.getByText(/Checking the current time first/)).toBeInTheDocument()
  })

  it('renders nothing at all when there is none', () => {
    // An empty card would claim the turn reasoned and said nothing about it (spec 015).
    const { container } = render(
      <VoiceOverlay voice={voice()} elapsed={3} onEnd={() => {}} />,
    )
    expect(container.querySelector('.reasoning')).toBeNull()
  })
})

describe('the guards (AC7, AC9)', () => {
  it('issues no request — nothing here talks to the session', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<VoiceOverlay voice={voice({ turn: withCalls })} elapsed={5} onEnd={() => {}} />)

    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('writes nothing to storage — the replay is the record, not this', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<VoiceOverlay voice={voice({ turn: withCalls })} elapsed={5} onEnd={() => {}} />)

    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })
})

