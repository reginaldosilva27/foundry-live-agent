/**
 * Browser storage, for a browser that may refuse it (spec 021 AC20).
 *
 * `localStorage` has three ways to fail and none of them is an empty string: a blocked origin
 * throws on the *property access*, a private window throws on `setItem`, and a value written by an
 * older build parses as nothing. Every caller in this app would otherwise have to know all three.
 *
 * Nothing here is the app's state. What it holds is what a browser should hold about itself — a
 * collapsed rail, and a render cache of frames this browser already drew (`history.ts`). Foundry
 * owns the conversation; §8 stays true because none of this is ever sent anywhere.
 */

/**
 * Every key this browser keeps, in one place (spec 036, AC10).
 *
 * Four of these predate this registry and keep their exact spellings, because a reader's stored
 * history and favourites must survive the move. What the registry buys is the next one: a
 * preference added without a home here would be a fifth key nobody can enumerate, and the point of
 * "what this browser keeps" is that it can be listed, exported and cleared.
 *
 * `fla.theme.v1` is spelled a second time in `index.html`, deliberately — see `preferences.ts`.
 */
export const KEYS = {
  history: 'fla.history.v1',
  favourites: 'fla.favourites.v1',
  ui: 'fla.ui.v1',
  preferences: 'fla.prefs.v1',
  /** Read by the pre-paint script before any module exists, so it is stored on its own. */
  theme: 'fla.theme.v1',
  probe: 'fla.probe',
} as const

export type StorageKey = (typeof KEYS)[keyof typeof KEYS]

/** The backend, or `null` when this browser will not hand it over. */
function backend(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = backend()?.getItem(key)
    return raw === null || raw === undefined ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/** `false` means it was not stored — the caller says so rather than pretending it was. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    const store = backend()
    if (!store) return false
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function remove(key: string): void {
  try {
    backend()?.removeItem(key)
  } catch {
    // Nothing to do and nobody to tell: the key is unreachable, which is what was wanted.
  }
}

/** Whether this browser stores at all — probed, because the only honest answer is a write. */
export function available(): boolean {
  try {
    const store = backend()
    if (!store) return false
    store.setItem(KEYS.probe, '1')
    store.removeItem(KEYS.probe)
    return true
  } catch {
    return false
  }
}
