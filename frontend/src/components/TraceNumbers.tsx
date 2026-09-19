/**
 * What the run cost, in the panel (spec 014 AC2, AC3).
 *
 * The same figures the chat's `MetaLine` shows, in the surface a reader opens to *compare* runs —
 * where having to close the panel to read the number underneath it was the whole problem.
 *
 * Each figure renders only when the events produced it. A turn mid-stream has no usage, and `0
 * tokens` there would be a measurement rather than an absence (§5).
 *
 * Spec 028 added the money, and put the **rate breakdown right under it**: a figure in a currency
 * reads as a fact, so the panel a reader opens to compare two harnesses has to show that both were
 * priced with the same table, on the same date. Without that the comparison means nothing.
 */
import { useLang, useT } from '../i18n/context'
import { formatMoney, formatMs, modelName } from './format'
import { estimateConversation, estimateTurn, type Pricing } from '../state/cost'
import type { Turn } from '../state/turn'
import type { Trace } from '../types/trace'

interface Props {
  turn: Turn
  model?: string
  latencyMs?: number
  /**
   * The run's spans, when they have been read (spec 005).
   *
   * Where the spans and the event stream disagree, the spans win: they are Foundry's own
   * accounting of the run, and they are more specific — `gpt-5.5-2026-04-24` against a configured
   * `gpt-5.5`, and a prompt-cache figure the stream never reported at all.
   */
  trace?: Trace
  /** The declared rate table, or nothing (spec 028). Most deployments run with nothing. */
  pricing?: Pricing
  /**
   * Every turn of the conversation on screen, for the running total (AC9).
   *
   * The panel is given the turns rather than a number so the partial count is computed where the
   * rates are — one place that knows what could not be priced, and one place to get it wrong.
   */
  conversationTurns?: readonly Turn[]
}

export function TraceNumbers({ turn, model, latencyMs, trace, pricing, conversationTurns }: Props) {
  const s = useT()
  const lang = useLang()
  const spanUsage = trace?.status === 'ok' ? trace.usage : undefined
  const usage = turn.usage
  // Spans still win where the two disagree — they are Foundry's own accounting. But the stream
  // reports the cache now (spec 028), so this cell no longer waits on a workspace most deployments
  // of this repo never configure.
  const cached = spanUsage?.cached_tokens ?? usage?.cachedInputTokens
  const snapshot = (trace?.status === 'ok' && trace.model) || model
  const version = trace?.status === 'ok' ? trace.agent_version : undefined

  const rates = pricing?.rates[model?.includes('/') ? model.slice(model.lastIndexOf('/') + 1) : (model ?? '')]
  const cost = estimateTurn(turn, model, pricing)
  const total = estimateConversation(conversationTurns ?? [], model, pricing)

  return (
    <dl className="trace-numbers" data-testid="trace-numbers">
      {snapshot && (
        <div className="trace-numbers__cell">
          <dt>{s('sidebar.modelLabel')}</dt>
          <dd>{modelName(snapshot)}</dd>
        </div>
      )}
      {version && (
        <div className="trace-numbers__cell">
          <dt>{s('meta.agentVersion')}</dt>
          <dd>{version}</dd>
        </div>
      )}
      {usage && (
        <div className="trace-numbers__cell">
          <dt>{s('meta.tokens')}</dt>
          <dd>{usage.inputTokens + usage.outputTokens}</dd>
        </div>
      )}
      {usage?.reasoningTokens !== undefined && (
        <div className="trace-numbers__cell">
          <dt>{s('meta.reasoningTokens')}</dt>
          <dd>{usage.reasoningTokens}</dd>
        </div>
      )}
      {/* Prompt cache. Omitted rather than shown as zero when nobody reported one — an absent
          measurement is not a measurement of nothing (§5). */}
      {cached !== undefined && (
        <div className="trace-numbers__cell">
          <dt>{s('meta.cachedTokens')}</dt>
          <dd>{cached}</dd>
        </div>
      )}
      {latencyMs !== undefined && (
        <div className="trace-numbers__cell">
          <dt>{s('meta.latency')}</dt>
          <dd>{formatMs(latencyMs)}</dd>
        </div>
      )}

      {cost && (
        <div className="trace-numbers__cell" data-testid="trace-cost">
          <dt>{`${s('cost.turn')} (${s('cost.estimate')})`}</dt>
          <dd>{formatMoney(cost.amount, cost.currency, lang)}</dd>
        </div>
      )}

      {total && (
        <div className="trace-numbers__cell trace-numbers__cell--wide" data-testid="trace-conversation-cost">
          <dt>{`${s('cost.conversation')} (${s('cost.estimate')})`}</dt>
          <dd>{formatMoney(total.amount, total.currency, lang)}</dd>
          {/* A total that swallowed the turns it could not price would be a smaller number
              presented as the whole conversation (§5). */}
          {total.partial && (
            <p className="trace-numbers__partial">
              {s('cost.partial').replace('{count}', String(total.unpriced))}
            </p>
          )}
        </div>
      )}

      {/* Where the figures above came from. Without this a currency symbol is just an assertion. */}
      {rates && pricing && (
        <div className="trace-numbers__cell trace-numbers__cell--wide" data-testid="trace-rates">
          <dt>{s('cost.ratesTitle').replace('{date}', pricing.recorded_at)}</dt>
          <dd className="trace-numbers__rates">
            <span>{`${s('cost.rateInput')} ${formatMoney(rates.input, pricing.currency, lang)}`}</span>
            {rates.cached_input !== undefined && (
              <span>{`${s('cost.rateCachedInput')} ${formatMoney(rates.cached_input, pricing.currency, lang)}`}</span>
            )}
            <span>{`${s('cost.rateOutput')} ${formatMoney(rates.output, pricing.currency, lang)}`}</span>
          </dd>
        </div>
      )}
    </dl>
  )
}
