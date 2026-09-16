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

interface Props {
  turn: Turn
  model?: string
  latencyMs?: number
}

export function TraceNumbers({ turn, model, latencyMs }: Props) {
  const s = useT()
  const { usage } = turn

  return (
    <dl className="trace-numbers" data-testid="trace-numbers">
      {model && (
        <div className="trace-numbers__cell">
          <dt>{s('sidebar.modelLabel')}</dt>
          <dd>{modelName(model)}</dd>
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
      {latencyMs !== undefined && (
        <div className="trace-numbers__cell">
          <dt>{s('meta.latency')}</dt>
          <dd>{formatMs(latencyMs)}</dd>
        </div>
      )}
    </dl>
  )
}
