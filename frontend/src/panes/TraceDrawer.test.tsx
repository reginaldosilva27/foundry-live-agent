/** Spec 009 AC3, AC5, AC6 — the payload lives here now. */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TraceDrawer } from './TraceDrawer'
import { emptyTurn, type Activity, type Turn } from '../state/turn'

const turn: Turn = {
  ...emptyTurn(),
  status: 'done',
  trace: { responseId: 'resp_1', conversationId: 'conv_1' },
  activities: [
    {
      kind: 'mcp',
      serverLabel: 'microsoft_learn',
      name: 'microsoft_docs_search',
      arguments: '{"query":"hosted agent"}',
      status: 'ok',
      output: 'a page of documentation',
    },
    {
      kind: 'tool',
      executor: 'app',
      callId: 'call_1',
      name: 'get_current_datetime',
      arguments: '{"timezone":"America/Sao_Paulo"}',
      status: 'failed',
      error: 'tool_failed: no such timezone',
      durationMs: 2,
    },
  ],
}

describe('the trace panel', () => {
  it('lists the turn\'s calls as rows, with no payload in the column (spec 010, AC1)', () => {
    // 320px of dark column is the wrong shape for a page of JSON. The list is for scanning; the
    // reader is for reading.
    render(<TraceDrawer turn={turn} open onClose={() => {}} />)

    const activity = screen.getByTestId('trace-activity')
    expect(within(activity).getAllByTestId('tool-row')).toHaveLength(2)
    expect(activity.textContent).not.toContain('hosted agent')
    expect(activity.textContent).not.toContain('a page of documentation')
    expect(activity.textContent).not.toContain('no such timezone')
  })

  it('opens a call in the reader when its row is pressed (spec 010, AC2)', () => {
    const onOpenCall = vi.fn()
    render(<TraceDrawer turn={turn} open onOpenCall={onOpenCall} onClose={() => {}} />)

    within(screen.getByTestId('trace-activity')).getAllByTestId('tool-row')[1].click()

    expect(onOpenCall).toHaveBeenCalledWith('call_1')
  })

  it('says a turn called nothing rather than drawing an empty box (AC6)', () => {
    render(
      <TraceDrawer
        turn={{ ...turn, activities: [] }}
        open
        onClose={() => {}}
      />,
    )

    expect(screen.getByTestId('trace-activity')).toHaveTextContent(/called no tools|nenhuma ferramenta/i)
    expect(screen.queryByTestId('tool-row')).toBeNull()
  })

  it('still reports the identifiers the run produced', () => {
    render(<TraceDrawer turn={turn} open onClose={() => {}} />)

    expect(screen.getByTestId('trace-panel')).toHaveTextContent('resp_1')
    expect(screen.getByTestId('trace-panel')).toHaveTextContent('conv_1')
  })
})

/** Spec 014 — the panel says which run it is showing, what it cost, and how to take it with you. */
describe('the trace panel as an instrument', () => {
  const settled: Turn = {
    ...turn,
    usage: { inputTokens: 120, outputTokens: 34, reasoningTokens: 64 },
  }

  it('shows the run numbers beside the ids (AC2)', () => {
    render(
      <TraceDrawer
        turn={settled}
        open
        model="gpt-5.5"
        latencyMs={2400}
        position={{ index: 0, total: 1 }}
        onClose={() => {}}
      />,
    )

    const numbers = screen.getByTestId('trace-numbers')
    expect(numbers).toHaveTextContent('gpt-5.5')
    expect(numbers).toHaveTextContent('154')
    expect(numbers).toHaveTextContent('2.4 s')
  })

  it('states which turn of the session it is showing (AC4)', () => {
    render(
      <TraceDrawer
        turn={settled}
        open
        position={{ index: 1, total: 4 }}
        onClose={() => {}}
      />,
    )

    // Position is 1-based on screen; the prop is an index.
    expect(screen.getByTestId('trace-position')).toHaveTextContent(/2.*4/)
  })

  it('moves between turns without closing (AC4)', () => {
    const onStep = vi.fn()
    render(
      <TraceDrawer
        turn={settled}
        open
        position={{ index: 1, total: 4 }}
        onStep={onStep}
        onClose={() => {}}
      />,
    )

    screen.getByRole('button', { name: /previous turn|turno anterior/i }).click()
    expect(onStep).toHaveBeenCalledWith(-1)

    screen.getByRole('button', { name: /next turn|próximo turno/i }).click()
    expect(onStep).toHaveBeenCalledWith(1)
  })

  it('disables the arrow that would walk off the end of the session (AC5)', () => {
    const { rerender } = render(
      <TraceDrawer turn={settled} open position={{ index: 0, total: 3 }} onClose={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /previous turn|turno anterior/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next turn|próximo turno/i })).toBeEnabled()

    rerender(
      <TraceDrawer turn={settled} open position={{ index: 2, total: 3 }} onClose={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /previous turn|turno anterior/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /next turn|próximo turno/i })).toBeDisabled()
  })

  it('names the ids reserved for the tracing spec rather than dropping them (AC8)', () => {
    render(<TraceDrawer turn={settled} open position={{ index: 0, total: 1 }} onClose={() => {}} />)

    const panel = screen.getByTestId('trace-panel')
    expect(panel).toHaveTextContent(/otel trace id/i)
    expect(panel).toHaveTextContent(/gateway request id/i)
    expect(panel).toHaveTextContent(/arrives with the tracing spec|chega com a spec de tracing/i)
  })

  it('renders a reserved id as an ordinary one once a harness emits it (AC8)', () => {
    const traced: Turn = {
      ...settled,
      trace: { ...settled.trace!, otelTraceId: '4bf92f3577b34da6a3ce929d0e0e4736' },
    }
    render(<TraceDrawer turn={traced} open position={{ index: 0, total: 1 }} onClose={() => {}} />)

    expect(screen.getByTestId('trace-panel')).toHaveTextContent('4bf92f3577b34da6a3ce929d0e0e4736')
  })

  it('scales the duration bars against the longest call in the turn (AC6)', () => {
    const measure = (callId: string, durationMs: number): Activity => ({
      kind: 'tool',
      executor: 'app',
      callId,
      name: 'get_current_datetime',
      arguments: '{}',
      status: 'ok',
      durationMs,
    })
    const measured: Turn = { ...settled, activities: [measure('a', 100), measure('b', 25)] }
    render(<TraceDrawer turn={measured} open position={{ index: 0, total: 1 }} onClose={() => {}} />)

    const bars = screen.getAllByTestId('tool-bar')
    expect(bars[0]).toHaveStyle({ '--bar': '100%' })
    expect(bars[1]).toHaveStyle({ '--bar': '25%' })
  })

  it('replaces the empty Spans section with one line saying where spans come from', () => {
    render(<TraceDrawer turn={settled} open position={{ index: 0, total: 1 }} onClose={() => {}} />)

    expect(screen.getByTestId('trace-panel')).toHaveTextContent(
      /Application Insights/i,
    )
    expect(screen.queryByRole('heading', { name: /^spans$/i })).toBeNull()
  })
})
