/**
 * "This is a recording" — said once, on every screen, permanently (spec 050, AC5).
 *
 * **There is no dismiss control, and that is the feature.** A banner a reader can close is a banner
 * that is missing from the screenshot they post, and the single thing this build must never do is
 * let a recorded answer pass for a live one. A test asserts the absence rather than trusting the
 * markup.
 *
 * It also states the fact a reader would otherwise find out by typing twice: the answer does not
 * depend on the question (AC7). A recording has one answer; saying so up front is cheaper than
 * letting somebody conclude the agent is broken.
 *
 * The picker names each recording from `strings.ts`. The BFF sends **codes** — what a recording
 * demonstrates is prose, and prose ships in both languages or not at all (§7). A code this build
 * has no sentence for renders as itself: a BFF ahead of the frontend is the normal direction of
 * drift, and an invented description of a recording nobody here has seen would be worse than a
 * bare id (§5).
 */
import { useLang, useT } from '../i18n/context'
import { t, type StringKey } from '../i18n/strings'
import type { DemoState } from '../state/demo'

interface Props {
  demo: DemoState
}

export function DemoBanner({ demo }: Props) {
  const s = useT()
  const lang = useLang()

  return (
    <aside className="demo-banner" data-testid="demo-banner" aria-label={s('demo.title')}>
      <span className="demo-banner__tag">{s('demo.title')}</span>
      <p className="demo-banner__body">{s('demo.body').replace('{date}', demo.recordedAt)}</p>

      <label className="demo-banner__pick">
        <span className="demo-banner__pick-label">{s('demo.pick')}</span>
        <select
          className="demo-banner__select"
          value={demo.current}
          onChange={(event) => demo.choose(event.target.value)}
        >
          {demo.recordings.map((recording) => (
            <option key={recording.id} value={recording.id}>
              {label(recording.id, lang)}
            </option>
          ))}
        </select>
      </label>
    </aside>
  )
}

/** What a recording demonstrates, or its bare id when this build has no sentence for it. */
function label(id: string, lang: Parameters<typeof t>[1]): string {
  const key = `demo.recording.${id}` as StringKey
  try {
    return t(key, lang)
  } catch {
    return id
  }
}
