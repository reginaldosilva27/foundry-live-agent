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
import { createContext, isValidElement, memo, useContext, useMemo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { AnswerImage } from './AnswerImage'
import { Chart } from './Chart'
import { CodeBlock } from './CodeBlock'
import { languageOf } from './language'
import { TableBlock } from './TableBlock'
import { Diagram } from './Diagram'
import { useT } from '../i18n/context'
import type { StringKey } from '../i18n/strings'
import { parseChart, type ChartFailure } from '../state/chart'
import { splitBlocks } from '../state/markdown'

/**
 * What the blocks need to know about the turn around them.
 *
 * `openFence` — whether this block ends inside a fence that never closed.
 *
 * **`react-markdown` cannot tell us this.** CommonMark says an unclosed fence runs to the end of
 * the document, so a half-arrived block parses into exactly the same `<pre><code
 * class="language-…">` as a finished one — verified, not assumed. Without this the app would draw
 * a chart from a truncated block the moment the JSON happened to be parseable, which is the flash
 * spec 033's AC3 forbids, and would call a stopped turn's unfinished answer a failure.
 *
 * `settled` — whether the TURN has finished (spec 035). The copy controls key off this rather than
 * off the fence: a fence that closed while the answer keeps arriving is complete, but a control
 * appearing mid-paragraph moves the text under the reader.
 */
const BlockContext = createContext({ openFence: false, settled: false })

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
  const { openFence: open } = useContext(BlockContext)

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

/**
 * The wrapper around a code block (spec 035).
 *
 * `pre` rather than `code`, because `<pre>` may contain phrasing content only and the header has
 * to sit outside it. A chart or a diagram never reaches here: the `code` override returns its own
 * element first, so `pre` receives a child that is not a `<code>` and passes it straight through.
 */
function Pre({ children }: React.ComponentProps<'pre'>) {
  const { settled } = useContext(BlockContext)
  const className = childClassName(children)

  // A chart or a diagram was already turned into its own element by the `code` override, and
  // `react-markdown` still wraps it in a `pre`. Wrapping it again would put a "copy this code"
  // header over a drawn chart.
  if (isFence(className, CHART_FENCE) || isFence(className, DIAGRAM_FENCE)) return <>{children}</>

  return (
    <CodeBlock language={languageOf(className)} controls={settled}>
      {children}
    </CodeBlock>
  )
}

/**
 * The `className` of the block inside this `pre`.
 *
 * Read from the child's **props**, not from its type: by the time `pre` renders, its child is an
 * element of the `code` override above, so `node.type` is that function rather than the string
 * `'code'`. The className is what survives, and it is what carries the fence language.
 */
function childClassName(children: React.ReactNode): string | undefined {
  const child = Array.isArray(children) ? children[0] : children
  if (!isValidElement<{ className?: string }>(child)) return undefined
  return child.props.className
}

function Table({ children }: React.ComponentProps<'table'>) {
  const { settled } = useContext(BlockContext)
  return (
    <TableBlock controls={settled}>
      <table>{children}</table>
    </TableBlock>
  )
}

const COMPONENTS: Components = { code: Code, pre: Pre, table: Table, img: AnswerImage }

const Block = memo(function Block({
  text,
  open,
  settled,
}: {
  text: string
  open: boolean
  settled: boolean
}) {
  const value = useMemo(() => ({ openFence: open, settled }), [open, settled])
  return (
    <BlockContext.Provider value={value}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </BlockContext.Provider>
  )
})

/** An odd number of fence markers means the last one never closed. */
function endsInsideAFence(text: string): boolean {
  return (text.match(/^\s*```/gm) ?? []).length % 2 === 1
}

export function Markdown({ text, settled = false }: { text: string; settled?: boolean }) {
  const blocks = useMemo(() => splitBlocks(text), [text])
  // Only the final block can be mid-fence: `splitBlocks` does not split inside one, so everything
  // before it is settled by construction.
  const open = useMemo(() => endsInsideAFence(text), [text])

  return (
    <div className="markdown">
      {blocks.map((block, i) => (
        <Block
          key={i}
          text={block}
          open={open && i === blocks.length - 1}
          settled={settled}
        />
      ))}
    </div>
  )
}
