/** Spec 008 AC2, AC3, AC4 — the queue: one request per sentence, played in order, stoppable. */
import { describe, expect, it, vi } from 'vitest'
import { createSpeechPlayer, type SpokenAudio } from './player'

/** An audio element that only ends when the test says so. */
function fakeAudio() {
  const played: string[] = []
  let finish: (() => void) | undefined

  const create = (src: string): SpokenAudio => {
    played.push(src)
    return {
      play: () => {},
      stop: () => {},
      onEnded: (done: () => void) => {
        finish = done
      },
    }
  }

  return { create, played, end: () => finish?.() }
}

function player(audio = fakeAudio()) {
  const fetched: { text: string; lang: string }[] = []
  const speech = createSpeechPlayer({
    synthesize: async (text: string, lang: string) => {
      fetched.push({ text, lang })
      return `audio:${text}`
    },
    createAudio: audio.create,
  })
  return { speech, fetched, audio }
}

describe('the speech player', () => {
  it('synthesises each sentence once and plays them in the order they were written', async () => {
    const { speech, fetched, audio } = player()

    speech.speak(['Primeira.', 'Segunda.'], 'pt')
    await vi.waitFor(() => expect(audio.played).toEqual(['audio:Primeira.']))

    audio.end()
    await vi.waitFor(() => expect(audio.played).toEqual(['audio:Primeira.', 'audio:Segunda.']))

    expect(fetched).toEqual([
      { text: 'Primeira.', lang: 'pt' },
      { text: 'Segunda.', lang: 'pt' },
    ])
  })

  it('stops what is playing and forgets what was queued (AC3, AC4)', async () => {
    const stopped: string[] = []
    const audio = fakeAudio()
    const create = (src: string) => ({ ...audio.create(src), stop: () => stopped.push(src) })
    const { speech } = player({ ...audio, create })

    speech.speak(['Uma.', 'Outra.'], 'pt')
    await vi.waitFor(() => expect(audio.played).toEqual(['audio:Uma.']))

    speech.stop()
    audio.end()

    expect(stopped).toEqual(['audio:Uma.'])
    // Nothing else starts: the queue was discarded, not paused.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(audio.played).toEqual(['audio:Uma.'])
  })

  it('carries on when one sentence fails to synthesise', async () => {
    const audio = fakeAudio()
    const speech = createSpeechPlayer({
      synthesize: async (text: string) => {
        if (text === 'Ruim.') throw new Error('503')
        return `audio:${text}`
      },
      createAudio: audio.create,
    })

    speech.speak(['Ruim.', 'Boa.'], 'pt')

    await vi.waitFor(() => expect(audio.played).toEqual(['audio:Boa.']))
  })
})
