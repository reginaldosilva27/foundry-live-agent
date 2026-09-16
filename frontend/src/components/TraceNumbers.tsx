/**
 * What the run cost, in the panel (spec 014 AC2, AC3).
 *
 * The same figures the chat's `MetaLine` shows, in the surface a reader opens to *compare* runs —
 * where having to close the panel to read the number underneath it was the whole problem.
 *
 * Each figure renders only when the events produced it. A turn mid-stream has no usage, and `0
 * tokens` there would be a measurement rather than an absence (§5).
 */
import { useT } from '../i18n/context'
import { formatMs, modelName } from './format'
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
}

export function TraceNumbers({ turn, model, latencyMs, trace }: Props) {
  const s = useT()
  const spanUsage = trace?.status === 'ok' ? trace.usage : undefined
  const usage = turn.usage
  const cached = spanUsage?.cached_tokens
  const snapshot = (trace?.status === 'ok' && trace.model) || model
  const version = trace?.status === 'ok' ? trace.agent_version : undefined

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
      {/* Prompt cache, which only the spans report. Omitted rather than shown as zero when they
          do not — an absent measurement is not a measurement of nothing (§5). */}
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
    </dl>
  )
}
