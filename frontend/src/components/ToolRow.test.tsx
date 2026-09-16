/** Spec 009 AC1, AC2, AC5 — the chat's one-line rendering of a call. */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolRow } from './ToolRow'
import type { Activity } from '../state/turn'

const appCall: Activity = {
  kind: 'tool',
  step: 1,
  executor: 'app',
  callId: 'call_1',
  name: 'get_current_datetime',
  arguments: '{"timezone":"America/Sao_Paulo"}',
  status: 'ok',
  output: '{"iso":"2026-09-15T13:53:00-03:00"}',
  durationMs: 3,
}

const mcpCall: Activity = {
  kind: 'mcp',
  step: 2,
  serverLabel: 'microsoft_learn',
  name: 'microsoft_docs_search',
  arguments: '{"query":"hosted agent"}',
  status: 'ok',
  output: 'a page of documentation, several hundred lines long',
}

describe('the chat row for a call', () => {
  it('says what ran, who ran it and that it worked (AC2)', () => {
    render(<ToolRow activity={appCall} onOpen={() => {}} />)

    const row = screen.getByTestId('tool-row')
    expect(row).toHaveTextContent('get_current_datetime')
    expect(row).toHaveAttribute('data-executor', 'app')
    expect(row).toHaveAttribute('data-status', 'ok')
    expect(screen.getByTestId('executor-tag')).toHaveTextContent('bff')
    expect(row).toHaveTextContent('3 ms')
  })

  it('attributes an MCP call to its server, not to us', () => {
    render(<ToolRow activity={mcpCall} onOpen={() => {}} />)

    expect(screen.getByTestId('tool-row')).toHaveAttribute('data-executor', 'foundry')
    expect(screen.getByTestId('executor-tag')).toHaveTextContent('microsoft_learn')
  })

  it('keeps the payload out of the chat (AC1)', () => {
    // The whole point: a documentation page used to land between the question and the answer.
    render(<ToolRow activity={mcpCall} onOpen={() => {}} />)

    const row = screen.getByTestId('tool-row')
    expect(row.textContent).not.toContain('query')
    expect(row.textContent).not.toContain('several hundred lines long')
  })

  it('reads as failed when the call failed (AC5)', () => {
    render(
      <ToolRow
        activity={{ ...appCall, status: 'failed', error: 'tool_failed: no such timezone' }}
        onOpen={() => {}}
      />,
    )

    const row = screen.getByTestId('tool-row')
    expect(row).toHaveAttribute('data-status', 'failed')
    // The reason belongs in the trace panel, not next to the prose.
    expect(row.textContent).not.toContain('no such timezone')
  })

  it('opens the call in the trace panel when pressed (AC4)', async () => {
    const onOpen = vi.fn()
    render(<ToolRow activity={appCall} onOpen={onOpen} />)

    screen.getByTestId('tool-row').click()

    expect(onOpen).toHaveBeenCalledOnce()
  })
})

/**
 * Spec 014 AC6, AC7, AC12 — duration as magnitude.
 *
 * The bar is the spec's most §5-sensitive element, so what it must *not* do is tested as hard as
 * what it must: no bar without a measured duration, and no bar that implies a position on a clock.
 * Its length is a ratio the caller computed from durations the events carried, and nothing else.
 */
describe('the duration bar', () => {
  it('gives the longest call in a turn a full-width bar (AC6)', () => {
    render(<ToolRow activity={appCall} durationRatio={1} onOpen={() => {}} />)

    expect(screen.getByTestId('tool-bar')).toHaveStyle({ '--bar': '100%' })
  })

  it('scales a shorter call against it (AC6)', () => {
    render(<ToolRow activity={appCall} durationRatio={0.25} onOpen={() => {}} />)

    expect(screen.getByTestId('tool-bar')).toHaveStyle({ '--bar': '25%' })
  })

  it('draws no bar for a call that carries no duration, and says why (AC7)', () => {
    render(<ToolRow activity={mcpCall} onOpen={() => {}} />)

    expect(screen.queryByTestId('tool-bar')).toBeNull()
    expect(screen.getByTestId('tool-row')).toHaveTextContent(
      /carries no duration|não carrega duração/i,
    )
  })

  it('draws no bar when no ratio was given, even for a call that has a duration (AC12)', () => {
    // The chat renders rows without ratios in the voice overlay, where there is no turn to
    // compare against. A bar there would be a comparison with nothing.
    render(<ToolRow activity={appCall} />)

    expect(screen.queryByTestId('tool-bar')).toBeNull()
  })
})

/** Spec 005 AC17 — the duration an MCP call never had in the event stream. */
describe('a duration that came from a span', () => {
  it('shows it instead of saying the call carries none', () => {
    render(<ToolRow activity={mcpCall} spanDurationMs={106.2} onOpen={() => {}} />)

    expect(screen.getByTestId('tool-row')).toHaveTextContent('106 ms')
    expect(screen.getByTestId('tool-row')).not.toHaveTextContent(
      /carries no duration|não carrega duração/i,
    )
  })

  it('still says so when no span was found for it', () => {
    render(<ToolRow activity={mcpCall} onOpen={() => {}} />)

    expect(screen.getByTestId('tool-row')).toHaveTextContent(
      /carries no duration|não carrega duração/i,
    )
  })
})

/** Spec 015 — the row says what the call asked for, and where it sits in the turn. */
describe('what the call asked for (spec 015)', () => {
  it('shows the argument that distinguishes this call (AC1)', () => {
    render(<ToolRow activity={mcpCall} onOpen={() => {}} />)

    expect(screen.getByTestId('tool-row')).toHaveTextContent('hosted agent')
  })

  it('tells two calls to the same tool apart (AC2)', () => {
    // The turn that prompted this spec: seven `lookup_knowledge` rows, identical on screen.
    const search = (query: string): Activity => ({
      ...appCall,
      name: 'lookup_knowledge',
      arguments: JSON.stringify({ query }),
    })
    render(
      <>
        <ToolRow activity={search('the BFF')} onOpen={() => {}} />
        <ToolRow activity={search('the harness contract')} onOpen={() => {}} />
      </>,
    )

    const [first, second] = screen.getAllByTestId('tool-row')
    expect(first).toHaveTextContent('the BFF')
    expect(second).toHaveTextContent('the harness contract')
    expect(first.textContent).not.toBe(second.textContent)
  })

  it('still renders a row when the arguments say nothing usable (AC3)', () => {
    for (const args of ['', '{}', '{"query": "par', 'not json']) {
      const { unmount } = render(<ToolRow activity={{ ...appCall, arguments: args }} />)
      expect(screen.getByTestId('tool-row')).toHaveTextContent('get_current_datetime')
      expect(screen.queryByTestId('tool-subject')).toBeNull()
      unmount()
    }
  })

  it('carries its ordinal when the turn made more than one call (AC5)', () => {
    render(<ToolRow activity={{ ...appCall, step: 3 }} showStep onOpen={() => {}} />)

    expect(screen.getByTestId('tool-step')).toHaveTextContent('3')
  })

  it('has no ordinal to give when the turn made a single call (AC6)', () => {
    render(<ToolRow activity={appCall} onOpen={() => {}} />)

    expect(screen.queryByTestId('tool-step')).toBeNull()
  })
})
