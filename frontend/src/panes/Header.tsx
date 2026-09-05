/**
 * The 60px header: which agent, running where, on which harness — plus the two toggles.
 *
 * `Voice` is present and disabled. Spec 006 builds it; drawing an enabled button for a feature that
 * does nothing would be the same lie as a faked session list.
 */
import { ActivityIcon } from '../components/Icon'
import { HarnessBadge } from '../components/HarnessBadge'
import { useT } from '../i18n/context'
import type { BffConfig } from '../config'

interface Props {
  config: BffConfig | null
  configFailed: boolean
  streaming: boolean
  tracesOpen: boolean
  onToggleTraces: () => void
}

export function Header({ config, configFailed, streaming, tracesOpen, onToggleTraces }: Props) {
  const s = useT()

  return (
    <header className="header">
      <h2 className="header__agent">{config?.agent_name ?? s('app.name')}</h2>
      <span className="header__pill">{s('header.foundryPill')}</span>
      <span className="header__status" data-streaming={streaming}>
        <span className="dot" aria-hidden="true" />
        {streaming ? s('header.statusStreaming') : s('header.status')}
      </span>

      <div className="header__spacer" />

      <HarnessBadge harness={config?.harness} failed={configFailed} />

      <button type="button" className="pill-button" disabled title={s('header.voiceUnavailable')}>
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
