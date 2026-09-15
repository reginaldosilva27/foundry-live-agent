/** Spec 009 AC3, AC5, AC6 — the payload lives here now. */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TraceDrawer } from './TraceDrawer'
import { emptyTurn, type Turn } from '../state/turn'

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
