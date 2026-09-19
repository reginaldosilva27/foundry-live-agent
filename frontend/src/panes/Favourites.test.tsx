/**
 * Spec 022 AC4, AC6 — the favourites group in the rail.
 *
 * The rail is the short list; the agents screen is the long one. So this group renders what the
 * reader put in it and nothing else — no heading over an empty box, and no agent made choosable by
 * having been starred.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Favourites } from './Favourites'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import type { AgentRow } from '../types/agents'

function row(name: string, overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    name,
    kind: 'prompt',
    version: '8',
    version_status: 'active',
    model: 'gpt-5.5',
    harness: 'prompt-agent',
    suggestions: [],
    selectable: true,
    reason: '',
    ...overrides,
  }
}

function show(rows: AgentRow[], onSelect = () => {}, answering?: string) {
  return render(
    <LangContext.Provider value="en">
      <Favourites rows={rows} answering={answering} onSelect={onSelect} />
    </LangContext.Provider>,
  )
}

describe('the favourites group', () => {
  it('lists what the reader starred, each with its mark', () => {
    show([row('foundry-live-agent'), row('foundry-live-agent-hosted')])

    expect(screen.getByText(t('favourites.title', 'en'))).toBeInTheDocument()
    expect(screen.getAllByTestId('monogram')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /foundry-live-agent-hosted/ })).toBeInTheDocument()
  })

  it('renders nothing at all when nothing is starred — not a heading over an empty box', () => {
    const { container } = show([])
    expect(container).toBeEmptyDOMElement()
  })

  it('chooses the agent that was clicked', async () => {
    const onSelect = vi.fn()
    show([row('foundry-live-agent-hosted')], onSelect)

    await userEvent.click(screen.getByRole('button', { name: /foundry-live-agent-hosted/ }))

    expect(onSelect).toHaveBeenCalledWith('foundry-live-agent-hosted')
  })

  it('keeps a starred agent this build cannot drive, dimmed and inert (AC6)', async () => {
    const onSelect = vi.fn()
    show([row('DatabricksGenie', { selectable: false, reason: 'no_harness' })], onSelect)

    const button = screen.getByRole('button', { name: /DatabricksGenie/ })
    expect(button).toBeDisabled()

    await userEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('marks the one that is answering', () => {
    show([row('foundry-live-agent')], () => {}, 'foundry-live-agent')

    expect(screen.getByRole('button', { name: /foundry-live-agent/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})
