/**
 * The agents screen: which agents the Foundry project has, and which one is answering.
 *
 * Spec 019 put this in the sidebar, in the space the session list used to occupy. Spec 021 moved it
 * here, into the main column, for a reason visible in any screenshot of the old one: ten agents
 * with a kind, a version, a status, a model and a harness do not fit in 248px, and the tenth was
 * being cut in half by the language switch.
 *
 * **Every agent is shown, including the ones this build cannot run.** A workflow agent, a disabled
 * one, a version still provisioning: listed, dimmed and carrying its own reason. Hiding them would
 * make the project look like whatever this app happens to support, and offering them would fail on
 * click — §5 rules out both. The reason arrives as a CODE and is said here, in the reader's
 * language (§7); the BFF ships no prose.
 *
 * Nothing here decides whether a row can be chosen. That depends on which harnesses the build has,
 * which is the BFF's knowledge, and it arrives as `selectable` · `reason` · `harness` (§4).
 */
import { useState } from 'react'
import { HarnessBadge } from '../components/HarnessBadge'
import { InfoIcon, SearchIcon, StarIcon } from '../components/Icon'
import { Monogram } from '../components/Monogram'
import { useLang, useT } from '../i18n/context'
import { t as translate, type StringKey } from '../i18n/strings'
import type { AgentRow } from '../types/agents'

interface Props {
  agents: AgentRow[]
  /** The BFF's failure code, or `null`. Rendered, never swallowed (019 AC3, AC9). */
  error: string | null
  loading: boolean
  /** The agent currently answering: the selection, or the one the BFF is configured with. */
  answering?: string
  /** Named when the listing failed, so the screen still says what the app is talking to (AC9). */
  configuredAgent?: string
  /** The agents this browser keeps to hand (spec 022). Names, resolved here against the listing. */
  favourites: string[]
  onSelect: (name: string) => void
  onFavourite: (name: string) => void
  /**
   * Open the agent's definition (spec 030).
   *
   * A control of its own rather than the card's main action: choosing an agent in one click is
   * spec 019's behaviour and has tests, and inspecting is a different verb — looking at an agent is
   * not talking to it.
   */
  onInspect: (name: string) => void
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
  // Spec 050: this build HAS the harness and the demo has no recording for it — a different fact
  // from `no_harness`, which is why it is a code of its own rather than a reuse.
  demo_not_recorded: 'agents.reason.demo_not_recorded',
}

const ERROR_KEYS: Record<string, StringKey> = {
  unconfigured: 'agents.error.unconfigured',
  forbidden: 'agents.error.forbidden',
  unavailable: 'agents.error.unavailable',
}

export function AgentsScreen({
  agents,
  error,
  loading,
  answering,
  configuredAgent,
  favourites,
  onSelect,
  onFavourite,
  onInspect,
}: Props) {
  const s = useT()
  const lang = useLang()
  const [query, setQuery] = useState('')

  /** A key the service might not have told us about still says something (019 AC5, §5). */
  const label = (map: Record<string, StringKey>, code: string, fallback: StringKey) =>
    translate(map[code] ?? fallback, lang)

  const needle = query.trim().toLowerCase()
  // Name only, and no tidying: a filtered list still shows what it cannot run (§5).
  const shown = needle ? agents.filter((a) => a.name.toLowerCase().includes(needle)) : agents

  return (
    <section className="agents-screen" aria-label={s('agents.title')}>
      <div className="agents-screen__head">
        <div>
          <h2 className="agents-screen__title">{s('agents.title')}</h2>
          <p className="agents-screen__count">
            {s('agents.count').replace('{n}', String(agents.length))}
          </p>
        </div>

        <div className="agents-screen__search">
          <SearchIcon size={16} />
          <input
            type="search"
            value={query}
            className="agents-screen__search-input"
            placeholder={s('agents.searchLabel')}
            aria-label={s('agents.searchLabel')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {loading && <p className="agents-screen__note">{s('agents.loading')}</p>}

      {error && (
        <div className="agents-screen__error" role="status">
          <p className="agents__error">{label(ERROR_KEYS, error, 'agents.error.unavailable')}</p>
          <p className="agents-screen__note">{s('agents.fallback')}</p>
          {configuredAgent && (
            <p className="agents-screen__fallback" data-testid="agents-fallback-row">
              {configuredAgent}
            </p>
          )}
        </div>
      )}

      <ul className="agents-grid">
        {shown.map((agent) => (
          <li key={agent.name}>
            {/* The card is a container, not a control: the star lives inside it and a button cannot
                hold a button. The selectable region below is what 019's criteria are about — listed,
                dimmed, inert, reasoned (spec 022 plan). */}
            <div className="agent-card" data-answering={agent.name === answering}>
              <button
                type="button"
                className="agent-card__star"
                aria-pressed={favourites.includes(agent.name)}
                aria-label={s(
                  favourites.includes(agent.name) ? 'agents.unfavourite' : 'agents.favourite',
                ).replace('{name}', agent.name)}
                onClick={() => onFavourite(agent.name)}
              >
                <StarIcon size={15} filled={favourites.includes(agent.name)} />
              </button>

              {/* Every agent can be inspected, including the ones this build cannot run: what an
                  agent IS does not depend on whether we can drive it (spec 030). */}
              <button
                type="button"
                className="agent-card__inspect"
                title={s('agent.inspect')}
                aria-label={`${s('agent.inspect')}: ${agent.name}`}
                onClick={() => onInspect(agent.name)}
              >
                <InfoIcon size={15} />
              </button>

              <button
                type="button"
                className="agent-card__choose"
                data-agent={agent.name}
                disabled={!agent.selectable}
                aria-pressed={agent.name === answering}
                onClick={() => onSelect(agent.name)}
              >
                <span className="agent-card__head">
                  <Monogram name={agent.name} size={34} />
                  <span className="agent-card__naming">
                    <span className="agent-card__name">{agent.name}</span>
                    <span className="agent-card__meta">
                      <span>{label(KIND_KEYS, agent.kind, 'agents.kind.unknown')}</span>
                      <span>
                        {s('agents.version')
                          .replace('{version}', agent.version)
                          .replace(
                            '{status}',
                            label(STATUS_KEYS, agent.version_status, 'agents.status.unknown'),
                          )}
                      </span>
                    </span>
                  </span>
                </span>

                <span className="agent-card__foot">
                  {agent.model && (
                    <span className="agent-card__model">
                      <span className="agent-card__key">{s('agents.model')}</span>
                      {agent.model}
                    </span>
                  )}
                  <span className="agent-card__badges">
                    {agent.harness && <HarnessBadge harness={agent.harness} failed={false} />}
                    {agent.name === answering && (
                      <span className="agent-card__answering">{s('agents.answeringCard')}</span>
                    )}
                  </span>
                </span>

                {!agent.selectable && (
                  <span className="agent-card__reason">
                    {label(REASON_KEYS, agent.reason, 'agents.reason.unknown')}
                  </span>
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {needle && shown.length === 0 && (
        <p className="agents-screen__note" role="status">
          {s('agents.noMatches')}
        </p>
      )}
    </section>
  )
}
