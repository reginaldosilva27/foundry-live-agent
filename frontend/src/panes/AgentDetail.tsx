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

export function AgentDetailScreen({ agent, error, loading, answering, onSelect, onBack }: Props) {
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
