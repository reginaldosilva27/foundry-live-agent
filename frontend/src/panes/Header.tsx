import { ActivityIcon, MenuIcon } from '../components/Icon'
import { BuildInfo } from '../components/BuildInfo'
import type { DemoState } from '../state/demo'
import { HarnessBadge } from '../components/HarnessBadge'
import { useT } from '../i18n/context'
import type { BffConfig } from '../config'

interface Props {
  config: BffConfig | null
  /** The agent chosen on the agents screen, or `null` for the BFF's configured one (spec 019). */
  selectedAgent: string | null
  /** That agent's harness. Without it the badge kept naming `AGENT_HARNESS` while the other
   *  harness answered — the same lie spec 018 fixed one field over, on `agent_name`. */
  selectedHarness: string | null
  configFailed: boolean
  streaming: boolean
  agentsLoading?: boolean
  agentsUnavailable?: boolean
  eventsOpen?: boolean
  onToggleEvents?: () => void
  tracesOpen: boolean
  demo: DemoState | null
  onToggleTraces: () => void
  /**
   * Open the navigation (spec 047).
   *
   * Rendered at every width and hidden by the stylesheet above the breakpoint, rather than
   * conditionally rendered: the rail is the navigation on a wide screen, so the control would be a
   * duplicate there — but a control that exists only below a width is one `a11y.test.tsx` can never
   * walk, and the whole point of this spec is that a hidden control is an absent one.
   */
  menuOpen?: boolean
  onOpenMenu: () => void
}

export function Header({
  config,
  selectedAgent,
  selectedHarness,
  configFailed,
  streaming,
  tracesOpen,
  agentsLoading = false,
  agentsUnavailable = false,
  eventsOpen = false,
  onToggleEvents,
  demo,
  onToggleTraces,
  menuOpen = false,
  onOpenMenu,
}: Props) {
  const s = useT()

  return (
    <header className="header">
      <button
        type="button"
        className="header__menu"
        aria-label={s('nav.openMenu')}
        aria-expanded={menuOpen}
        aria-controls="navigation-rail"
        title={s('nav.openMenu')}
        onClick={onOpenMenu}
      >
        <MenuIcon size={16} />
      </button>
      <h2 className="header__agent">{selectedAgent ?? config?.agent_name ?? s('app.name')}</h2>
      <span className="header__pill">{s('header.foundryPill')}</span>
      <span className="header__status" data-streaming={streaming}>
        <span className="dot" aria-hidden="true" />
        {streaming ? s('header.statusStreaming')
          : configFailed || agentsUnavailable ? s('header.statusUnavailable')
          : !config || agentsLoading ? s('header.statusLoading') : s('header.status')}
      </span>

      <div className="header__spacer" />

      <BuildInfo config={config} configFailed={configFailed} demo={demo} />

      <HarnessBadge harness={selectedHarness ?? config?.harness} failed={configFailed} />

      <button type="button" className="pill-button" aria-label={s('events.title')}
        aria-pressed={eventsOpen} aria-controls="event-inspector" onClick={onToggleEvents}>
        <ActivityIcon size={14} />
        {s('events.title')}
      </button>

      <button
        type="button"
        className="pill-button"
        aria-pressed={tracesOpen}
        onClick={onToggleTraces}
      >
        <ActivityIcon size={14} />
        {s('header.traces')}
      </button>
    </header>
  )
}
