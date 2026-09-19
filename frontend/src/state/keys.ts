/**
 * Every keyboard binding the app has, as data (spec 025).
 *
 * This table is the single source of truth (§4). The handler dispatches from it, the palette labels
 * itself from it, and the tooltips say what it says — so a binding changes in one place, and
 * `keys.test.ts` goes looking for key literals that escaped.
 *
 * Two rules the table encodes rather than merely intends:
 *
 * - **No chord the browser captures above the page.** `⌘⇧N` is a new incognito window and cannot be
 *   prevented; a binding the app cannot honour is worse than no binding. `⌘K` is the one contested
 *   chord that stays, because the page wins while it has focus and every comparable app binds it.
 * - **A bare letter never fires while somebody is typing.** That guard is what makes single letters
 *   usable at all in a chat application, and it is the piece that breaks quietly, so it is one
 *   predicate and it is tested directly.
 *
 * **`Escape` is deliberately absent.** It already has four owners — the payload reader, the modal
 * focus hook, the agent chip's menu and the history rename — and each closes the thing the reader is
 * actually in. That is component behaviour, not an app-wide command, and a global handler would
 * collide with all four. The palette gets its `Escape` the same way every other overlay does.
 */

/**
 * What the app can be asked to do. Every one has an on-screen control as well (AC3).
 *
 * Not all of them have a key. `startVoice`, `switchLanguage` and `openHistory` are offered by the
 * palette and bound to nothing — a chord for everything would be a chord nobody remembers, and each
 * already has a visible control. The table below is the subset that earns a key.
 */
export type Command =
  | 'openPalette'
  | 'toggleRail'
  | 'focusComposer'
  | 'newConversation'
  | 'toggleTraces'
  | 'previousTurn'
  | 'nextTurn'
  | 'startVoice'
  | 'switchLanguage'
  | 'openHistory'
  | 'toggleEvents'

export interface Binding {
  key: string
  /** `⌘` on a Mac, `Ctrl` elsewhere. Matched as "either", so one table serves both. */
  modifier?: boolean
  shift?: boolean
  /** May it fire while a text field has focus? Only `Escape` and the palette chord may. */
  whenTyping: boolean
  command: Command
  /** The string key naming it, so the palette and the tooltips read the same label. */
  label: string
}

export const BINDINGS: Binding[] = [
  { key: 'k', modifier: true, whenTyping: true, command: 'openPalette', label: 'keys.openPalette' },
  { key: 'b', modifier: true, whenTyping: false, command: 'toggleRail', label: 'keys.toggleRail' },
  { key: '/', whenTyping: false, command: 'focusComposer', label: 'keys.focusComposer' },
  { key: 'n', whenTyping: false, command: 'newConversation', label: 'keys.newConversation' },
  { key: 't', whenTyping: false, command: 'toggleTraces', label: 'keys.toggleTraces' },
  // The developer surface (spec 038). Off by default, and out of the way of anyone using the app
  // to talk to an agent.
  { key: 'e', whenTyping: false, command: 'toggleEvents', label: 'keys.toggleEvents' },
  { key: 'ArrowLeft', whenTyping: false, command: 'previousTurn', label: 'keys.previousTurn' },
  { key: 'ArrowRight', whenTyping: false, command: 'nextTurn', label: 'keys.nextTurn' },
]

/**
 * Which binding, if any, this keystroke is.
 *
 * `metaKey || ctrlKey` rather than a platform check: a Mac keyboard on a Linux browser and a PC
 * keyboard on a Mac both happen, and accepting either costs nothing that a second chord could clash
 * with — the table forbids duplicates.
 */
export function matchBinding(event: KeyboardEvent): Binding | undefined {
  const modifier = event.metaKey || event.ctrlKey
  return BINDINGS.find(
    (binding) =>
      binding.key.toLowerCase() === event.key.toLowerCase() &&
      Boolean(binding.modifier) === modifier &&
      Boolean(binding.shift) === event.shiftKey,
  )
}

/**
 * Is the reader typing?
 *
 * The whole safety of a single-letter binding rests here. A field type this does not recognise makes
 * `n` fire in the middle of a question, which is why it asks about the element rather than about a
 * list of component names.
 */
export function isFieldFocused(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  // Both, because jsdom implements the attribute and not the property — and a browser that
  // disagrees with the test environment is how a guard like this rots unnoticed.
  if (active.isContentEditable || active.getAttribute('contenteditable') === 'true') return true

  const tag = active.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}
