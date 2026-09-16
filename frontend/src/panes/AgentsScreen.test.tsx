/**
 * The agents screen (spec 019 AC4 · AC5 · AC9 · AC11; spec 021 AC4 · AC5 · AC7).
 *
 * Moved here from `AgentPicker` when spec 021 took the listing out of the sidebar, which was too
 * narrow to hold it — the 019 cases came across unchanged, because the honest half of that spec is
 * exactly what a bigger surface must not lose.
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
import { AgentsScreen } from './AgentsScreen'
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
  row('foundry-live-agent-hosted', { kind: 'hosted', version: '2', harness: 'langgraph' }),
]

const props: ComponentProps<typeof AgentsScreen> = {
  agents: ROWS,
  error: null,
  loading: false,
  answering: 'foundry-live-agent',
  configuredAgent: 'foundry-live-agent',
  favourites: [] as string[],
  onSelect: () => {},
  onFavourite: () => {},
}

function show(overrides: Partial<typeof props> = {}, lang: 'en' | 'pt' = 'en') {
  return render(
    <LangContext.Provider value={lang}>
      <AgentsScreen {...props} {...overrides} />
    </LangContext.Provider>,
  )
}

/** The card's selectable control — the part 019's criteria are about. */
function card(name: string): HTMLButtonElement {
  const control = document.querySelector<HTMLButtonElement>(`button[data-agent="${name}"]`)
  if (!control) throw new Error(`no card for ${name}`)
  return control
}

const cardOrNull = (name: string) => document.querySelector(`button[data-agent="${name}"]`)

const star = (name: string, action: 'agents.favourite' | 'agents.unfavourite' = 'agents.favourite') =>
  screen.getByRole('button', { name: t(action, 'en').replace('{name}', name) })

describe('the agents screen', () => {
  // --- AC4: everything the project says about an agent ---------------------

  it('shows each agent with its kind, its served version and that version’s status', () => {
    show()

    const hosted = card('foundry-live-agent-hosted')
    expect(hosted).toHaveTextContent(t('agents.kind.hosted', 'en'))
    expect(hosted).toHaveTextContent('v2')
    expect(hosted).toHaveTextContent(t('agents.status.active', 'en'))
  })

  it('shows the model it runs and the harness that would drive it', () => {
    show()

    const hosted = card('foundry-live-agent-hosted')
    expect(hosted).toHaveTextContent('gpt-5.5')
    expect(hosted).toHaveTextContent('langgraph')
  })

  it('gives each agent a mark made from its own name, not a picture', () => {
    show()
    expect(screen.getAllByTestId('monogram')).toHaveLength(ROWS.length)
  })

  it('marks exactly one card as the one currently answering', () => {
    show()

    const marked = screen.getAllByText(t('agents.answeringCard', 'en'))
    expect(marked).toHaveLength(1)
    expect(marked[0].closest('button')?.dataset.agent).toBe('foundry-live-agent')
  })

  it('marks the selected agent rather than the configured one once a choice is made', () => {
    show({ answering: 'foundry-live-agent-hosted' })

    const marked = screen.getAllByText(t('agents.answeringCard', 'en'))
    expect(marked[0].closest('button')?.dataset.agent).toBe('foundry-live-agent-hosted')
  })

  // --- AC5 (019): listed, not selectable, and told why ---------------------

  it.each([
    ['workflow', 'no_harness', 'agents.reason.no_harness'],
    ['prompt', 'disabled', 'agents.reason.disabled'],
    ['prompt', 'version_not_active', 'agents.reason.version_not_active'],
  ] as const)('lists a %s agent it cannot run and says why: %s', async (kind, reason, key) => {
    const onSelect = vi.fn()
    show({
      agents: [row('DatabricksGenie', { kind, selectable: false, reason, harness: '' })],
      onSelect,
    })

    const button = card('DatabricksGenie')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(t(key, 'en'))

    await userEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('says why in the reader’s language (019 AC11)', () => {
    show(
      {
        agents: [
          row('DatabricksGenie', { kind: 'workflow', selectable: false, reason: 'no_harness' }),
        ],
      },
      'pt',
    )

    expect(screen.getByText(t('agents.reason.no_harness', 'pt'))).toBeInTheDocument()
  })

  it('never leaves a dimmed card unexplained, even for a code it does not know', () => {
    show({ agents: [row('mystery', { selectable: false, reason: 'something_new' })] })

    const button = card('mystery')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(t('agents.reason.unknown', 'en'))
  })

  it('shows an unknown kind as unknown rather than guessing from the name', () => {
    show({
      agents: [
        row('hosted-sounding-name', { kind: 'unknown', selectable: false, reason: 'no_harness' }),
      ],
    })

    expect(screen.getByText(t('agents.kind.unknown', 'en'))).toBeInTheDocument()
  })

  // --- AC5 (021): search ---------------------------------------------------

  it('narrows the grid to the agents whose name matches, ignoring case', async () => {
    show()

    await userEvent.type(screen.getByRole('searchbox'), 'HOSTED')

    expect(card('foundry-live-agent-hosted')).toBeInTheDocument()
    expect(cardOrNull('foundry-live-agent')).toBeNull()
  })

  it('says nothing matched rather than showing an empty grid', async () => {
    show()

    await userEvent.type(screen.getByRole('searchbox'), 'zzz')

    expect(screen.getByText(t('agents.noMatches', 'en'))).toBeInTheDocument()
    expect(screen.queryAllByTestId('monogram')).toHaveLength(0)
  })

  it('keeps an agent it cannot run in the results — search filters, it does not tidy', async () => {
    show({
      agents: [row('DatabricksGenie', { selectable: false, reason: 'no_harness' }), ...ROWS],
    })

    await userEvent.type(screen.getByRole('searchbox'), 'genie')

    expect(card('DatabricksGenie')).toBeDisabled()
  })

  // --- AC7: the listing failed ---------------------------------------------

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

  it('selects a selectable card on click', async () => {
    const onSelect = vi.fn()
    show({ onSelect })

    await userEvent.click(card('foundry-live-agent-hosted'))

    expect(onSelect).toHaveBeenCalledWith('foundry-live-agent-hosted')
  })
})

/**
 * Spec 022 AC1 · AC2 · AC3 — the star.
 *
 * It sits inside a card that is itself a control, which is why the card stopped being one button:
 * starring an agent must not be a way of accidentally switching to it.
 */
describe('favouriting from a card', () => {
  it('gives every card a star that names the action and the agent', () => {
    show()

    expect(star('foundry-live-agent')).toBeInTheDocument()
    expect(star('foundry-live-agent-hosted')).toBeInTheDocument()
  })

  it('says "remove" on an agent that is already a favourite', () => {
    show({ favourites: ['foundry-live-agent'] })

    expect(star('foundry-live-agent', 'agents.unfavourite')).toHaveAttribute('aria-pressed', 'true')
  })

  it('favourites without selecting — starring is not switching', async () => {
    const onFavourite = vi.fn()
    const onSelect = vi.fn()
    show({ onFavourite, onSelect })

    await userEvent.click(star('foundry-live-agent-hosted'))

    expect(onFavourite).toHaveBeenCalledWith('foundry-live-agent-hosted')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('can star an agent this build cannot drive — wanting it in reach is not claiming it runs', async () => {
    const onFavourite = vi.fn()
    show({
      agents: [row('DatabricksGenie', { selectable: false, reason: 'no_harness' })],
      onFavourite,
    })

    await userEvent.click(star('DatabricksGenie'))

    expect(onFavourite).toHaveBeenCalledWith('DatabricksGenie')
  })
})
