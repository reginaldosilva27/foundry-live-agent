/**
 * One tool call, rendered so that **who ran it** is impossible to miss.
 *
 * The mock this design comes from drew every tool call the same way (design-system note M6). That
 * is the one thing worth fixing: a `get_current_datetime` the BFF executed and a
 * `microsoft_docs_search` Foundry executed against a remote MCP server are different events, and
 * the difference is the whole of constitution §8.
 *
 * The distinction is carried three ways, deliberately: a mono tag with different text, an accent
 * border in a different token, and a `data-executor` attribute. Colour alone would fail anyone who
 * cannot separate the two hues.
 */
import { useT } from '../i18n/context'
import type { Activity } from '../state/turn'
import { formatMs } from './format'
import { AlertIcon, CheckIcon, SpinnerIcon } from './Icon'
import { EXECUTOR_TAG } from './labels'

interface Props {
  activity: Activity
}

export function ToolCard({ activity }: Props) {
  const s = useT()
  const executor = activity.kind === 'tool' ? activity.executor : 'foundry'
  const tag = activity.kind === 'mcp' ? activity.serverLabel : EXECUTOR_TAG[executor]
  const where =
    activity.kind === 'mcp'
      ? s('tool.mcpServer')
      : executor === 'app'
        ? s('tool.executedHere')
        : s('tool.executedInFoundry')

  return (
    <article
      className="tool-card"
      data-testid="tool-card"
      data-executor={executor}
      data-status={activity.status}
    >
      <header className="tool-card__head">
        <span className="tool-card__status" aria-hidden="true">
          {activity.status === 'running' ? (
            <SpinnerIcon size={14} />
          ) : activity.status === 'failed' ? (
            <AlertIcon size={14} />
          ) : (
            <CheckIcon size={14} />
          )}
        </span>
        <span className="tool-card__name">{activity.name}</span>
        <span className="tool-card__executor" data-testid="executor-tag" title={where}>
          {tag}
        </span>
      </header>

      <dl className="tool-card__body">
        <dt className="tool-card__label">{s('tool.arguments')}</dt>
        <dd className="tool-card__value" data-testid="tool-arguments">
          {activity.arguments}
        </dd>

        {activity.status === 'running' && (
          <dd className="tool-card__running">{s('tool.running')}</dd>
        )}

        {activity.status === 'failed' && activity.error && (
          <>
            <dt className="tool-card__label">{s('tool.failed')}</dt>
            <dd className="tool-card__value tool-card__value--error" data-testid="tool-error">
              {activity.error}
            </dd>
          </>
        )}

        {activity.status === 'ok' && activity.output !== undefined && (
          <>
            <dt className="tool-card__label">{s('tool.result')}</dt>
            <dd className="tool-card__value" data-testid="tool-result">
              {activity.output}
            </dd>
          </>
        )}
      </dl>

      {activity.kind === 'tool' && activity.durationMs !== undefined && (
        <footer className="tool-card__foot" data-testid="tool-duration">
          {formatMs(activity.durationMs)}
        </footer>
      )}
    </article>
  )
}
