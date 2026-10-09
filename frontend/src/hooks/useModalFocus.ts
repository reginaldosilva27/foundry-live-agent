/**
 * What `aria-modal="true"` promises, kept.
 *
 * Both overlays in this app declared the attribute and honoured none of it: focus stayed on the
 * control that opened them, Tab walked straight out into the chat behind the scrim, and closing
 * left focus wherever it had wandered to. The attribute told assistive technology one thing while
 * the keyboard did another.
 *
 * One hook rather than two implementations (§4) — the reader and the voice card are the app's two
 * modals, not its two modal behaviours.
 */
import { useEffect, type RefObject } from 'react'

/** Elements a Tab can land on. `[hidden]` and `disabled` are excluded by the selector itself. */
const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export function useModalFocus(container: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    const element = container.current
    if (!element || !active) return

    // Captured before the first focus() call moves it — this is what "give it back" means.
    const opener = document.activeElement as HTMLElement | null

    const focusable = () => [...element.querySelectorAll<HTMLElement>(FOCUSABLE)]

    // The container carries `tabindex="-1"` so there is somewhere to land in a dialog whose only
    // content is text. Focusing it also takes focus off the opener, which is the point.
    const first = focusable()[0]
    ;(first ?? element).focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const stops = focusable()
      if (stops.length === 0) return event.preventDefault()

      const edge = event.shiftKey ? stops[0] : stops[stops.length - 1]
      // Only the edges need handling: everywhere else the browser's own order is correct, and
      // re-implementing it would be a worse version of it.
      if (document.activeElement === edge || !element.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? stops[stops.length - 1] : stops[0]).focus()
      }
    }

    element.addEventListener('keydown', onKeyDown)
    return () => {
      element.removeEventListener('keydown', onKeyDown)
      // `isConnected` guards the case where the opener itself left the document while the modal
      // was up — focusing a detached node silently sends focus to <body> instead.
      if (opener?.isConnected) opener.focus()
    }
  }, [container, active])
}
