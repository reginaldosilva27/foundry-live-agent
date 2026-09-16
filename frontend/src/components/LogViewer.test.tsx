/** Spec 010 AC2, AC5, AC6 — the reader: one call, with room to read it. */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LogViewer } from './LogViewer'
import type { Activity } from '../state/turn'

const mcpCall: Activity = {
  kind: 'mcp',
  step: 1,
  serverLabel: 'microsoft_learn',
  name: 'microsoft_docs_search',
  arguments: '{"query":"hosted agent"}',
  status: 'ok',
  output: '{"results":[{"title":"Agents in Microsoft Foundry"}]}',
}

const failed: Activity = {
  kind: 'tool',
  step: 2,
  executor: 'app',
  callId: 'call_1',
  name: 'get_current_datetime',
  arguments: '{"timezone":"Mars/Olympus"}',
  status: 'failed',
  error: 'tool_failed: unknown timezone',
  durationMs: 2,
}

describe('the call reader', () => {
  it('shows the call, its arguments and its result (AC2)', () => {
    render(<LogViewer activity={mcpCall} onClose={() => {}} />)

    const reader = screen.getByTestId('log-viewer')
    expect(reader).toHaveTextContent('microsoft_docs_search')
    expect(reader).toHaveTextContent('microsoft_learn')
    expect(screen.getByTestId('log-arguments')).toHaveTextContent('"query": "hosted agent"')
    expect(screen.getByTestId('log-result')).toHaveTextContent('Agents in Microsoft Foundry')
  })

  it('indents the payload instead of dumping it on one line (AC3)', () => {
    render(<LogViewer activity={mcpCall} onClose={() => {}} />)

    expect(screen.getByTestId('log-result').textContent!.split('\n').length).toBeGreaterThan(3)
  })

  it('shows the error in place of a result when the call failed (AC5)', () => {
    render(<LogViewer activity={failed} onClose={() => {}} />)

    expect(screen.getByTestId('log-error')).toHaveTextContent('unknown timezone')
    expect(screen.queryByTestId('log-result')).toBeNull()
  })

  it('says so when a call returned nothing', () => {
    render(<LogViewer activity={{ ...mcpCall, output: undefined }} onClose={() => {}} />)

    expect(screen.getByTestId('log-viewer')).toHaveTextContent(/returned nothing|não retornou nada/i)
  })

  it('closes on Escape, on the button, and on the backdrop (AC6)', () => {
    const onClose = vi.fn()
    const { rerender } = render(<LogViewer activity={mcpCall} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<LogViewer activity={mcpCall} onClose={onClose} />)
    screen.getByRole('button', { name: /close the reader|fechar o leitor/i }).click()
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByTestId('log-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})

/**
 * `aria-modal="true"` is a promise to assistive technology: nothing behind this element is
 * reachable. The reader used to declare it without keeping it — focus stayed on whatever tool row
 * opened the dialog, Tab walked straight out into the chat behind the scrim, and closing left the
 * focus wherever it had wandered to.
 */
describe('the reader as a modal', () => {
  it('moves focus into the dialog when it opens', () => {
    render(<LogViewer activity={mcpCall} onClose={() => {}} />)

    expect(screen.getByTestId('log-viewer').contains(document.activeElement)).toBe(true)
  })

  it('gives focus back to whatever opened it', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const { unmount } = render(<LogViewer activity={mcpCall} onClose={() => {}} />)
    expect(document.activeElement).not.toBe(opener)

    unmount()
    expect(document.activeElement).toBe(opener)
  })
})
