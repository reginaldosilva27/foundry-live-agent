/**
 * One agent, inspected (spec 030).
 *
 * The agents screen answers *which agents exist*; this answers *what this one is*. Everything on it
 * comes from `GET /agents/{name}`, which is the project's own listing projected once more — so the
 * eight agents in this project that have nothing to do with this repository render exactly like the
 * two that do. **Nothing is filled in from our YAML**: showing the repository's intention as if it
 * were the deployment's state is the §5 failure this screen exists to avoid.
 *
 * `null` and `''` are kept apart on purpose and it is the subtlest thing here. `null` means *the
 * service did not report this*; `''` means *the service reported nothing in it*. Five of the ten
 * recorded agents genuinely have empty instructions — a fact about those agents — while a hosted
 * agent has no instructions key at all, which is a fact about hosted agents.
 *
 * **Instructions are rendered as text, never as Markdown.** They were written by somebody else for
 * eight of these ten agents, and this screen is a viewer, not a renderer of other people's markup.
 */
import { useState } from 'react'
import { HarnessBadge } from '../components/HarnessBadge'
import { CopyIcon } from '../components/Icon'
import { Monogram } from '../components/Monogram'
import { useCopy } from '../hooks/useCopy'
import { useT } from '../i18n/context'
import type { StringKey } from '../i18n/strings'
import type { AgentDetail, AgentTool } from '../types/agents'

interface Props {
  agent: AgentDetail | null
  /** A failure CODE, translated here. The BFF ships no prose (§7). */
  error: string | null
  loading: boolean
  /** The agent currently answering, so this screen can say when it is this one. */
  answering?: string
  onSelect: (name: string) => void
  onBack: () => void
  /**
   * Whether this deployment may change which version the project serves (spec 031, AC9).
   *
   * From `GET /config`, never inferred: a control this build cannot honour must not render at all,
   * which is §5 applied to a button. Defaults to `false` so a caller that has not read the config
   * yet shows nothing rather than something that will fail.
   */
  canPromote?: boolean
  /** The version currently being promoted, so the control can be busy and refuse a second press. */
  promoting?: string | null
  /** A failure CODE from the last attempt, translated here. */
  promoteError?: string | null
  onPromote?: (version: string) => void
}

/** Shared with the listing, so a failure says the same thing on both screens (§4). */
const ERROR_KEYS: Record<string, StringKey> = {
  unknown_agent: 'agent.notFound',
  unavailable: 'agents.error.unavailable',
  unconfigured: 'agents.error.unconfigured',
  forbidden: 'agents.error.forbidden',
}

const KIND_KEYS: Record<string, StringKey> = {
  prompt: 'agents.kind.prompt',
  hosted: 'agents.kind.hosted',
  workflow: 'agents.kind.workflow',
}

const EXECUTOR_KEYS: Record<string, StringKey> = {
  app: 'agent.executedByApp',
  foundry: 'agent.executedByFoundry',
}

