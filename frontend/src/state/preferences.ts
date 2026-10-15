/**
 * What this browser remembers about how the app should look and behave (spec 036).
 *
 * **Preferences, not configuration.** Everything here belongs to one browser. What the *deployment*
 * decided is read-only and lives on `/about` (spec 032), and keeping the two apart on screen is one
 * of the things this app exists to teach.
 *
 * Nothing travels (§9). Nothing here changes what the agent does.
 *
 * **The theme is applied by an attribute on `<html>`**, which is also what the pre-paint script in
 * `index.html` sets. One mechanism, so a reload and a click cannot disagree. That script has to run
 * before any module exists, so it spells the key itself — the one deliberate duplication in this
 * module, and `preferences.test.ts` asserts the two spellings agree (§4).
 */
import { useCallback, useEffect, useState } from 'react'
import { KEYS, readJson, writeJson } from './storage'
import type { Lang } from '../i18n/strings'

export type Theme = 'system' | 'light' | 'dark'

export interface Preferences {
  theme: Theme
  /**
   * `undefined` means **detect**, which is what the app did before this spec and what it must keep
   * doing for a reader who never chose. Absent and `'en'` are different facts (§5).
   */
  lang?: Lang
  /**
   * Which voice to speak in (spec 043). `undefined` means the deployment's default — absent and
   * "the same as the default" are different facts, and a stored name could outlive the list.
   */
  voice?: string
  speakAnswers: boolean
  reasoningOpen: boolean
  activityOpen: boolean
}

export const DEFAULTS: Preferences = {
  // Light until someone says otherwise (spec 060): the owner chose it over following the OS.
  // `system` stays a choice in Preferences.
  theme: 'light',
  speakAnswers: false,
  reasoningOpen: false,
  activityOpen: false,
}

export function readPreferences(): Preferences {
  return { ...DEFAULTS, ...readJson<Partial<Preferences>>(KEYS.preferences, {}) }
}

/**
 * Put the theme on the document.
 *
 * `system` removes the attribute rather than writing one, so the stylesheet's
 * `prefers-color-scheme` block takes over — which is what makes AC2 work with no listener of our
 * own beyond the one below.
 */
export function applyTheme(theme: Theme): void {
  const root = globalThis.document?.documentElement
  if (!root) return
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

/**
 * What the rail's switch sets (spec 060): the opposite of what is on screen. From `system` that
 * means asking which scheme the system resolves to, and the answer becomes an explicit choice.
 */
export function oppositeTheme(theme: Theme, systemDark: boolean): 'light' | 'dark' {
  const shown = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  return shown === 'dark' ? 'light' : 'dark'
}

export interface PreferencesState extends Preferences {
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  /** Whether this browser will keep them. `false` is a fact the panel states, not a failure. */
  stored: boolean
}

export function usePreferences(): PreferencesState {
  const [prefs, setPrefs] = useState<Preferences>(readPreferences)
  const [stored, setStored] = useState(true)

  // Applied on mount as well as on change: the pre-paint script set the attribute from its own
  // key, and this is what keeps the two in step for the rest of the session.
  useEffect(() => {
    applyTheme(prefs.theme)
    writeJson(KEYS.theme, prefs.theme)
  }, [prefs.theme])

  const set = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPrefs((current) => {
        const next = { ...current, [key]: value }
        // A browser that refuses storage still gets the preference for this session (AC7).
        setStored(writeJson(KEYS.preferences, next))
        return next
      })
    },
    [],
  )

  return { ...prefs, set, stored }
}
