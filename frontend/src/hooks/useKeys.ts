/**
 * The app's keyboard, dispatched from one table (spec 025).
 *
 * The listener is on `document` rather than on a wrapper element, because a shortcut has to work
 * wherever focus happens to be — including on a control in the rail while the reader is reading the
 * conversation. That makes the typing guard the only thing standing between `n` and a question with
 * a letter missing from it, which is why `state/keys.ts` owns that predicate and tests it directly.
 */
import { useEffect } from 'react'
import { isFieldFocused, matchBinding, type Command } from '../state/keys'

export function useKeys(run: (command: Command) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const binding = matchBinding(event)
      if (!binding) return
      // The reader is typing and this binding is not one of the few allowed to interrupt. Return
      // *without* preventing the default, or the character never reaches the field.
      if (!binding.whenTyping && isFieldFocused()) return

      event.preventDefault()
      run(binding.command)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [run])
}
