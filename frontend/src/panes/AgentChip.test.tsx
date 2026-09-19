/**
 * Spec 021 AC14, AC15 — who is about to answer, said where the question is typed.
 *
 * The agents screen already lets a person choose. The chip exists because the choice was 900px away
 * from the cursor: the one decision this app is built to make visible was invisible at the moment
 * it mattered. Two entry points, one rule — both call the same `select`, and switching still starts
 * a new conversation (019 AC7).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AgentChip } from './AgentChip'
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

const AGENTS = [
  row('foundry-live-agent'),
  row('foundry-live-agent-hosted', { kind: 'hosted' }),
  row('DatabricksGenie', { kind: 'workflow', selectable: false, reason: 'no_harness' }),
]

const props = {
  agents: AGENTS,
  answering: 'foundry-live-agent' as string | undefined,
  onSelect: () => {},
  onSeeAll: () => {},
}

function show(overrides: Partial<typeof props> = {}) {
  return render(
    <LangContext.Provider value="en">
      <AgentChip {...props} {...overrides} />
    </LangContext.Provider>,
  )
}

const chip = () => screen.getByTestId('agent-chip')

describe('the composer chip', () => {
  it('names the agent that will answer', () => {
    show()
    expect(chip()).toHaveTextContent('foundry-live-agent')
  })

  it('renders nothing at all when there is no agent to name', () => {
    show({ answering: undefined })
    expect(screen.queryByTestId('agent-chip')).toBeNull()
  })

  it('offers only the agents this build can drive', async () => {
    show()
    await userEvent.click(chip())

    expect(screen.getByRole('menuitem', { name: /foundry-live-agent-hosted/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /DatabricksGenie/ })).toBeNull()
  })

  it('switches the agent when one is chosen', async () => {
    const onSelect = vi.fn()
    show({ onSelect })

    await userEvent.click(chip())
    await userEvent.click(screen.getByRole('menuitem', { name: /foundry-live-agent-hosted/ }))

    expect(onSelect).toHaveBeenCalledWith('foundry-live-agent-hosted')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('has a way through to the whole listing, since the menu is a shortcut and not a screen', async () => {
    const onSeeAll = vi.fn()
    show({ onSeeAll })

    await userEvent.click(chip())
    await userEvent.click(screen.getByRole('menuitem', { name: t('composer.allAgents', 'en') }))

    expect(onSeeAll).toHaveBeenCalled()
  })

  it('closes when the reader clicks away from it', async () => {
    show()

    await userEvent.click(chip())
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.click(document.body)

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Escape and gives the focus back to the chip', async () => {
    show()

    await userEvent.click(chip())
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).toBeNull()
    expect(chip()).toHaveFocus()
  })
})
