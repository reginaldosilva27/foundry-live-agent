/**
 * Spec 030 — what an agent is, on screen.
 *
 * The assertions worth reading twice are the negative ones. "Not reported" and "reported empty"
 * must render differently (§5); a failure must never render as an agent with nothing in it; and a
 * hosted agent's environment must not appear, because it is not sent — the recorded listing carries
 * a `KEY_VAULT_URI` in it.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AgentDetailScreen } from './AgentDetail'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import type { AgentDetail } from '../types/agents'

const PROMPT: AgentDetail = {
  name: 'foundry-live-agent',
  kind: 'prompt',
  version: '8',
  version_status: 'active',
  model: 'gpt-5.5',
  harness: 'prompt-agent',
  selectable: true,
  reason: '',
  instructions: 'You are the reference agent for the foundry-live-agent project.',
  tools: [
    {
      kind: 'function',
      name: 'get_current_datetime',
      executor: 'app',
      description: 'Get the current date and time in a given IANA timezone.',
      parameters: '{\n  "properties": {\n    "timezone": {}\n  }\n}',
      server_label: '',
      server_url: '',
      require_approval: '',
    },
    {
      kind: 'mcp',
      name: 'microsoft_learn',
      executor: 'foundry',
      description: '',
      parameters: null,
      server_label: 'microsoft_learn',
      server_url: 'https://learn.microsoft.com/api/mcp',
      require_approval: 'never',
    },
  ],
  reasoning: { summary: 'detailed' },
  container: null,
}

const HOSTED: AgentDetail = {
  ...PROMPT,
  name: 'foundry-live-agent-hosted',
  kind: 'hosted',
  harness: 'langgraph',
  instructions: null,
  tools: null,
  reasoning: null,
  container: {
    image: 'registry.azurecr.io/fla-hosted:azd-deploy-1789580414',
    cpu: '1.0',
    memory: '2Gi',
    protocols: ['responses 2.0.0'],
  },
}

function show(props: Partial<React.ComponentProps<typeof AgentDetailScreen>> = {}) {
  return render(
    <LangContext.Provider value="en">
      <AgentDetailScreen
        agent={PROMPT}
        error={null}
        loading={false}
        answering={undefined}
        onSelect={() => {}}
        onBack={() => {}}
        {...props}
      />
    </LangContext.Provider>,
  )
}

describe('a prompt agent', () => {
  it('renders what the service says it is (AC2)', () => {
    show()

    expect(screen.getByRole('heading', { name: 'foundry-live-agent' })).toBeInTheDocument()
    expect(screen.getByText('gpt-5.5')).toBeInTheDocument()
    expect(screen.getByText(/You are the reference agent/)).toBeInTheDocument()
    expect(screen.getByText('prompt-agent')).toBeInTheDocument()
  })

  it('renders a function tool with its schema and who runs it (AC3, AC4)', () => {
    show()
    const tool = screen.getByTestId('agent-tool-get_current_datetime')

    expect(tool).toHaveTextContent('get_current_datetime')
    expect(tool).toHaveTextContent(t('agent.executedByApp', 'en'))
    expect(tool).toHaveTextContent('timezone')
  })

  it('renders an MCP tool with its server and approval (AC3, AC4)', () => {
    show()
    const tool = screen.getByTestId('agent-tool-microsoft_learn')

    expect(tool).toHaveTextContent('https://learn.microsoft.com/api/mcp')
    expect(tool).toHaveTextContent('never')
    expect(tool).toHaveTextContent(t('agent.executedByFoundry', 'en'))
  })

  it('renders the reasoning configuration the service reported (AC6)', () => {
    show()
    expect(screen.getByTestId('agent-reasoning')).toHaveTextContent('detailed')
  })

  it('offers a copy for the instructions and for each schema (AC7)', () => {
    show()
    expect(screen.getAllByRole('button', { name: t('answer.copy', 'en') }).length).toBeGreaterThanOrEqual(2)
  })

  it('selects the agent, exactly as its card does (AC9)', async () => {
    const onSelect = vi.fn()
    show({ onSelect })

    await userEvent.click(screen.getByRole('button', { name: t('agent.choose', 'en') }))

    expect(onSelect).toHaveBeenCalledWith('foundry-live-agent')
  })
})

describe('what the service did not say', () => {
  it('says a field was not reported rather than leaving it blank (AC5)', () => {
    show({ agent: { ...PROMPT, instructions: null } })

    expect(screen.getByTestId('agent-instructions')).toHaveTextContent(
      t('agent.notReported', 'en'),
    )
  })

  it('renders an empty instruction as empty, not as unreported (AC5)', () => {
    // Five of the ten recorded agents really do have empty instructions. That is a fact about the
    // agent; "not reported" would be a fact about the service, and they are not the same.
    show({ agent: { ...PROMPT, instructions: '' } })

    expect(screen.getByTestId('agent-instructions')).not.toHaveTextContent(
      t('agent.notReported', 'en'),
    )
  })

  it('renders nothing at all for reasoning nobody configured (AC6)', () => {
    show({ agent: { ...PROMPT, reasoning: null } })
    expect(screen.queryByTestId('agent-reasoning')).toBeNull()
  })

  it('says tools were not reported when the definition named none (AC5)', () => {
    show({ agent: { ...PROMPT, tools: null } })
    expect(screen.getByTestId('agent-tools')).toHaveTextContent(t('agent.notReported', 'en'))
  })
})

describe('a hosted agent', () => {
  it('renders the container, which is what a hosted agent is (AC11)', () => {
    show({ agent: HOSTED })
    const container = screen.getByTestId('agent-container')

    expect(container).toHaveTextContent('registry.azurecr.io/fla-hosted:azd-deploy-1789580414')
    expect(container).toHaveTextContent('1.0')
    expect(container).toHaveTextContent('2Gi')
    expect(container).toHaveTextContent('responses 2.0.0')
  })

  it('shows no environment, because none is sent (AC11)', () => {
    const { container } = show({ agent: HOSTED })
    expect(container.textContent).not.toMatch(/KEY_VAULT|environment/i)
  })

  it('does not draw a container for an agent that is not one', () => {
    show()
    expect(screen.queryByTestId('agent-container')).toBeNull()
  })
})

describe('when it could not be read', () => {
  it('renders the failure code, translated, and no detail (AC8)', () => {
    show({ agent: null, error: 'unknown_agent' })

    expect(screen.getByText(t('agent.notFound', 'en'))).toBeInTheDocument()
    expect(screen.queryByTestId('agent-instructions')).toBeNull()
  })

  it('translates a listing failure with the listing’s own vocabulary (§4)', () => {
    show({ agent: null, error: 'forbidden' })
    expect(screen.getByText(t('agents.error.forbidden', 'en'))).toBeInTheDocument()
  })

  it('says nothing at all while it is still loading', () => {
    show({ agent: null, error: null, loading: true })

    expect(screen.queryByText(t('agent.notFound', 'en'))).toBeNull()
    expect(screen.queryByTestId('agent-instructions')).toBeNull()
  })
})
