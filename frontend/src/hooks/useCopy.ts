/**
 * Copy something, and say whether it worked (spec 021).
 *
 * Lifted out of `CopyRow`, which was the app's only clipboard call and said so in its own comment.
 * There are two now — an identifier in the trace panel and an answer in the chat — so "copied"
 * means the same thing in both because one place decides it (§4).
 *
 * `navigator.clipboard` is absent on every insecure origin that is not localhost, and in jsdom.
 * Optional chaining rather than a feature check, so the missing case takes the same path as a
 * rejected one: the reader is told it did not work either way.
 */
import { useEffect, useState } from 'react'

export type CopyState = 'idle' | 'copied' | 'failed'

/** How long the feedback stays up. Long enough to read, short enough not to become the label. */
const FEEDBACK_MS = 1600

export function useCopy(): { state: CopyState; copy: (value: string) => void } {
  const [state, setState] = useState<CopyState>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [state])

  const copy = (value: string) => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => setState('copied'))
      .catch(() => setState('failed'))
    if (!navigator.clipboard) setState('failed')
  }

  return { state, copy }
}