export function AgentDetailScreen({
  agent,
  error,
  loading,
  answering,
  onSelect,
  onBack,
  canPromote = false,
  promoting = null,
  promoteError = null,
  onPromote,
}: Props) {
  const s = useT()

  if (loading) return <section className="agent-detail" aria-busy="true" />

  if (!agent) {
    // A failure is never an empty detail (AC8, and spec 019 AC3's rule).
    return (
      <section className="agent-detail">
        <Back onBack={onBack} />
        <p className="agent-detail__error">
          {s(ERROR_KEYS[error ?? 'unavailable'] ?? 'agents.error.unavailable')}
        </p>
      </section>
    )
  }

  return (
    <section className="agent-detail" aria-label={agent.name}>
      <Back onBack={onBack} />

      <header className="agent-detail__head">
        <Monogram name={agent.name} size={40} />
        <div className="agent-detail__naming">
          <h2 className="agent-detail__name">{agent.name}</h2>
          <p className="agent-detail__meta">
            <span>{s(KIND_KEYS[agent.kind] ?? 'agents.kind.unknown')}</span>
            <span>
              {s('agents.version')
                .replace('{version}', agent.version)
                .replace('{status}', agent.version_status)}
            </span>
            {agent.model && <span>{agent.model}</span>}
            {agent.harness && <HarnessBadge harness={agent.harness} failed={false} />}
          </p>
        </div>
        <button
          type="button"
          className="agent-detail__choose"
          disabled={!agent.selectable}
          aria-pressed={agent.name === answering}
          onClick={() => onSelect(agent.name)}
        >
          {s('agent.choose')}
        </button>
      </header>

      <Block title={s('agent.instructions')} testId="agent-instructions">
        {agent.instructions === null ? (
          <NotReported />
        ) : (
          <>
            <Copy value={agent.instructions} />
            <pre className="agent-detail__instructions">{agent.instructions}</pre>
          </>
        )}
      </Block>

      <Block title={s('agent.tools')} testId="agent-tools">
        {agent.tools === null ? <NotReported /> : <Tools tools={agent.tools} />}
      </Block>

      {/* Absent when nobody configured it, which is the ordinary case: two of the ten recorded
          agents report it. This is where a reader learns why a reasoning card is empty (spec 015). */}
      {agent.reasoning && (
        <Block title={s('agent.reasoning')} testId="agent-reasoning">
          <dl className="agent-detail__pairs">
            {Object.entries(agent.reasoning).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </Block>
      )}

      <Block title={s('versions.title')} testId="agent-versions">
        <Versions
          agent={agent}
          canPromote={canPromote}
          promoting={promoting}
          promoteError={promoteError}
          onPromote={onPromote}
        />
      </Block>

      {/* What a hosted agent IS: it has no instructions, tools or model of its own. Its environment
          is not here because it is not sent — see `ContainerInfo` (AC11). */}
      {agent.container && (
        <Block title={s('agent.container')} testId="agent-container">
          <dl className="agent-detail__pairs">
            <div>
              <dt>{s('agent.image')}</dt>
              <dd className="agent-detail__image">{agent.container.image}</dd>
            </div>
            <div>
              <dt>{s('agent.cpu')}</dt>
              <dd>{agent.container.cpu}</dd>
            </div>
            <div>
              <dt>{s('agent.memory')}</dt>
              <dd>{agent.container.memory}</dd>
            </div>
            <div>
              <dt>{s('agent.protocols')}</dt>
              <dd>{agent.container.protocols.join(' · ')}</dd>
            </div>
          </dl>
        </Block>
      )}
    </section>
  )
}

function Back({ onBack }: { onBack: () => void }) {
  const s = useT()
  return (
    <button type="button" className="agent-detail__back" onClick={onBack}>
      {s('agent.back')}
    </button>
  )
}

function Block({
  title,
  testId,
  children,
}: {
  title: string
  testId: string
  children: React.ReactNode
}) {
  return (
    <section className="agent-detail__block" data-testid={testId}>
      <h3 className="agent-detail__subtitle">{title}</h3>
      {children}
    </section>
  )
}

/**
 * A copy control for a block of text.
 *
 * Not `CopyRow`, which prints its value beside the button: that is right for a 12px identifier and
 * wrong for two thousand characters of instructions, which are already in the `<pre>` below. The
 * clipboard call is still `useCopy`, so "copied" means the same thing here as everywhere (§4).
 */
function Copy({ value }: { value: string }) {
  const s = useT()
  const { state, copy } = useCopy()

  return (
    <span className="agent-detail__copy">
      <button
        type="button"
        className="agent-detail__copy-button"
        title={s('answer.copy')}
        aria-label={s('answer.copy')}
        onClick={() => copy(value)}
      >
        <CopyIcon size={14} />
      </button>
      {state !== 'idle' && (
        <span role="status">{s(state === 'copied' ? 'copy.copied' : 'copy.failed')}</span>
      )}
    </span>
  )
}

function NotReported() {
  const s = useT()
  return <p className="agent-detail__absent">{s('agent.notReported')}</p>
}

/**
 * The tools, each saying who runs it.
 *
 * That attribution is the project's central lesson and it arrives from the BFF: function calling is
 * client-side execution by definition, and an MCP server is Foundry's to call. Deriving it here
 * would give the rule a second home (§4).
 */
function Tools({ tools }: { tools: AgentTool[] }) {
  const s = useT()
  if (tools.length === 0) return null

  return (
    <ul className="agent-detail__tools">
      {tools.map((tool) => (
        <li key={tool.name} className="agent-detail__tool" data-testid={`agent-tool-${tool.name}`}>
          <p className="agent-detail__tool-head">
            <span className="agent-detail__tool-name">{tool.name}</span>
            <span className="agent-detail__tool-kind">{tool.kind}</span>
            <span className="agent-detail__tool-executor">
              {s(EXECUTOR_KEYS[tool.executor] ?? 'agent.executedByFoundry')}
            </span>
          </p>

          {tool.description && <p className="agent-detail__tool-note">{tool.description}</p>}

          {tool.kind === 'mcp' ? (
            <dl className="agent-detail__pairs">
              <div>
                <dt>{tool.server_label}</dt>
                <dd>{tool.server_url}</dd>
              </div>
              <div>
                <dt>{s('agent.approval')}</dt>
                <dd>{tool.require_approval}</dd>
              </div>
            </dl>
          ) : (
            tool.parameters !== null && (
              <>
                <p className="agent-detail__tool-head">
                  <span className="agent-detail__tool-kind">{s('agent.schema')}</span>
                  <Copy value={tool.parameters} />
                </p>
                <pre className="agent-detail__schema">{tool.parameters}</pre>
              </>
            )
          )}
        </li>
      ))}
    </ul>
  )
}


/** Codes a version row can carry instead of a control. Translated here — the BFF ships none (§7). */
const PROMOTE_REASON_KEYS: Record<string, StringKey> = {
  served: 'versions.reason.served',
  not_owned: 'versions.reason.not_owned',
}

const PROMOTE_ERROR_KEYS: Record<string, StringKey> = {
  write_disabled: 'versions.error.write_disabled',
  not_owned: 'versions.error.not_owned',
  forbidden: 'versions.error.forbidden',
  unknown_version: 'versions.error.unknown_version',
  unavailable: 'versions.error.unavailable',
}

/**
 * The agent's versions, and the way back to one (spec 031).
 *
 * **The rollback story, demonstrated.** `apply_agent.py` creates an immutable version on every run
 * and has always said that is the rollback story; until this screen existed, the story was told and
 * never shown.
 *
 * Three things here are deliberate. A version the service reported nothing about renders as *not
 * reported*, never as healthy. A pinned project says so out loud, because "serving 6, newest is 8"
 * is a surprising state nobody should have to infer from two numbers. And the control is absent —
 * not disabled — when this build cannot write, since a button that will always fail teaches the
 * reader something false (§5).
 */
function Versions({
  agent,
  canPromote,
  promoting,
  promoteError,
  onPromote,
}: {
  agent: AgentDetail
  canPromote: boolean
  promoting: string | null
  promoteError: string | null
  onPromote?: (version: string) => void
}) {
  const s = useT()
  // Which version the confirmation is asking about. Local, because a question nobody answered yet
  // is not state anything else in the app has any business knowing.
  const [asking, setAsking] = useState<string | null>(null)

  // `== null` on purpose: `null` is the BFF saying it did not read them, and `undefined` is a BFF
  // older than spec 031 that does not send the field at all. Both mean "not reported", and neither
  // may take down a screen that worked perfectly well before this section existed.
  if (agent.versions == null)
    return <p className="agent-detail__absent">{s('versions.none')}</p>

  return (
    <>
      {agent.pinned && (
        <p className="agent-detail__pinned">
          {s('versions.pinned')
            .replace('{version}', agent.served_version)
            .replace('{latest}', agent.latest_version)}
        </p>
      )}

      {promoteError && (
        <p className="agent-detail__error" role="alert">
          {s(PROMOTE_ERROR_KEYS[promoteError] ?? 'versions.error.unavailable')}
        </p>
      )}

      <ul className="agent-detail__versions">
        {agent.versions.map((version) => (
          <li
            key={version.version}
            className="agent-detail__version"
            data-testid={`agent-version-${version.version}`}
          >
            <p className="agent-detail__version-head">
              <span className="agent-detail__version-name">{version.version}</span>
              <span className="agent-detail__version-status">
                {version.status === null ? s('versions.notReported') : s(statusKey(version.status))}
              </span>
              {version.served && (
                <span className="agent-detail__version-served">{s('versions.served')}</span>
              )}
            </p>

            <p className="agent-detail__version-meta">
              <span>{version.model === null ? s('versions.notReported') : version.model}</span>
              {version.created_at !== null && (
                <span>{s('versions.created').replace('{when}', when(version.created_at))}</span>
              )}
            </p>

            {promoting === version.version ? (
              <p className="agent-detail__version-busy" role="status">
                {s('versions.promoting')}
              </p>
            ) : (
              canPromote &&
              (version.promotable ? (
                <button
                  type="button"
                  className="agent-detail__promote"
                  disabled={promoting !== null}
                  onClick={() => setAsking(version.version)}
                >
                  {s('versions.promote')}
                </button>
              ) : (
                <p className="agent-detail__version-why">
                  {s(PROMOTE_REASON_KEYS[version.promote_reason] ?? 'versions.reason.served')}
                </p>
              ))
            )}
          </li>
        ))}
      </ul>

      {asking !== null && (
        <Confirm
          version={asking}
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            setAsking(null)
            onPromote?.(asking)
          }}
        />
      )}
    </>
  )
}

