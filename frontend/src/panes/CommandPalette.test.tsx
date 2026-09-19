/**
 * Spec 025 AC4, AC5, AC8, AC9 — one field that reaches everything.
 *
 * The palette is the app's fourth overlay, so it borrows the focus behaviour the other three use
 * rather than inventing a fifth (§4). What is new here is the rule that Enter can never land on
 * something that would fail: an entry the build cannot run is shown, with its reason, and skipped.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './CommandPalette'
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

function show(overrides: Partial<React.ComponentProps<typeof CommandPalette>> = {}) {
  const onRun = vi.fn()
  const onClose = vi.fn()
  render(
    <LangContext.Provider value="en">
      <CommandPalette
        agents={[row('foundry-live-agent'), row('workflow-one', { selectable: false, reason: 'no_harness' })]}
        conversations={[{ id: 'c_1', title: 'what time is it', updatedAt: 1, messages: [], agent: null }]}
        voiceEnabled
        onRun={onRun}
        onClose={onClose}
        {...overrides}
      />
    </LangContext.Provider>,
  )
  return { onRun, onClose, field: screen.getByRole('combobox') }
}

describe('the palette', () => {
  it('opens focused on its field, so typing starts filtering immediately', () => {
    const { field } = show()
    expect(field).toHaveFocus()
  })

  it('lists agents, conversations and actions together', () => {
    show()
    expect(screen.getByText('foundry-live-agent')).toBeInTheDocument()
    expect(screen.getByText('what time is it')).toBeInTheDocument()
    expect(screen.getByText(t('keys.newConversation', 'en'))).toBeInTheDocument()
  })

  it('filters as the reader types (AC5)', async () => {
    const { field } = show()
    await userEvent.type(field, 'what time')

    expect(screen.getByText('what time is it')).toBeInTheDocument()
    expect(screen.queryByText('foundry-live-agent')).not.toBeInTheDocument()
  })

  it('says so when nothing matches, rather than showing an empty box', async () => {
    const { field } = show()
    await userEvent.type(field, 'zzzz')

    expect(screen.getByText(t('palette.empty', 'en'))).toBeInTheDocument()
  })

  it('closes on Escape, as every other overlay does (AC4)', async () => {
    const { onClose } = show()
    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})

describe('running an entry (AC5)', () => {
  it('runs the highlighted entry on Enter', async () => {
    const { onRun, field } = show()
    await userEvent.type(field, 'foundry-live-agent{Enter}')

    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ target: { kind: 'agent', name: 'foundry-live-agent' } }),
    )
  })

  it('runs an entry that is pressed', async () => {
    const { onRun } = show()
    await userEvent.click(screen.getByText('what time is it'))

    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ target: { kind: 'conversation', id: 'c_1' } }),
    )
  })

  it('moves the highlight with the arrows', async () => {
    const { onRun, field } = show()
    await userEvent.type(field, 'foundry')
    await userEvent.keyboard('{ArrowDown}{Enter}')

    // One match, so ArrowDown must not walk off it.
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ target: { kind: 'agent', name: 'foundry-live-agent' } }),
    )
  })
})

describe('what cannot be run (AC8)', () => {
  it('shows an agent this build cannot drive, with its reason said in the reader\'s language', () => {
    show()
    expect(screen.getByText('workflow-one')).toBeInTheDocument()
    expect(screen.getByText(t('agents.reason.no_harness', 'en'))).toBeInTheDocument()
  })

  it('refuses to run it when it is pressed', async () => {
    const { onRun } = show()
    await userEvent.click(screen.getByText('workflow-one'))

    expect(onRun).not.toHaveBeenCalled()
  })

  it('skips it with the arrows, so Enter can never land on it', async () => {
    const { onRun, field } = show()
    await userEvent.type(field, 'workflow{Enter}')

    expect(onRun).not.toHaveBeenCalled()
  })

  it('marks voice unavailable where the deployment has none', () => {
    show({ voiceEnabled: false })
    const voice = screen.getByText(t('keys.startVoice', 'en')).closest('[role="option"]')

    expect(voice).toHaveAttribute('aria-disabled', 'true')
  })
})
