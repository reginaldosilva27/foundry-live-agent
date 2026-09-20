/**
 * The line under a finished turn: model, tokens, latency, and a way into the trace panel.
 *
 * `temperature` is absent on purpose (design-system note M4). The mock showed it; reasoning models
 * do not take it, and a UI that displays a parameter the platform ignores teaches something false.
 *
 * The cost is an **estimate and says so inside the figure** (spec 028), not in a footnote a reader
 * can miss. It is absent — never zero — when there is no usage, no rate for the model, or no rate
 * table at all, because `$0.00` claims a turn was free and "we do not know" is a different claim.
 */
import { useLang, useT } from '../i18n/context'
import { formatMoney, formatMs, modelName } from './format'
import { estimateTurn, type Pricing } from '../state/cost'
import type { Turn } from '../state/turn'

interface Props {
  turn: Turn
  model?: string
  latencyMs?: number
  /**
   * How long before the first token of the answer arrived (spec 020 AC4).
   *
   * Absent when the turn produced no text, and rendered as nothing rather than as `0 ms`, which
   * would say the answer began instantly (§5).
   */
  firstTokenMs?: number
  /** The declared rate table, or nothing. Most deployments of this repo run with nothing. */
  pricing?: Pricing
  /**
   * Which harness answered this turn (spec 028 AC11).
   *
   * Only the hosted one bills container compute, and only it carries the sentence saying this
   * figure excludes it. Absent means the agents listing has not arrived — the sentence is then
   * omitted rather than guessed, because guessing it wrong is the misreading it exists to prevent.
   */
  harness?: string
  onOpenTrace: () => void
}

/** The harness whose cost model includes compute this app cannot measure. */
const BILLS_CONTAINER_COMPUTE = 'langgraph'

export function MetaLine({
  turn,
  model,
  latencyMs,
  firstTokenMs,
  pricing,
  harness,
  onOpenTrace,
}: Props) {
  const s = useT()
  const lang = useLang()
  const { usage } = turn
  const cost = estimateTurn(turn, model, pricing)

  return (
    <p className="meta-line" data-testid="meta-line">
      {model && <span className="meta-line__item">{modelName(model)}</span>}
      {usage && (
        <span className="meta-line__item">
          {`${usage.inputTokens + usage.outputTokens} ${s('meta.tokens')}`}
        </span>
      )}
      {usage?.reasoningTokens !== undefined && (
        <span className="meta-line__item">
          {`${usage.reasoningTokens} ${s('meta.reasoningTokens')}`}
        </span>
      )}
      {latencyMs !== undefined && <span className="meta-line__item">{formatMs(latencyMs)}</span>}

      {/* Labelled, where the total is not — and AFTER it. Rendered first, the line read
          `820 ms to first token 4.2 s`, with the label between the two numbers and no way to tell
          which it belonged to. The bare number has always been the total; the labelled one follows
          it, so each reads with the words on its own side. */}
      {firstTokenMs !== undefined && (
        <span className="meta-line__item" data-testid="first-token">
          {`${formatMs(firstTokenMs)} ${s('meta.firstToken')}`}
        </span>
      )}

      {/* The qualifier is part of how the figure is written, not a note under it (AC2). */}
      {cost && (
        <span className="meta-line__item meta-line__cost" data-testid="turn-cost">
          {`${formatMoney(cost.amount, cost.currency, lang)} ${s('cost.estimate')}`}
        </span>
      )}

      {turn.trace && (
        <button type="button" className="meta-line__link" onClick={onOpenTrace}>
          {s('meta.viewTrace')}
        </button>
      )}

      {/* Said once, and only where it is true: the prompt agent has no container to bill, so the
          same sentence under its turn would be noise that makes the comparison harder, not
          honester (AC11). */}
      {cost && harness === BILLS_CONTAINER_COMPUTE && (
        <span className="meta-line__excludes">{s('cost.excludesContainer')}</span>
      )}
    </p>
  )
}
