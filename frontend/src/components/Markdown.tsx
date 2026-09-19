/**
 * Streaming markdown that does not re-parse the whole answer on every token (AC8).
 *
 * `splitBlocks` divides the text into blocks that can no longer change plus a live tail. Each
 * settled block is a memoised component whose `text` prop is byte-identical between renders, so
 * React skips it and only the tail is parsed again as tokens land.
 *
 * Spec 033 added two fences. **The fence is the only signal** — it is found by `react-markdown`'s
 * own parser, and nothing here looks at the answer text to decide whether something should be a
 * chart. That is the whole of §8 for this feature: swap the harness and the same text draws the
 * same picture. An unclosed fence is not a code block yet as far as the parser is concerned, so
 * "draw nothing until it closes" costs no code at all (AC3).
 */
import { createContext, memo, useContext, useMemo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { Chart } from './Chart'
import { Diagram } from './Diagram'
import { useT } from '../i18n/context'
import type { StringKey } from '../i18n/strings'
import { parseChart, type ChartFailure } from '../state/chart'
import { splitBlocks } from '../state/markdown'

/**
 * Whether the block being rendered ends inside a fence that never closed.
 *
 * **`react-markdown` cannot tell us this.** CommonMark says an unclosed fence runs to the end of
 * the document, so a half-arrived block parses into exactly the same `<pre><code
 * class="language-…">` as a finished one — verified, not assumed. Without this the app would draw
 * a chart from a truncated block the moment the JSON happened to be parseable, which is the flash
 * AC3 forbids, and would call a stopped turn's unfinished answer a failure.
 */
const OpenFence = createContext(false)

/** The fence this repository owns. Namespaced: the schema exists only here (spec 033). */
const CHART_FENCE = 'language-foundry-chart'
const DIAGRAM_FENCE = 'language-mermaid'

/**
 * Is this fence ours?
 *
 * Matched against the class LIST, not the whole string: `rehype-highlight` adds its own classes
 * beside `language-*`, so an equality check silently stops matching the day a highlighter decides
 * it recognises the language.
 */
function isFence(className: string | undefined, fence: string): boolean {
  return (className ?? '').split(/\s+/).includes(fence)
}

function Code({ className, children, ...rest }: React.ComponentProps<'code'>) {
  const s = useT()
  const source = String(children ?? '')
  const open = useContext(OpenFence)

  // Still arriving: render what it is, a code block in progress, and draw nothing (AC3).
  if (open) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    )
  }

  if (isFence(className, CHART_FENCE)) {
    const result = parseChart(source)
    if (result.ok) return <Chart spec={result.spec} />

    // The block stays visible and copyable. A reader whose chart did not draw is debugging their
    // agent's instructions, and hiding what it wrote would make the failure unteachable.
    return (
      <>
        <code className={className} {...rest}>
          {children}
        </code>
        <span className="chart__failed" role="note">
          {`${s('chart.couldNotDraw')} — ${s(reasonKey(result.reason))}`}
        </span>
      </>
    )
  }

  if (isFence(className, DIAGRAM_FENCE)) return <Diagram source={source} />

  return (
    <code className={className} {...rest}>
      {children}
    </code>
  )
}

function reasonKey(reason: ChartFailure): StringKey {
  return `chart.reason.${reason}` as StringKey
}

const COMPONENTS: Components = { code: Code }

const Block = memo(function Block({ text, open }: { text: string; open: boolean }) {
  return (
    <OpenFence.Provider value={open}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </OpenFence.Provider>
  )
})

/** An odd number of fence markers means the last one never closed. */
function endsInsideAFence(text: string): boolean {
  return (text.match(/^\s*```/gm) ?? []).length % 2 === 1
}

export function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => splitBlocks(text), [text])
  // Only the final block can be mid-fence: `splitBlocks` does not split inside one, so everything
  // before it is settled by construction.
  const open = useMemo(() => endsInsideAFence(text), [text])

  return (
    <div className="markdown">
      {blocks.map((block, i) => (
        <Block key={i} text={block} open={open && i === blocks.length - 1} />
      ))}
    </div>
  )
}
