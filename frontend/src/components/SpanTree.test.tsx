/**
 * Spec 005 AC2, AC13 — the waterfall, and the gap in it.
 *
 * The spans are the real ones from `resp_085addd5…`, a run whose seven `lookup_knowledge` calls the
 * BFF executed: the model call starts 4710 ms into an 8865 ms run and Foundry has no span for what
 * happened in between. That gap is the §8 boundary, and a reader who is not told will read it as
 * lost data — which is why AC13 exists and is tested here rather than left to a comment.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SpanTree } from './SpanTree'
import type { Span } from '../types/trace'

const recorded: Span[] = [
  {
    name: 'invoke_agent foundry-live-agent:3',
    span_id: '9b7e0a4b3eb67983',
    parent_id: 'outside-the-store',
    duration_ms: 8865,
    start_ms: 0,
    kind: 'agent',
  },
  {
    name: 'chat gpt-5.5-2026-04-24',
    span_id: '169c0f2064271243',
    parent_id: '9b7e0a4b3eb67983',
    duration_ms: 4021.5,
    start_ms: 4710,
    kind: 'model',
  },
]

const withMcp: Span[] = [
  { ...recorded[0], duration_ms: 7316.5 },
  {
    name: 'mcp_microsoft_learn.microsoft_docs_search',
    span_id: '6cb21d93066e16e1',
    parent_id: '9b7e0a4b3eb67983',
    duration_ms: 106.2,
    start_ms: 120,
    kind: 'tool',
  },
]

describe('the span waterfall', () => {
  it('places each bar on a shared axis by its start offset (AC2)', () => {
    render(<SpanTree spans={recorded} />)

    const bars = screen.getAllByTestId('span-bar')
    // The run starts the axis; the model call begins 4710/8865 of the way in and runs 4021/8865.
    expect(bars[0]).toHaveStyle({ '--start': '0%', '--width': '100%' })
    expect(bars[1]).toHaveStyle({ '--start': '53.13%' })
  })

  it('nests a span under the parent it names (AC2)', () => {
    render(<SpanTree spans={recorded} />)

    const rows = screen.getAllByTestId('span-row')
    expect(rows[0]).toHaveAttribute('data-depth', '0')
    expect(rows[1]).toHaveAttribute('data-depth', '1')
  })

  it('roots the tree at the span whose parent is not in the store (AC2)', () => {
    // `invoke_agent`'s parent is a span Foundry does not expose. Treating that as a missing
    // parent rather than as a broken tree is what keeps the root visible.
    render(<SpanTree spans={recorded} />)

    expect(screen.getAllByTestId('span-row')).toHaveLength(2)
  })

  it('says Foundry traces only what Foundry runs (AC13)', () => {
    render(<SpanTree spans={recorded} />)

    expect(screen.getByTestId('span-tree')).toHaveTextContent(
      /Foundry traces what Foundry runs|O Foundry rastreia o que o Foundry executa/i,
    )
  })

  it('shows a Foundry-side tool call as a span of its own', () => {
    render(<SpanTree spans={withMcp} />)

    expect(screen.getByText(/mcp_microsoft_learn/)).toBeInTheDocument()
  })

  it('renders nothing rather than an empty frame when there are no spans', () => {
    const { container } = render(<SpanTree spans={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
