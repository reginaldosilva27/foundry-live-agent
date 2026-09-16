/**
 * Reading the agent's answers out loud, while they are still being written (spec 008).
 *
 * **Parked, not retired.** Nothing mounts this since 2026-09-16: beside `Voice` in the header, a
 * `Speak` toggle read as a second door into the same room, so the control came off. The hook, the
 * player and the BFF's `/speech` endpoint are untouched and still tested — mounting it again is
 * one call and two props. See the CHANGELOG entry and spec 008.
 *
 * This is a **projection**, like everything else on this side: it watches the message list, cuts
 * the newest answer into sentences as it grows, and hands them to the player. It decides nothing
 * about the turn, and turning it off changes nothing about the stream.
 *
 * Three rules worth naming, because each one is a thing that would otherwise go wrong:
 *
 * - A cursor per turn, so a sentence is never synthesised twice as more tokens arrive.
 * - A new turn stops the previous one mid-sentence: hearing the answer to the last question over
 *   the beginning of the next one is worse than losing the tail.
 * - A turn that ended in an error is never read. The error card is for the eye; a voice reading it
 *   out as if it were an answer would be a small lie.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createSpeechPlayer, type SpeechPlayer } from '../speech/player'
import { flatten, nextSentences } from '../state/speech'
import type { Message } from './useAgentStream'
import type { Lang } from '../i18n/strings'

export interface SpokenAnswers {
  /** Stop what is playing and drop what is queued. */
  stop: () => void
}

export function useSpokenAnswers(
  messages: Message[],
  lang: Lang,
  enabled: boolean,
  player?: SpeechPlayer,
): SpokenAnswers {
  const [speech] = useState(() => player ?? createSpeechPlayer())
  const cursor = useRef({ id: '', at: 0 })

  const stop = useCallback(() => speech.stop(), [speech])

  useEffect(() => {
    if (!enabled) return

    const last = messages[messages.length - 1]
    if (!last || last.role !== 'agent') return

    if (cursor.current.id !== last.id) {
      speech.stop()
      cursor.current = { id: last.id, at: 0 }
    }

    if (last.turn.error) return

    const { sentences, cursor: at } = nextSentences(flatten(last.turn.text), cursor.current.at, {
      settled: last.turn.status !== 'streaming',
    })
    cursor.current = { id: last.id, at }
    speech.speak(sentences, lang)
  }, [messages, lang, enabled, speech])

  // Turning it off mid-sentence means silence now, not at the end of the sentence.
  useEffect(() => {
    if (!enabled) speech.stop()
  }, [enabled, speech])

  return { stop }
}
