/**
 * What the answer consulted (spec 034).
 *
 * The agent cites in prose, as bare links. This is the same evidence, taken from the **events**
 * rather than from the sentence, and put where the claim is instead of two clicks away in the
 * trace panel.
 *
 * Three things it deliberately does not do. It fetches nothing — no titles, no favicons, no
 * previews, because this browser talks to the BFF and nothing else. It says nothing about which
 * source supports which sentence: we know what was consulted, not what was used, and the wording
 * has to stay on the right side of that. And it renders only once the turn has settled, so a list
 * never reflows under text somebody is reading.
 */
import { useT } from '../i18n/context'
import type { Source } from '../state/sources'

interface Props {
  sources: Source[]
  /** Opens the producing call in the trace reader — the same address `ToolRow` uses (§4). */
  onOpenCall: (callKey: string) => void
}

export function Sources({ sources, onOpenCall }: Props) {
  const s = useT()
  // No strip, not an empty one, and no heading over nothing (AC4).
  if (sources.length === 0) return null

  return (
    <section className="sources" data-testid="sources">
      <h4 className="sources__title">{s('sources.title')}</h4>
      <ul className="sources__list">
        {/* Keyed on `id`, not `callKey:label`: two sources can share a label and still be two
            sources, and a duplicate key lets React drop one of them with nothing but a console
            warning to say so. `sourcesOf` already decides what makes two sources the same one. */}
        {sources.map((source) => (
          <li key={source.id} className="sources__item">
            <button
              type="button"
              className="sources__open"
              title={s('sources.openCall')}
              onClick={() => onOpenCall(source.callKey)}
            >
              {source.failed ? s('sources.failed') : source.label}
            </button>
            <span className="sources__from">
              {s('sources.from').replace(
                '{tool}',
                source.kind === 'passage' ? s('sources.knowledgeBase') : source.from,
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