/**
 * The confirmation, which exists for one sentence.
 *
 * Every other persistent thing in this app is local to this browser — the history, the favourites,
 * the collapsed rail. This one changes what the project serves for **everyone**, and a reader who
 * has only ever seen the local ones has no reason to expect that. So the body says it, and says
 * that it applies from the next turn (AC4).
 */
function Confirm({
  version,
  onCancel,
  onConfirm,
}: {
  version: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const s = useT()

  return (
    <div className="agent-detail__confirm" role="dialog" aria-modal="true">
      <p className="agent-detail__confirm-title">
        {s('versions.confirm.title').replace('{version}', version)}
      </p>
      <p className="agent-detail__confirm-body">{s('versions.confirm.body')}</p>
      <p className="agent-detail__confirm-actions">
        <button type="button" onClick={onConfirm}>
          {s('versions.confirm.ok')}
        </button>
        <button type="button" onClick={onCancel}>
          {s('versions.confirm.cancel')}
        </button>
      </p>
    </div>
  )
}

/** The documented statuses, and an honest fallback for one the service adds later. */
function statusKey(status: string): StringKey {
  const known: Record<string, StringKey> = {
    active: 'agents.status.active',
    creating: 'agents.status.creating',
    failed: 'agents.status.failed',
    deleting: 'agents.status.deleting',
  }
  return known[status] ?? 'agents.status.unknown'
}

/** The service's Unix seconds, in the reader's own locale. Formatting is a §7 concern. */
function when(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString()
}
