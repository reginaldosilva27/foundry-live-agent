/**
 * A mermaid diagram the agent wrote (spec 033).
 *
 * **Mermaid is fetched only when a diagram appears.** It is roughly 500 kB gzipped against a bundle
 * that is 192 kB, so the import is dynamic and Vite emits it as its own chunk — a reader who never
 * sees a diagram never downloads it. A static `import mermaid from 'mermaid'` anywhere in `src/`
 * would undo that silently, so a test forbids one (AC14).
 *
 * **The source came from a model, and mermaid draws what it is given.** It runs at mermaid's
 * default `securityLevel: 'strict'` — no HTML in labels, no click handlers — and what lands in the
 * DOM is the SVG mermaid returned from parsing, not arbitrary markup echoed through. Worth saying
 * plainly, because "render what the model wrote" is the shape of a real problem in a less careful
 * feature.
 *
 * Until it resolves, and if it throws, the block renders as what it is: a code block. That is the
 * same state an unclosed fence produces (AC3), so there is one fallback and not two.
 */
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/context'

let sequence = 0

export function Diagram({ source }: { source: string }) {
  const s = useT()
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    const id = `fla-diagram-${(sequence += 1)}`

    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
        const { svg } = await mermaid.render(id, source)
        if (!live || !host.current) return
        host.current.innerHTML = svg
      } catch {
        // A diagram the agent wrote badly is a normal state, not an app failure (§5). The source
        // stays on screen either way, which is what makes it debuggable.
        if (live) setFailed(true)
      }
    })()

    return () => {
      live = false
    }
  }, [source])

  return (
    <figure className="diagram" data-testid="diagram">
      <div ref={host} className="diagram__host" role="img" aria-label={s('diagram.described')} />
      {failed && <p className="chart__failed">{s('diagram.couldNotDraw')}</p>}
    </figure>
  )
}
