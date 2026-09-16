/**
 * The line under a finished turn: model, tokens, latency, and a way into the trace panel.
 *
 * `temperature` is absent on purpose (design-system note M4). The mock showed it; reasoning models
 * do not take it, and a UI that displays a parameter the platform ignores teaches something false.
 */
import { useT } from '../i18n/context'
import { formatMs, modelName } from './format'
import type { Turn } from '../state/turn'

interface Props {
  turn: Turn
  model?: string
  latencyMs?: number
  onOpenTrace: () => void
}

export function MetaLine({ turn, model, latencyMs, onOpenTrace }: Props) {
  const s = useT()
  const { usage } = turn

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
      {turn.trace && (
        <button type="button" className="meta-line__link" onClick={onOpenTrace}>
          {s('meta.viewTrace')}
        </button>
      )}
    </p>
  )
}
