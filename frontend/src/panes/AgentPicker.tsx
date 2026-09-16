/**
 * The agents panel: which agents the Foundry project has, and which one is answering (spec 019).
 *
 * It replaces the sidebar's Sessions section, which had nothing to say — there is nowhere to
 * persist a conversation to, so it carried one honest note admitting it. This says something real,
 * read from the project rather than written here.
 *
 * **Every row is shown, including the ones this build cannot run.** A workflow agent, a disabled
 * one, a version still provisioning: listed, dimmed and carrying its own reason. Hiding them would
 * make the project look like whatever this app happens to support, and offering them would fail on
 * click — §5 rules out both. The reason arrives as a CODE and is said here, in the reader's
 * language (§7); the BFF ships no prose.
 */
import { useT } from '../i18n/context'
import { t as translate } from '../i18n/strings'
import type { StringKey } from '../i18n/strings'
import { useLang } from '../i18n/context'
import type { AgentRow } from '../types/agents'

interface Props {
  agents: AgentRow[]
  /** The BFF's failure code, or `null`. Rendered, never swallowed (AC3, AC9). */
  error: string | null
  loading: boolean
  /** The agent currently answering: the selection, or the one the BFF is configured with. */
  answering?: string
  /** The agent the last selection switched to, so the panel can say a conversation restarted. */
  switched: string | null
  /** Named when the listing failed, so the panel still says what the app is talking to (AC9). */
  configuredAgent?: string
  onSelect: (name: string) => void
}

const KIND_KEYS: Record<string, StringKey> = {
  prompt: 'agents.kind.prompt',
  hosted: 'agents.kind.hosted',
  workflow: 'agents.kind.workflow',
}

const STATUS_KEYS: Record<string, StringKey> = {
  active: 'agents.status.active',
  creating: 'agents.status.creating',
  failed: 'agents.status.failed',
  deleting: 'agents.status.deleting',
}

const REASON_KEYS: Record<string, StringKey> = {
  no_harness: 'agents.reason.no_harness',
  disabled: 'agents.reason.disabled',
  version_not_active: 'agents.reason.version_not_active',
}

const ERROR_KEYS: Record<string, StringKey> = {
  unconfigured: 'agents.error.unconfigured',
  forbidden: 'agents.error.forbidden',
  unavailable: 'agents.error.unavailable',
}

export function AgentPicker({
  agents,
  error,
  loading,
  answering,
  switched,
  configuredAgent,
  onSelect,
}: Props) {
  const s = useT()
  const lang = useLang()

  /** A key the service might not have told us about still says something (AC5, §5). */
  const label = (map: Record<string, StringKey>, code: string, fallback: StringKey) =>
    translate(map[code] ?? fallback, lang)

  return (
    <div className="sidebar__section agents">
      <p className="sidebar__section-title">{s('agents.title')}</p>

      {loading && <p className="sidebar__note">{s('agents.loading')}</p>}

      {error && (
        <>
          <p className="agents__error">{label(ERROR_KEYS, error, 'agents.error.unavailable')}</p>
          <p className="sidebar__note">{s('agents.fallback')}</p>
          {configuredAgent && (
            <p className="sidebar__session" data-testid="agents-fallback-row">
              {configuredAgent}
            </p>
          )}
        </>
      )}

      <ul className="agents__list">
        {agents.map((agent) => (
          <li key={agent.name}>
            <button
              type="button"
              className="agents__row"
              data-agent={agent.name}
              disabled={!agent.selectable}
              aria-pressed={agent.name === answering}
              onClick={() => onSelect(agent.name)}
            >
              <span className="agents__name">{agent.name}</span>
              {agent.name === answering && (
                <span className="agents__answering">{s('agents.answering')}</span>
              )}
              <span className="agents__meta">
                <span className="agents__kind">
                  {label(KIND_KEYS, agent.kind, 'agents.kind.unknown')}
                </span>
                <span className="agents__version">
                  {s('agents.version')
                    .replace('{version}', agent.version)
                    .replace(
                      '{status}',
                      label(STATUS_KEYS, agent.version_status, 'agents.status.unknown'),
                    )}
                </span>
              </span>
              {!agent.selectable && (
                <span className="agents__reason">
                  {label(REASON_KEYS, agent.reason, 'agents.reason.unknown')}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {switched && (
        <p className="agents__switched" role="status">
          {s('agents.switched').replace('{name}', switched)}
        </p>
      )}
    </div>
  )
}
