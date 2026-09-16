/**
 * The 60px header: which agent, running where, on which harness — plus the two toggles.
 *
 * `Voice` is enabled only when the BFF reports that it is configured. A server without a Voice Live
 * endpoint says so through `GET /config`, and the button stays disabled with the reason on it —
 * rather than offering a feature that fails on click.
 */
import { ActivityIcon, MicIcon } from '../components/Icon'
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
}: Props) {
  const s = useT()
  const voiceEnabled = config?.voice?.enabled ?? false

  return (
    <header className="header">
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
