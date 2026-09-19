/**
 * A code block you can take (spec 035).
 *
 * Wraps what `react-markdown` would have rendered with a header naming the language and a copy
 * control. **`pre` is the override, not `code`**, because the wrapper has to sit outside the block
 * and `<pre>` may contain phrasing content only — a `<div>` inside it is invalid HTML.
 *
 * The control uses `useCopy`, so "copied" means the same thing here as in the answer actions and
 * the trace panel: one clipboard behaviour, decided in one place (§4).
 *
 * No download, no run, no edit. Executing what a model wrote is not something this app does.
 */
import { useRef } from 'react'
import { CopyIcon } from './Icon'
import { useCopy } from '../hooks/useCopy'
import { useT } from '../i18n/context'

export function CodeBlock({
  language,
  controls,
  children,
}: {
  language: string
  /** Whether the turn has settled. A block still arriving has nothing complete to take (AC8). */
  controls: boolean
  children: React.ReactNode
}) {
  const s = useT()
  const { state, copy } = useCopy()
  const host = useRef<HTMLPreElement>(null)

  return (
    <figure className="code-block" data-testid="code-block">
      {(language || controls) && (
        <figcaption className="code-block__head">
          {/* Nothing rather than a guess: an undetected language is a fact about the block. */}
          <span className="code-block__lang">{language}</span>
          {controls && (
            <span className="code-block__actions">
              {state !== 'idle' && (
                <span role="status" className="code-block__state">
                  {s(state === 'copied' ? 'copy.copied' : 'copy.failed')}
                </span>
              )}
              <button
                type="button"
                className="code-block__copy"
                title={s('code.copy')}
                aria-label={s('code.copy')}
                // Exactly the block's text: no language line, no surrounding whitespace (AC3).
                onClick={() => copy(host.current?.textContent?.replace(/\n$/, '') ?? '')}
              >
                <CopyIcon size={14} />
              </button>
            </span>
          )}
        </figcaption>
      )}
      <pre ref={host}>{children}</pre>
    </figure>
  )
}
