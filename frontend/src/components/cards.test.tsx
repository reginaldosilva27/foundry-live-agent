/**
 * Spec 004 AC4, AC5, AC6, AC7.
 *
 * AC4 is the one this repository exists to make visible: a tool the BFF ran and a tool Foundry ran
 * are different events, and a viewer who cannot tell them apart has missed the point (design-system
 * note M6).
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ErrorCard } from './ErrorCard'
import { ReasoningCard } from './ReasoningCard'
import { ToolCard } from './ToolCard'
import type { McpActivity, ToolActivity } from '../state/turn'

const appTool: ToolActivity = {
  kind: 'tool',
  executor: 'app',
  callId: 'call_1',
  name: 'get_current_datetime',
  arguments: '{"timezone":"America/Sao_Paulo"}',
  status: 'ok',
  output: '{"iso":"2026-09-04T19:00:00-03:00"}',
  durationMs: 3,
}

const mcpCall: McpActivity = {
  kind: 'mcp',
  serverLabel: 'microsoft_learn',
  name: 'microsoft_docs_search',
  arguments: '{"query":"hosted agents"}',
  status: 'ok',
  output: 'Hosted agents run inside the service.',
}

describe('ToolCard', () => {
  it('marks an app-executed tool and a Foundry-executed one differently', () => {
    render(
      <>
        <ToolCard activity={appTool} />
        <ToolCard activity={mcpCall} />
      </>,
    )
    const [app, foundry] = screen.getAllByTestId('tool-card')

    expect(app).toHaveAttribute('data-executor', 'app')
    expect(foundry).toHaveAttribute('data-executor', 'foundry')

    // Not colour alone: the two carry different text, so the distinction survives for a reader
    // who cannot tell the two borders apart.
    const appTag = within(app).getByTestId('executor-tag').textContent
    const foundryTag = within(foundry).getByTestId('executor-tag').textContent
    expect(appTag).not.toBe(foundryTag)
    expect(appTag).toBeTruthy()
  })

  it('attributes an MCP call to the server that ran it', () => {
    render(<ToolCard activity={mcpCall} />)
    expect(screen.getByTestId('executor-tag')).toHaveTextContent('microsoft_learn')
  })

  it('shows the arguments while the call is still running, and no result yet', () => {
    render(<ToolCard activity={{ ...appTool, status: 'running', output: undefined }} />)
    const card = screen.getByTestId('tool-card')

    expect(card).toHaveAttribute('data-status', 'running')
    expect(within(card).getByTestId('tool-arguments')).toHaveTextContent('America/Sao_Paulo')
    expect(within(card).queryByTestId('tool-result')).toBeNull()
  })

  it('shows the result and how long it took once the call resolves', () => {
    render(<ToolCard activity={appTool} />)
    const card = screen.getByTestId('tool-card')

    expect(card).toHaveAttribute('data-status', 'ok')
    expect(within(card).getByTestId('tool-result')).toHaveTextContent('2026-09-04')
    expect(within(card).getByTestId('tool-duration')).toHaveTextContent('3')
  })

  it('shows a failed call as failed rather than as a result', () => {
    render(
      <ToolCard
        activity={{ ...appTool, status: 'failed', error: 'ZoneInfoNotFoundError: nope' }}
      />,
    )
    const card = screen.getByTestId('tool-card')
    expect(card).toHaveAttribute('data-status', 'failed')
    expect(within(card).getByTestId('tool-error')).toHaveTextContent('ZoneInfoNotFoundError')
  })
})

describe('ReasoningCard', () => {
  it('streams its text and collapses on demand', async () => {
    render(<ReasoningCard text="The user asked what time it is." streaming />)
    expect(screen.getByTestId('reasoning-body')).toHaveTextContent('what time it is')

    await userEvent.click(screen.getByRole('button'))
    expect(screen.queryByTestId('reasoning-body')).toBeNull()
  })

  it('says why it is empty rather than rendering an empty box', () => {
    render(<ReasoningCard text="" streaming={false} />)
    expect(screen.getByTestId('reasoning-absent')).toBeInTheDocument()
    expect(screen.getByTestId('reasoning-absent').textContent).not.toBe('')
  })

  it('stays out of the way while a turn that will produce no reasoning is still streaming', () => {
    render(<ReasoningCard text="" streaming />)
    expect(screen.queryByTestId('reasoning-absent')).toBeNull()
  })
})

describe('ErrorCard', () => {
  it('renders a terminal error as an error, with its code', () => {
    render(<ErrorCard error={{ message: 'model deployment not found', code: 'model_not_found' }} />)
    const card = screen.getByRole('alert')
    expect(card).toHaveTextContent('model deployment not found')
    expect(card).toHaveTextContent('model_not_found')
  })
})
