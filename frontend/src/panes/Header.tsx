/**
 * The 60px header: which agent, running where, on which harness — plus the two toggles.
 *
 * `Voice` is enabled only when the BFF reports that it is configured. A server without a Voice Live
 * endpoint says so through `GET /config`, and the button stays disabled with the reason on it —
 * rather than offering a feature that fails on click.
 */
import { ActivityIcon, MenuIcon, MicIcon } from '../components/Icon'
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
  tracesOpen: boolean
  voiceLive: boolean
  onToggleTraces: () => void
  onVoice: () => void
  /**
   * Open the navigation (spec 047).
   *
   * Rendered at every width and hidden by the stylesheet above the breakpoint, rather than
   * conditionally rendered: the rail is the navigation on a wide screen, so the control would be a
   * duplicate there — but a control that exists only below a width is one `a11y.test.tsx` can never
   * walk, and the whole point of this spec is that a hidden control is an absent one.
   */
  onOpenMenu: () => void
}

export function Header({
  config,
  selectedAgent,
  selectedHarness,
  configFailed,
  streaming,
  tracesOpen,
  voiceLive,
  onToggleTraces,
  onVoice,
  onOpenMenu,
}: Props) {
  const s = useT()
  const voiceEnabled = config?.voice?.enabled ?? false

  return (
    <header className="header">
      <button
        type="button"
        className="header__menu"
        aria-label={s('nav.openMenu')}
        title={s('nav.openMenu')}
        onClick={onOpenMenu}
      >
        <MenuIcon size={16} />
      </button>
      <h2 className="header__agent">{selectedAgent ?? config?.agent_name ?? s('app.name')}</h2>
      <span className="header__pill">{s('header.foundryPill')}</span>
      <span className="header__status" data-streaming={streaming}>
        <span className="dot" aria-hidden="true" />
        {streaming ? s('header.statusStreaming') : s('header.status')}
      </span>

      <div className="header__spacer" />

      <HarnessBadge harness={selectedHarness ?? config?.harness} failed={configFailed} />

      <button
        type="button"
        className="pill-button"
        aria-pressed={voiceLive}
        disabled={!voiceEnabled}
        title={voiceEnabled ? undefined : s('header.voiceUnavailable')}
        onClick={onVoice}
      >
        <MicIcon size={14} />
        {s('header.voice')}
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
