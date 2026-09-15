/**
 * The spoken-answer queue: synthesise a sentence, play it, then the next one (spec 008).
 *
 * The browser holds no Azure credential, so synthesis is a `POST /speech` to the BFF and what comes
 * back is MP3 bytes. Everything a browser provides — `fetch`, `Audio`, object URLs — is injected,
 * which is what makes the ordering rules testable without a speaker, exactly as `voice/session.ts`
 * is testable without a microphone.
 *
 * Two rules the queue exists to keep:
 *
 * 1. **Order.** Sentence two waits for sentence one to finish, however fast its audio arrived.
 * 2. **Stop means stop.** `stop()` discards the queue as well as the playback — a new question
 *    must not be followed by the tail of the answer to the previous one.
 *
 * A sentence that fails to synthesise is skipped, not retried and not fatal: a missing sentence is
 * bad, and silence for the rest of the answer is worse.
 */
import { BFF_URL } from '../config'

/** The half of an `<audio>` element this file needs. */
export interface SpokenAudio {
  play: () => void
  stop: () => void
  onEnded: (done: () => void) => void
}

export interface SpeechPlayerOptions {
  synthesize?: (text: string, lang: string) => Promise<string>
  createAudio?: (src: string) => SpokenAudio
}

export interface SpeechPlayer {
  /** Queue sentences to be read, in this order. */
  speak: (sentences: string[], lang: string) => void
  /** Stop playing and drop everything queued. */
  stop: () => void
  speaking: () => boolean
}

export function createSpeechPlayer(options: SpeechPlayerOptions = {}): SpeechPlayer {
  const synthesize = options.synthesize ?? requestSpeech
  const createAudio = options.createAudio ?? browserAudio

  const queue: { text: string; lang: string }[] = []
  let current: SpokenAudio | null = null
  let running = false
  // Bumped by `stop`, so work already in flight knows it belongs to a session that is over.
  let generation = 0

  const drain = async () => {
    if (running) return
    running = true
    const mine = generation

    while (queue.length > 0 && mine === generation) {
      const next = queue.shift()!
      let src: string
      try {
        src = await synthesize(next.text, next.lang)
      } catch {
        continue // One sentence lost is better than the rest of the answer lost.
      }
      if (mine !== generation) break

      await new Promise<void>((resolve) => {
        const audio = createAudio(src)
        current = audio
        audio.onEnded(() => {
          current = null
          resolve()
        })
        audio.play()
      })
    }

    running = false
  }

  return {
    speak(sentences, lang) {
      if (sentences.length === 0) return
      queue.push(...sentences.map((text) => ({ text, lang })))
      void drain()
    },
    stop() {
      generation += 1
      queue.length = 0
      current?.stop()
      current = null
    },
    speaking: () => running,
  }
}

/** The real thing: ask the BFF for audio and hand back a URL an element can play. */
async function requestSpeech(text: string, lang: string): Promise<string> {
  const response = await fetch(`${BFF_URL}/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang }),
  })
  if (!response.ok) throw new Error(`the BFF answered ${response.status}`)
  return URL.createObjectURL(await response.blob())
}

/**
 * The real thing: an `<audio>` element, cleaned up after itself.
 *
 * **Every way this can end must end it.** `play()` rejects when the browser blocks autoplay, and a
 * decode failure fires `error` rather than `ended`. Treating either as silence-forever would stall
 * the queue on its first sentence and take the rest of the answer with it.
 */
function browserAudio(src: string): SpokenAudio {
  const element = new Audio(src)
  let ended: () => void = () => {}
  let over = false

  const finish = () => {
    if (over) return
    over = true
    URL.revokeObjectURL(src)
    ended()
  }

  return {
    play: () => {
      // `play()` returns a promise in every browser that matters; it rejects when autoplay is
      // blocked. Where it returns nothing — jsdom, and browsers older than this app supports —
      // completion cannot be observed at all, and waiting for an `ended` that will never fire
      // would stall the queue on its first sentence.
      let started: Promise<void> | undefined
      try {
        started = element.play()
      } catch {
        finish()
        return
      }
      if (started?.catch) started.catch(finish)
      else finish()
    },
    stop: () => {
      element.pause()
      over = true
      URL.revokeObjectURL(src)
    },
    onEnded: (done) => {
      ended = done
      element.onended = finish
      element.onerror = finish
    },
  }
}
