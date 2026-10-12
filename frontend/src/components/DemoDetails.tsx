/** Replay explanation and catalogue, disclosed beside a permanent Replay label (spec 059).
 * Unknown recording codes remain verbatim rather than acquiring an invented description. */
import { useLang, useT } from '../i18n/context'
import { t, type StringKey } from '../i18n/strings'
import type { DemoState } from '../state/demo'

interface Props {
  demo: DemoState
}

export function DemoDetails({ demo }: Props) {
  const s = useT()
  const lang = useLang()

  return (
    <section className="demo-details" aria-label={s('demo.title')}>
      <p className="demo-details__body">{s('demo.body').replace('{date}', demo.recordedAt)}</p>

      <label className="demo-details__pick">
        <span className="demo-details__pick-label">{s('demo.pick')}</span>
        <select
          className="demo-details__select"
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
    </section>
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
