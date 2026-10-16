/**
 * The Playground's Agent tab (spec 060): one agent beside its definition, or — once a person picks
 * a second — one question, two agents, two streams (spec 020).
 *
 * The definition is the agent detail screen's own rendering (`AgentDefinitionBlocks`), read from
 * the same `GET /agents/{name}` it makes, and read-only: Foundry refuses per-request parameters
 * beside an agent reference, and a saved copy is what §4 refuses (spec 041).
 *
 * `docs/harness-comparison.md` is a table, and a table is an argument. This is the demonstration:
 * the same question to both agents at once, each answering into its own column at its own pace,
 * each ending with its own numbers.
 *
 * **It renders no turn of its own.** Each column is the `Conversation` the single-agent view uses,
 * parameterised — the spec's contract section names the alternative and refuses it, because "a
 * second copy of the activity rendering would drift within a release" (§4). So every reasoning
 * card, tool row, source strip and meta line here is the same component, and a change to any of
 * them lands in both places by construction.
 *
 * **It says nothing about which answer is better.** No score, no ranking, no verdict — that is the
 * spec's first non-goal, and it is a short walk from there to the app reading model output, which
 * §8 keeps out. Two columns and a reader who can think.
 *
 * Choosing the second agent is configuration: a **person** picks who answers, exactly as spec 019
 * established. The app choosing would be the violation.
 */
import { HarnessBadge } from '../components/HarnessBadge'
import { AgentDefinitionBlocks } from './AgentDetail'
import { Monogram } from '../components/Monogram'
import { useT } from '../i18n/context'
import type { Comparison } from '../hooks/useComparison'
import type { AgentStream } from '../hooks/useAgentStream'
import type { Pricing } from '../state/cost'
import type { AgentDetail, AgentRow } from '../types/agents'
import { Composer } from './Composer'
import { Conversation } from './Conversation'

interface Props {
  comparison: Comparison
  /** The spec 019 listing. The rows say which agents this build can drive; nothing here re-decides. */
  agents: AgentRow[]
  /** Who the left column asks — the app's selection, or the BFF's configured agent. */
  first?: string
  model?: string
  pricing?: Pricing
  /** The BFF's bound on a message (spec 062); both columns post the same text. */
  maxChars?: number
  reasoningOpen?: boolean
  /** Open the trace panel on a turn of either column (AC7). Ids are prefixed, so they cannot clash. */
  onOpenTrace: (turnId: string, callId?: string) => void
  /** The answering agent's definition, from the detail read; `null` while it has not arrived. */
  definition: AgentDetail | null
  onOpenDetail: (name: string) => void
}

export function PlaygroundAgent({
  comparison,
  agents,
  first,
  model,
  pricing,
  maxChars,
  reasoningOpen,
  onOpenTrace,
  definition,
  onOpenDetail,
}: Props) {
  const s = useT()
  const { left, right, other, choose, streaming, send, stop } = comparison
  const asked = left.messages.length > 0 || right.messages.length > 0

  const harnessOf = (name?: string) => agents.find((agent) => agent.name === name)?.harness

  return (
    <div className="playground-agent">
      <aside className="playground-agent__definition" aria-label={s('playground.definition')}>
        <header className="playground-agent__definition-head">
          <Monogram name={first ?? ''} size={28} />
          <div className="playground-agent__naming">
            <h2 className="playground-agent__name">{first ?? s('playground.noAgent')}</h2>
            {definition?.model && <p className="playground-agent__model">{definition.model}</p>}
          </div>
        </header>
        <p className="playground-agent__note">{s('playground.readOnly')}</p>
        {definition && <AgentDefinitionBlocks agent={definition} />}
        {first && (
          <button type="button" className="pill-button" onClick={() => onOpenDetail(first)}>
            {s('playground.openDetail')}
          </button>
        )}
      </aside>

      <section className="compare" aria-label={s('playground.tab.agent')}>
        <header className="compare__head">
          <label className="compare__pick">
            <span className="compare__pick-label">{s('compare.with')}</span>
            <select
              className="compare__select"
              value={other ?? ''}
              disabled={streaming}
              aria-describedby={streaming ? 'comparison-lock' : undefined}
              onChange={(event) => choose(event.target.value || null)}
            >
              <option value="">{s('compare.pick')}</option>
              {/* Every agent the BFF said it can drive, and no further rule. Two of the same kind is
                  the useful everyday comparison, and filtering the pair would be code written to
                  remove a capability (AC11). */}
              {agents
                .filter((agent) => agent.selectable)
                .map((agent) => (
                  <option key={agent.name} value={agent.name}>
                    {agent.name}
                  </option>
                ))}
            </select>
          </label>
          <button type="button" className="pill-button" disabled={streaming || !asked}
            aria-describedby="compare-reset-scope" onClick={comparison.reset}>
            {s('compare.reset')}
          </button>
          {other && <p className="compare__lead">{s('compare.independent')}</p>}
          <p className="compare__lead compare__lead--quiet" id="compare-reset-scope">{s('compare.resetScope')}</p>
          {streaming && <p className="compare__lead" id="comparison-lock">{s('compare.locked')}</p>}
        </header>

        {asked && (
          <div className="compare__columns" data-columns={other ? 2 : 1}>
            <Column
              stream={left}
              agent={first}
              harness={harnessOf(first)}
              model={model}
              pricing={pricing}
              reasoningOpen={reasoningOpen}
              onOpenTrace={onOpenTrace}
            />
            {other && (
              <Column
                stream={right}
                agent={other}
                harness={harnessOf(other)}
                model={model}
                pricing={pricing}
                reasoningOpen={reasoningOpen}
                onOpenTrace={onOpenTrace}
              />
            )}
          </div>
        )}

        <Composer
          streaming={streaming}
          onStop={stop}
          // Two spoken answers at once are not a feature, and the reason is said rather than left as
          // a dead control (AC13).
          voiceEnabled={false}
          voiceReason={s('compare.voiceUnavailable')}
          onSend={(text) => send(text, first)}
          onVoice={() => {}}
          maxChars={maxChars}
        />
      </section>
    </div>
  )
}

/**
 * One agent's column: who is answering, and their conversation.
 *
 * A `region` with the agent's name, so a screen reader moving between them is told which is which
 * — two unlabelled columns of near-identical structure are the case where that matters most.
 */
function Column({
  stream,
  agent,
  harness,
  model,
  pricing,
  reasoningOpen,
  onOpenTrace,
}: {
  stream: AgentStream
  agent?: string
  harness?: string
  model?: string
  pricing?: Pricing
  reasoningOpen?: boolean
  onOpenTrace: (turnId: string, callId?: string) => void
}) {
  const s = useT()

  return (
    <section
      className="compare__column"
      data-testid="compare-column"
      aria-label={s('compare.column').replace('{agent}', agent ?? '')}
    >
      <header className="compare__column-head">
        <Monogram name={agent ?? ''} size={22} />
        <span className="compare__column-name">{agent}</span>
        <HarnessBadge harness={harness} failed={false} />
      </header>

      <Conversation
        messages={stream.messages}
        model={model}
        agent={agent}
        pricing={pricing}
        reasoningOpen={reasoningOpen}
        harness={harness}
        // The composer below asks both columns; a per-column send would ask one, which is the
        // sequential comparison this screen replaces. So repeat and edit are **absent**, not
        // no-ops: asking again here would have to ask both, which is what the composer does, and a
        // control wired to nothing is worse than a control that is not there.
        onSuggestion={() => {}}
        onOpenTrace={onOpenTrace}
        streaming={stream.streaming}
      />
    </section>
  )
}
