/** Spec 009 AC1, AC2, AC5 — the chat's one-line rendering of a call. */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolRow } from './ToolRow'
import type { Activity } from '../state/turn'

const appCall: Activity = {
  kind: 'tool',
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
