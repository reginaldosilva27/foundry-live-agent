/** Spec 007 AC1, AC2, AC4, AC5 — the session log, turned into chat messages. */
import { describe, expect, it } from 'vitest'
import { voiceMessages, type VoiceLogEntry } from './voiceLog'
import type { AgentMessage, Message } from '../hooks/useAgentStream'

const said = (speaker: 'user' | 'agent', text: string): VoiceLogEntry => ({
  kind: 'said',
  speaker,
  text,
})

const call: VoiceLogEntry = {
  kind: 'event',
  event: {
    type: 'tool_call',
    call_id: 'call_1',
    name: 'get_current_datetime',
    arguments: '{"timezone":"America/Sao_Paulo"}',
    executor: 'app',
  },
}

const result: VoiceLogEntry = {
  kind: 'event',
  event: {
    type: 'tool_result',
    call_id: 'call_1',
    name: 'get_current_datetime',
    output: '{"iso":"2026-09-15T13:53:00-03:00"}',
    duration_ms: 3,
  },
}

const agentTurns = (messages: Message[]): AgentMessage[] =>
  messages.filter((m): m is AgentMessage => m.role === 'agent')

describe('voiceMessages', () => {
  it('replays the session in the order it happened (AC1)', () => {
    const messages = voiceMessages(
      [
        said('user', 'que horas são?'),
        said('agent', 'são 13:53'),
        said('user', 'e em Lisboa?'),
        said('agent', 'são 17:53'),
      ],
      42,
    )

    expect(messages.map((m) => m.role)).toEqual([
      'voice-session',
      'user',
      'agent',
      'user',
      'agent',
    ])
    expect(messages.filter((m) => m.role === 'user').map((m) => 'text' in m && m.text)).toEqual([
      'que horas são?',
      'e em Lisboa?',
    ])
    expect(agentTurns(messages).map((m) => m.turn.text)).toEqual(['são 13:53', 'são 17:53'])
  })

  it('attributes a tool to the answer it produced, not to the session (AC2)', () => {
    const messages = voiceMessages(
      [
        said('user', 'que horas são?'),
        call,
        result,
        said('agent', 'são 13:53'),
        said('user', 'obrigado'),
        said('agent', 'de nada'),
      ],
      20,
    )

    const [first, second] = agentTurns(messages)
    expect(first.turn.activities).toHaveLength(1)
    expect(first.turn.activities[0]).toMatchObject({
      kind: 'tool',
      name: 'get_current_datetime',
      executor: 'app',
      status: 'ok',
    })
    expect(second.turn.activities).toHaveLength(0)
  })

  it('keeps a trailing call in a turn of its own rather than gluing it to the last answer', () => {
    const messages = voiceMessages([said('agent', 'pronto'), call], 5)
    const [answered, trailing] = agentTurns(messages)

    expect(answered.turn.text).toBe('pronto')
    expect(answered.turn.activities).toHaveLength(0)
    expect(trailing.turn.text).toBe('')
    expect(trailing.turn.activities).toHaveLength(1)
  })

  it('appends nothing for a session that produced nothing (AC4)', () => {
    expect(voiceMessages([], 7)).toEqual([])
  })

  it('opens the block with a session divider carrying the duration (AC5)', () => {
    const [divider] = voiceMessages([said('user', 'oi')], 83)
    expect(divider).toMatchObject({ role: 'voice-session', seconds: 83 })
  })

  it('settles every turn it produces — a replayed session is not still streaming', () => {
    const messages = voiceMessages([said('user', 'oi'), said('agent', 'olá')], 3)
    expect(agentTurns(messages).every((m) => m.turn.status === 'done')).toBe(true)
  })
})
