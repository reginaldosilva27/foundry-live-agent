/**
 * Spec 008 AC1, AC2, AC5, AC6, AC7 — what gets read aloud, and what does not.
 *
 * These assertions used to be driven through the header's `Speak` toggle (`App.speech.test.tsx`).
 * The toggle came off on 2026-09-16 and the feature did not, so the tests moved down to the hook
 * rather than being deleted with the button — a parked feature with no tests is a feature that
 * quietly rots. The audio itself is out of jsdom's reach; `speech/player.test.ts` covers the
 * ordering with an injected element, and here the player is a spy.
 */
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSpokenAnswers } from './useSpokenAnswers'
import type { SpeechPlayer } from '../speech/player'
import type { Message } from './useAgentStream'
import { emptyTurn, type Turn } from '../state/turn'

function fakePlayer() {
  const spoken: string[] = []
  const player: SpeechPlayer = {
    speak: (sentences) => spoken.push(...sentences),
    stop: vi.fn(),
    speaking: () => false,
  }
  return { player, spoken }
}

function agentTurn(id: string, turn: Partial<Turn>): Message {
  return { role: 'agent', id, startedAt: 0, turn: { ...emptyTurn(), ...turn } }
}

const settled = (text: string): Partial<Turn> => ({ text, status: 'done' })

describe('spoken answers', () => {
  it('says nothing at all while it is off (AC1)', () => {
    const { player, spoken } = fakePlayer()
    renderHook(() => useSpokenAnswers([agentTurn('t1', settled('São 13:53.'))], 'pt', false, player))

    expect(spoken).toEqual([])
  })

  it('reads each sentence of the answer, and each of them once (AC2, AC7)', () => {
    const { player, spoken } = fakePlayer()
    const { rerender } = renderHook(
      ({ messages }) => useSpokenAnswers(messages, 'pt', true, player),
      { initialProps: { messages: [agentTurn('t1', { text: 'São 13:53 em São Paulo. ' })] } },
    )
    expect(spoken).toEqual(['São 13:53 em São Paulo.'])

    // The same turn, grown by more tokens: the first sentence is not said twice.
    rerender({
      messages: [agentTurn('t1', settled('São 13:53 em São Paulo. Quer outra cidade?'))],
    })
    expect(spoken).toEqual(['São 13:53 em São Paulo.', 'Quer outra cidade?'])
  })

  it('stops the previous turn when a new one starts (AC5)', () => {
    const { player, spoken } = fakePlayer()
    const { rerender } = renderHook(
      ({ messages }) => useSpokenAnswers(messages, 'pt', true, player),
      { initialProps: { messages: [agentTurn('t1', settled('São 13:53.'))] } },
    )

    rerender({
      messages: [agentTurn('t1', settled('São 13:53.')), agentTurn('t2', settled('Em Lisboa, 17:53.'))],
    })

    expect(player.stop).toHaveBeenCalled()
    expect(spoken).toEqual(['São 13:53.', 'Em Lisboa, 17:53.'])
  })

  it('does not read an error out as if it were an answer (AC6)', () => {
    const { player, spoken } = fakePlayer()
    const failed = agentTurn('t1', {
      text: 'Let me check',
      status: 'error',
      error: { message: 'model deployment was not found' },
    })
    renderHook(() => useSpokenAnswers([failed], 'en', true, player))

    expect(spoken).toEqual([])
  })

  // Turning it off is silence now, not silence at the end of the sentence.
  it('stops what is playing the moment it is switched off', () => {
    const { player } = fakePlayer()
    const { rerender } = renderHook(
      ({ on }) => useSpokenAnswers([agentTurn('t1', settled('São 13:53.'))], 'pt', on, player),
      { initialProps: { on: true } },
    )

    rerender({ on: false })
    expect(player.stop).toHaveBeenCalled()
  })
})
