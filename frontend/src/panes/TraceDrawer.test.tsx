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
      step: 1,
      serverLabel: 'microsoft_learn',
      name: 'microsoft_docs_search',
      arguments: '{"query":"hosted agent"}',
      status: 'ok',
      output: 'a page of documentation',
    },
    {
      kind: 'tool',
      step: 2,
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
    expect(activity.textContent).not.toContain('a page of documentation')
    expect(activity.textContent).not.toContain('no such timezone')
    // What a call asked for is one short value and belongs on the row; what it answered is a page
    // and belongs in the reader (spec 015 narrowing spec 010 AC1).
    expect(activity.textContent).toContain('hosted agent')
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

  
  it('scales the duration bars against the longest call in the turn (AC6)', () => {
    const measure = (callId: string, durationMs: number): Activity => ({
      kind: 'tool',
      step: 1,
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

  it('gives Spans a real section again, now that there are spans (supersedes spec 014)', () => {
    // Spec 014 turned the empty "Spans" heading into a footnote, because the section's only
    // content was its own absence. Spec 005 gave it content, so the heading comes back — and the
    // footnote that said spans "come from Application Insights, which the tracing spec adds" is
    // gone, because the tracing spec added them.
    render(<TraceDrawer turn={settled} open position={{ index: 0, total: 1 }} onClose={() => {}} />)

    const panel = screen.getByTestId('trace-panel')
    expect(panel).not.toHaveTextContent(/which the tracing spec adds|que a spec de tracing adiciona/i)
    expect(screen.getByTestId('trace-spans-state')).toBeInTheDocument()
  })
})

/** Spec 005 — the trace id is real, the gateway states, and each status says its own thing. */
describe('the panel with a trace', () => {
  const settled: Turn = {
    ...turn,
    usage: { inputTokens: 120, outputTokens: 34, reasoningTokens: 64 },
  }
  const position = { index: 0, total: 1 }

  it('renders the otel trace id as an ordinary copyable id (AC6\u2032)', () => {
    render(
      <TraceDrawer
        turn={settled}
        open
        position={position}
        trace={{ status: 'ok', spans: [], otel_trace_id: 'b3802f27f525fbe79b1b8cac00c25450' }}
        onClose={() => {}}
      />,
    )

    expect(screen.getByTestId('trace-panel')).toHaveTextContent('b3802f27f525fbe79b1b8cac00c25450')
  })

  it('renders no gateway request id field at all (AC7\u2033)', () => {
    // There is no such id and no way to get one without APIM diagnostics. A labelled empty box
    // claims there could be; the line below states what is true instead.
    render(
      <TraceDrawer turn={settled} open position={position} usesGateway onClose={() => {}} />,
    )

    expect(screen.getByTestId('trace-panel')).not.toHaveTextContent(/gateway request id/i)
  })

  it('says the gateway carried the run but does not record it (AC7\u2033)', () => {
    render(
      <TraceDrawer turn={settled} open position={position} usesGateway onClose={() => {}} />,
    )

    expect(screen.getByTestId('trace-panel')).toHaveTextContent(
      /went through the gateway|passou pelo gateway/i,
    )
  })

  it('says so when the run did not go through a gateway (AC7\u2033)', () => {
    render(<TraceDrawer turn={settled} open position={position} onClose={() => {}} />)

    expect(screen.getByTestId('trace-panel')).toHaveTextContent(
      /did not go through a gateway|não passou por um gateway/i,
    )
  })

  it.each([
    ['pending', /have not arrived yet|ainda não chegaram/i],
    ['unavailable', /not configured|não está configurado/i],
    ['denied', /Log Analytics Reader/i],
    ['failed', /query failed|consulta do rastro falhou/i],
  ])('renders its own message for %s (AC3, AC4, AC5)', (status, pattern) => {
    render(
      <TraceDrawer
        turn={settled}
        open
        position={position}
        trace={{ status: status as 'pending', spans: [], message: 'Log Analytics Reader' }}
        onClose={() => {}}
      />,
    )

    expect(screen.getByTestId('trace-panel')).toHaveTextContent(pattern)
  })

  it('offers a retry while the spans have not landed (AC15)', () => {
    const onRetry = vi.fn()
    render(
      <TraceDrawer
        turn={settled}
        open
        position={position}
        trace={{ status: 'pending', spans: [] }}
        onRetryTrace={onRetry}
        onClose={() => {}}
      />,
    )

    screen.getByRole('button', { name: /check again|verificar de novo/i }).click()
    expect(onRetry).toHaveBeenCalled()
  })

  it('draws the span tree when the spans are there (AC2)', () => {
    render(
      <TraceDrawer
        turn={settled}
        open
        position={position}
        trace={{
          status: 'ok',
          spans: [
            {
              name: 'invoke_agent foundry-live-agent:3',
              span_id: 'a',
              parent_id: 'outside',
              duration_ms: 8865,
              start_ms: 0,
              kind: 'agent',
            },
          ],
        }}
        onClose={() => {}}
      />,
    )

    expect(screen.getByTestId('span-tree')).toHaveTextContent('invoke_agent')
  })
})

/**
 * Spec 024 AC6 — a trace opened from an address, for a conversation this browser never had.
 *
 * The spans live in the workspace, not here, which is the whole reason a trace link is worth
 * sending to somebody. So the panel has to render from a response id alone, and say plainly which
 * half of the picture is missing rather than looking like an empty trace.
 */
describe('a trace opened by address', () => {
  const open = (props = {}) =>
    render(
      <TraceDrawer
        open
        responseId="resp_elsewhere"
        trace={{ status: 'pending', spans: [] }}
        onClose={() => {}}
        {...props}
      />,
    )

  it('renders without a turn behind it', () => {
    open()
    expect(screen.getByTestId('trace-panel')).toBeInTheDocument()
  })

  it('shows the response id the address named', () => {
    open()
    expect(screen.getByText('resp_elsewhere')).toBeInTheDocument()
  })

  it('says the conversation is not stored in this browser', () => {
    open()
    expect(screen.getByTestId('trace-detached')).toBeInTheDocument()
  })

  it('still reports what the spans are doing', () => {
    open()
    expect(screen.getByTestId('trace-spans-state')).toBeInTheDocument()
  })

  it('lists no calls, because it has none — rather than an empty activity section', () => {
    open()
    expect(screen.queryByTestId('trace-activity')).not.toBeInTheDocument()
  })

  it('says nothing about a detached conversation once the turn is here', () => {
    open({ turn, responseId: 'resp_1' })
    expect(screen.queryByTestId('trace-detached')).not.toBeInTheDocument()
    expect(screen.getByTestId('trace-activity')).toBeInTheDocument()
  })
})

/** Spec 029 AC4, AC6, AC7, AC8 — the band, in the panel. */
describe('the turn timeline in the panel', () => {
  const SPANS = [
    {
      name: 'invoke_agent foundry-live-agent:8',
      span_id: 'root',
      parent_id: 'outside',
      duration_ms: 1000,
      start_ms: 0,
      kind: 'agent' as const,
    },
    {
      name: 'chat gpt-5.5',
      span_id: 'chat',
      parent_id: 'root',
      duration_ms: 600,
      start_ms: 0,
      kind: 'model' as const,
    },
  ]

  const show = (trace?: Parameters<typeof TraceDrawer>[0]['trace'], onRetryTrace = vi.fn()) =>
    render(<TraceDrawer turn={turn} open trace={trace} onRetryTrace={onRetryTrace} onClose={() => {}} />)

  it('draws the band once the spans are read', () => {
    show({ status: 'ok', spans: SPANS })
    expect(screen.getByTestId('timeline')).toBeInTheDocument()
  })

  it('says the earlier leg is elsewhere, because this turn ran a tool round trip (AC4)', () => {
    // `turn` above carries an app-executed call, which is what a round trip IS: Foundry asked, the
    // BFF answered, and that answer began a second Foundry response with its own trace.
    show({ status: 'ok', spans: SPANS })
    expect(screen.getByText(/separate trace/)).toBeInTheDocument()
  })

  it('draws no band while the spans are still coming, and keeps the retry (AC6)', () => {
    const onRetryTrace = vi.fn()
    show({ status: 'pending', spans: [] }, onRetryTrace)

    expect(screen.queryByTestId('timeline')).toBeNull()
    expect(screen.getByTestId('trace-spans-state')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /check again|verificar/i })).toBeInTheDocument()
  })

  it('draws no band and offers no retry when tracing is not configured, and says so once (AC7)', () => {
    show({ status: 'unavailable', spans: [] })

    expect(screen.queryByTestId('timeline')).toBeNull()
    expect(screen.queryByRole('button', { name: /check again|verificar/i })).toBeNull()
    expect(screen.getAllByTestId('trace-spans-state')).toHaveLength(1)
  })

  it('marks the span a segment selects, in the list below it (AC8)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    show({ status: 'ok', spans: SPANS })

    await userEvent.click(screen.getByRole('button', { name: /chat gpt-5\.5/ }))

    const row = screen.getByTestId('span-tree').querySelector('[data-span-id="chat"]')
    expect(row).toHaveAttribute('aria-current', 'true')
  })
})
