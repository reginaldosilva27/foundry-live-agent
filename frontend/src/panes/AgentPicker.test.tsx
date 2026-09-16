/**
 * The agents panel (spec 019, AC4 · AC5 · AC9 · AC11).
 *
 * It reads a real Foundry project, which in this repository's case holds ten agents and most of
 * them are nothing to do with this app. So the cases under test are the messy ones: a kind no
 * harness drives, a disabled agent, a version still provisioning — each listed, each dimmed, each
 * carrying its own reason rather than one vague one.
 */
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AgentPicker } from './AgentPicker'
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
    selectable: true,
    reason: '',
    ...overrides,
  }
}

const ROWS = [
  row('foundry-live-agent'),
  row('foundry-live-agent-hosted', { kind: 'hosted', version: '2' }),
]

const props: ComponentProps<typeof AgentPicker> = {
  agents: ROWS,
  error: null,
  loading: false,
  answering: 'foundry-live-agent',
  switched: null,
  configuredAgent: 'foundry-live-agent',
  onSelect: () => {},
}

function show(overrides: Partial<typeof props> = {}, lang: 'en' | 'pt' = 'en') {
  return render(
    <LangContext.Provider value={lang}>
      <AgentPicker {...props} {...overrides} />
    </LangContext.Provider>,
  )
}

describe('the agents panel', () => {
  // --- AC4 ---------------------------------------------------------------

  it('shows each agent with its kind, its served version and that version’s status', () => {
    show()

    const hosted = screen.getByRole('button', { name: /foundry-live-agent-hosted/ })
    expect(hosted).toHaveTextContent(t('agents.kind.hosted', 'en'))
    expect(hosted).toHaveTextContent('v2')
    expect(hosted).toHaveTextContent(t('agents.status.active', 'en'))
  })

  it('marks exactly one row as the one currently answering', () => {
    show()

    const marked = screen.getAllByText(t('agents.answering', 'en'))
    expect(marked).toHaveLength(1)
    expect(marked[0].closest('button')?.dataset.agent).toBe('foundry-live-agent')
  })

  it('marks the selected agent rather than the configured one once a choice is made', () => {
    show({ answering: 'foundry-live-agent-hosted' })

    const marked = screen.getAllByText(t('agents.answering', 'en'))
    expect(marked[0].closest('button')?.dataset.agent).toBe('foundry-live-agent-hosted')
  })

  // --- AC5: listed, not selectable, and told why --------------------------

  it.each([
    ['workflow', 'no_harness', 'agents.reason.no_harness'],
    ['prompt', 'disabled', 'agents.reason.disabled'],
    ['prompt', 'version_not_active', 'agents.reason.version_not_active'],
  ] as const)('lists a %s agent it cannot run and says why: %s', async (kind, reason, key) => {
    const onSelect = vi.fn()
    show({
      agents: [row('DatabricksGenie', { kind, selectable: false, reason })],
      onSelect,
    })

    const button = screen.getByRole('button', { name: /DatabricksGenie/ })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(t(key, 'en'))

    await userEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('says why in the reader’s language (AC11)', () => {
    show(
      { agents: [row('DatabricksGenie', { kind: 'workflow', selectable: false, reason: 'no_harness' })] },
      'pt',
    )

    expect(screen.getByText(t('agents.reason.no_harness', 'pt'))).toBeInTheDocument()
  })

  it('never leaves a dimmed row unexplained, even for a code it does not know', () => {
    show({ agents: [row('mystery', { selectable: false, reason: 'something_new' })] })

    const button = screen.getByRole('button', { name: /mystery/ })
    expect(button).toBeDisabled()
    expect(button.textContent).toMatch(/[A-Za-z]{3,}/)
    expect(button).toHaveTextContent(t('agents.reason.unknown', 'en'))
  })

  it('shows an unknown kind as unknown rather than guessing from the name', () => {
    show({ agents: [row('hosted-sounding-name', { kind: 'unknown', selectable: false, reason: 'no_harness' })] })

    expect(screen.getByText(t('agents.kind.unknown', 'en'))).toBeInTheDocument()
  })

  // --- AC9: the listing failed -------------------------------------------

  it('says the project could not be listed and still names the configured agent', () => {
    show({ agents: [], error: 'forbidden' })

    expect(screen.getByText(t('agents.error.forbidden', 'en'))).toBeInTheDocument()
    expect(screen.getByText(t('agents.fallback', 'en'))).toBeInTheDocument()
    expect(screen.getByText('foundry-live-agent')).toBeInTheDocument()
  })

  it('renders a failure code it does not recognise as a failure, not as silence', () => {
    show({ agents: [], error: 'teapot' })

    expect(screen.getByText(t('agents.error.unavailable', 'en'))).toBeInTheDocument()
  })

  it('says it is reading the project while it is', () => {
    show({ agents: [], loading: true })

    expect(screen.getByText(t('agents.loading', 'en'))).toBeInTheDocument()
  })

  // --- AC7: the screen says the conversation restarted --------------------

  it('says a new conversation started, naming the agent', () => {
    show({ switched: 'foundry-live-agent-hosted', answering: 'foundry-live-agent-hosted' })

    const notice = t('agents.switched', 'en').replace('{name}', 'foundry-live-agent-hosted')
    expect(screen.getByText(notice)).toBeInTheDocument()
  })

  it('selects a selectable row on click', async () => {
    const onSelect = vi.fn()
    show({ onSelect })

    await userEvent.click(screen.getByRole('button', { name: /foundry-live-agent-hosted/ }))

    expect(onSelect).toHaveBeenCalledWith('foundry-live-agent-hosted')
  })
})
