/**
 * Streaming markdown that does not re-parse the whole answer on every token (AC8).
 *
 * `splitBlocks` divides the text into blocks that can no longer change plus a live tail. Each
 * settled block is a memoised component whose `text` prop is byte-identical between renders, so
 * React skips it and only the tail is parsed again as tokens land.
 */
import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { splitBlocks } from '../state/markdown'

const Block = memo(function Block({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
      {text}
    </ReactMarkdown>
  )
})

export function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => splitBlocks(text), [text])
  return (
    <div className="markdown">
      {blocks.map((block, i) => (
        <Block key={i} text={block} />
      ))}
    </div>
  )
}
