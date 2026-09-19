/**
 * What this browser keeps (spec 036).
 *
 * The counterpart to `/about`, and deliberately a different screen. That one is what the
 * **deployment** decided and is read-only; this is what **this browser** prefers and every control
 * writes. Putting them together would blur a distinction this app exists to teach, and it is the
 * same line spec 021 drew for the history and spec 022 for the favourites.
 *
 * Nothing here travels, and nothing here changes what the agent does.
 */
import { useT } from '../i18n/context'
import type { Lang } from '../i18n/strings'
import { LANGS } from '../i18n/strings'
import type { PreferencesState, Theme } from '../state/preferences'

const THEMES: Theme[] = ['system', 'light', 'dark']

const THEME_KEYS = {
  system: 'prefs.theme.system',
  light: 'prefs.theme.light',
  dark: 'prefs.theme.dark',
} as const

export function PreferencesScreen({ prefs }: { prefs: PreferencesState }) {
  const s = useT()

  return (
    <section className="prefs" aria-label={s('prefs.title')}>
      <h2 className="prefs__title">{s('prefs.title')}</h2>
      {/* Said plainly, as history and favourites say it: this is one browser's copy. */}
      <p className="prefs__lead">{s('prefs.lead')}</p>
      {!prefs.stored && (
        <p className="prefs__warning" role="status">
          {s('prefs.notStored')}
        </p>
      )}

      <fieldset className="prefs__group">
        <legend className="prefs__legend">{s('prefs.theme')}</legend>
        <div className="prefs__choices" role="group">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              className="prefs__choice"
              aria-pressed={prefs.theme === theme}
              onClick={() => prefs.set('theme', theme)}
            >
              {s(THEME_KEYS[theme])}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="prefs__group">
        <legend className="prefs__legend">{s('prefs.language')}</legend>
        <div className="prefs__choices" role="group">
          {LANGS.map((lang: Lang) => (
            <button
              key={lang}
              type="button"
              className="prefs__choice"
              aria-pressed={prefs.lang === lang}
              onClick={() => prefs.set('lang', lang)}
            >
              {lang}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="prefs__group">
        <legend className="prefs__legend">{s('prefs.behaviour')}</legend>
        <Toggle
          label={s('prefs.speakAnswers')}
          on={prefs.speakAnswers}
          onChange={(v) => prefs.set('speakAnswers', v)}
        />
        <Toggle
          label={s('prefs.reasoningOpen')}
          on={prefs.reasoningOpen}
          onChange={(v) => prefs.set('reasoningOpen', v)}
        />
        <Toggle
          label={s('prefs.activityOpen')}
          on={prefs.activityOpen}
          onChange={(v) => prefs.set('activityOpen', v)}
        />
      </fieldset>
    </section>
  )
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="prefs__toggle">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
