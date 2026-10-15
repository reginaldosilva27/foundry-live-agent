/**
 * Spec 021 AC2 · AC3 · AC8, and spec 019's AC7 notice, which moved here.
 *
 * The rail is the one region always on screen, which decides what belongs in it: the two views, the
 * agent that is answering, the conversations this browser kept, and the footer saying what we are
 * connected to. The full agent listing is *not* in that set any more — it is on its own screen, and
 * a test says so, because putting it back is the regression this spec exists to prevent.
 */
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import type { BffConfig } from '../config'
import type { AgentsState } from '../state/agents'
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

const AGENTS: AgentsState = {
  agents: [row('foundry-live-agent'), row('foundry-live-agent-hosted', { kind: 'hosted' })],
  error: null,
  loading: false,
  selected: null,
  selectedRow: null,
  switched: null,
  select: () => {},
  adopt: () => {},
  clearNotice: () => {},
}

const CONFIG = {
  harness: 'prompt-agent',
  suggestions: [],
  agent_name: 'foundry-live-agent',
  model: 'foundry-analytics-demo/gpt-5.5',
  uses_gateway: true,
} as unknown as BffConfig

const props: ComponentProps<typeof Sidebar> = {
  config: CONFIG,
  configFailed: false,
  agents: AGENTS,
  favourites: [],
  lang: 'en',
  view: 'chat',
  collapsed: false,
  onToggleCollapse: () => {},
  theme: 'light',
  onTheme: () => {},
  history: {
    conversations: [],
    storing: true,
    save: () => {},
    rename: () => {},
    remove: () => {},
  },
  activeId: null,
  onLang: () => {},
  onNewSession: () => {},
  onView: () => {},
  onOpenConversation: () => {},
  onSelectAgent: () => {},
}

function show(overrides: Partial<typeof props> = {}) {
  return render(
    <LangContext.Provider value="en">
      <Sidebar {...props} {...overrides} />
    </LangContext.Provider>,
  )
}

afterEach(() => localStorage.clear())

