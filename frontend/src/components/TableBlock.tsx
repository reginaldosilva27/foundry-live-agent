/**
 * A table you can take, and that does not push the page sideways (spec 035).
 *
 * Two jobs. The wrapper scrolls **itself** when the table is wider than the conversation column,
 * so the column never scrolls horizontally at any width. And the copy control offers the table as
 * tab-separated text, which a spreadsheet pastes straight into cells.
 *
 * **The TSV is read from the rendered DOM**, not from the Markdown source. The acceptance criterion
 * is about the table the reader is looking at; walking React children would re-derive it and could
 * disagree with what `remark-gfm` produced.
 *
 * There is deliberately no second control offering Markdown: the answer actions already copy
 * `turn.text`, which is the model's own table verbatim (§4).
 */
import { useRef } from 'react'
import { CopyIcon } from './Icon'
import { useCopy } from '../hooks/useCopy'
import { useT } from '../i18n/context'
import { toTsv } from '../state/tsv'

export function TableBlock({
  controls,
  children,
}: {
  controls: boolean
  children: React.ReactNode
}) {
  const s = useT()
  const { state, copy } = useCopy()
  const host = useRef<HTMLDivElement>(null)

  return (
    <figure className="table-block" data-testid="table-block">
      {controls && (
        <figcaption className="table-block__head">
          {state !== 'idle' && (
            <span role="status" className="table-block__state">
              {s(state === 'copied' ? 'copy.copied' : 'copy.failed')}
            </span>
          )}
          <button
            type="button"
            className="table-block__copy"
            title={s('table.copy')}
            aria-label={s('table.copy')}
            onClick={() => copy(toTsv(readRows(host.current)))}
          >
            <CopyIcon size={14} />
          </button>
        </figcaption>
      )}
      {/* Scrolls itself. The conversation column never scrolls sideways (AC7). */}
      <div className="table-block__scroll" ref={host}>
        {children}
      </div>
    </figure>
  )
}

/** The rendered rows and columns, in document order. */
function readRows(host: HTMLElement | null): string[][] {
  if (!host) return []
  return [...host.querySelectorAll('tr')].map((row) =>
    [...row.querySelectorAll('th, td')].map((cell) => cell.textContent ?? ''),
  )
}