describe('the rail', () => {
  it('offers exactly Chat, Agents and Playground, in that order (spec 060, AC5)', () => {
    show({ view: 'playground' })

    const nav = screen.getByRole('navigation', { name: t('app.name', 'en') })
    const names = Array.from(nav.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual([t('nav.chat', 'en'), t('nav.agents', 'en'), t('nav.playground', 'en')])
    expect(screen.getByRole('button', { name: t('nav.playground', 'en') })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: /^(commands|history|compare)$/i })).toBeNull()
  })

  it('switches theme from the footer, naming what it switches to (spec 060, AC2)', async () => {
    const onTheme = vi.fn()
    show({ theme: 'light', onTheme })

    await userEvent.click(screen.getByRole('button', { name: t('theme.toDark', 'en') }))
    expect(onTheme).toHaveBeenCalledWith('dark')

    show({ theme: 'dark', onTheme })
    await userEvent.click(screen.getByRole('button', { name: t('theme.toLight', 'en') }))
    expect(onTheme).toHaveBeenLastCalledWith('light')
  })

  it('from "system", switches to the opposite of what the system shows (spec 060, AC2)', async () => {
    const onTheme = vi.fn()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('dark'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    show({ theme: 'system', onTheme })

    await userEvent.click(screen.getByRole('button', { name: t('theme.toLight', 'en') }))
    expect(onTheme).toHaveBeenCalledWith('light')
    vi.unstubAllGlobals()
  })

  it('offers the two views and marks the one you are in (AC1)', async () => {
    const onView = vi.fn()
    show({ view: 'chat' })

    expect(screen.getByRole('button', { name: t('nav.chat', 'en') })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: t('nav.agents', 'en') })).not.toHaveAttribute(
      'aria-current',
    )

    show({ view: 'agents', onView })
    const agentsItems = screen.getAllByRole('button', { name: t('nav.agents', 'en') })
    expect(agentsItems.at(-1)).toHaveAttribute('aria-current', 'page')

    await userEvent.click(agentsItems.at(-1)!)
    expect(onView).toHaveBeenCalledWith('agents')
  })

  // --- AC2 ---------------------------------------------------------------

  it('renders collapsed when it is told to, keeping every item nameable', () => {
    // Since spec 025 the flag lives in `App` — a keyboard command toggles it too, so it needs one
    // owner (§4). What the rail owns is how it *looks* collapsed, and that the labels leave the
    // layout without leaving the accessibility tree (021 AC2). Persistence is asserted where it
    // now happens, in `App.keyboard.test.tsx`.
    show({ collapsed: true })

    expect(screen.getByRole('complementary').dataset.collapsed).toBe('true')
    expect(screen.getByRole('button', { name: t('nav.chat', 'en') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('nav.agents', 'en') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('nav.expand', 'en') })).toBeInTheDocument()
  })

  it('asks to be collapsed rather than collapsing itself', async () => {
    const onToggleCollapse = vi.fn()
    show({ onToggleCollapse })

    await userEvent.click(screen.getByRole('button', { name: t('nav.collapse', 'en') }))

    expect(onToggleCollapse).toHaveBeenCalled()
  })

  // --- AC3 ---------------------------------------------------------------

  it('keeps technical facts out of the footer and preserves the about entry (spec059)', () => {
    show()
    expect(screen.queryByTestId('sidebar-model')).toBeNull()
    expect(screen.queryByText(t('sidebar.gatewayOn', 'en'))).toBeNull()
    expect(screen.queryByText(t('sidebar.transport', 'en'))).toBeNull()
    expect(screen.getByRole('button', { name: t('sidebar.about', 'en') })).toBeInTheDocument()
  })

  it('navigates to the panel rather than growing the footer', async () => {
    const onView = vi.fn()
    show({ onView })

    await userEvent.click(screen.getByRole('button', { name: t('sidebar.about', 'en') }))

    expect(onView).toHaveBeenCalledWith('about')
  })

  it('offers it even when the configuration could not be read', () => {
    // The panel is where a reader goes to find out WHY, so the way in must survive the failure.
    show({ config: null, configFailed: true })
    expect(screen.getByRole('button', { name: t('sidebar.about', 'en') })).toBeInTheDocument()
  })

  // --- AC8 ---------------------------------------------------------------

  it('names the agent that is answering and does not list the rest', () => {
    show()

    expect(screen.getByTestId('answering-agent')).toHaveTextContent('foundry-live-agent')
    expect(screen.queryByText('foundry-live-agent-hosted')).toBeNull()
  })

  it('follows the selection rather than the configured agent', () => {
    show({
      agents: { ...AGENTS, selected: 'foundry-live-agent-hosted' },
    })

    expect(screen.getByTestId('answering-agent')).toHaveTextContent('foundry-live-agent-hosted')
  })

  it('says a new conversation started, naming the agent (019 AC7)', () => {
    show({ agents: { ...AGENTS, selected: 'foundry-live-agent-hosted', switched: 'foundry-live-agent-hosted' } })

    const notice = t('agents.switched', 'en').replace('{name}', 'foundry-live-agent-hosted')
    expect(screen.getByText(notice)).toBeInTheDocument()
  })

  /**
   * The defect this rail keeps re-learning: the middle grows and the bottom goes with it.
   *
   * 021 put the overflow on the history's own list, which is one list per age group — with three
   * groups on screen the rail painted over the language switch and the footer again (Chrome,
   * 1440x900, seven conversations). So the rule is structural and asserted here rather than in a
   * stylesheet a browser has to be running to apply: what grows is *inside* the scrolling region,
   * and what must never move is outside it.
   */
  it('keeps the language switch and the footer out of the region that scrolls', () => {
    const { container } = show({
      history: {
        ...props.history,
        conversations: [
          { id: 'c1', agent: null, title: 'today', updatedAt: Date.now(), messages: [] },
          { id: 'c2', agent: null, title: 'older', updatedAt: 0, messages: [] },
        ],
      },
    })

    const scroll = container.querySelector('.sidebar__scroll')!
    expect(scroll).not.toBeNull()
    expect(scroll.contains(screen.getByRole('button', { name: /today/ }))).toBe(true)
    expect(scroll.contains(screen.getByTestId('answering-agent'))).toBe(true)

    expect(scroll.contains(screen.getByRole('group', { name: t('sidebar.language', 'en') }))).toBe(
      false,
    )
  })

  it('keeps the conversations this browser drew', () => {
    show({
      history: {
        ...props.history,
        conversations: [
          {
            id: 'c1',
            agent: null,
            title: 'What time is it?',
            updatedAt: Date.now(),
            messages: [],
          },
        ],
      },
    })

    expect(screen.getByRole('button', { name: /What time is it/ })).toBeInTheDocument()
  })
})

/** Spec 027 AC1, AC3 — the rail searches what this browser kept (its screen left in spec 060). */
describe('the rail searches the record', () => {
  const kept = (id: string, title: string, text: string) => ({
    id,
    conversationId: `conv_${id}`,
    agent: null,
    title,
    updatedAt: Date.now(),
    messages: [{ role: 'user' as const, id: `${id}-u`, text }],
  })

  const withHistory = {
    ...props.history,
    conversations: [
      kept('c1', 'Deploying to Container Apps', 'How do I deploy?'),
      kept('c2', 'Delta Lake vacuum', 'What does vacuum do?'),
    ],
  }

  it('narrows the list to what matches, and restores it when the field is cleared', async () => {
    show({ history: withHistory })
    const field = screen.getByLabelText(t('history.search', 'en'))

    await userEvent.type(field, 'vacuum')
    expect(screen.queryByText('Deploying to Container Apps')).toBeNull()
    expect(screen.getByText('Delta Lake vacuum')).toBeInTheDocument()

    await userEvent.clear(field)
    expect(screen.getByText('Deploying to Container Apps')).toBeInTheDocument()
    expect(screen.getByText('Delta Lake vacuum')).toBeInTheDocument()
  })

  it('hides the field when there is nothing kept to search', () => {
    show()
    expect(screen.queryByLabelText(t('history.search', 'en'))).toBeNull()
  })
})
