/**
 * One call, in one line — the chat's rendering of a tool call (spec 009).
 *
 * The payload is deliberately absent. An MCP search returns a page of documentation, and rendering
 * it between the question and the answer buried the answer. What stays is what the chat exists to
 * teach: that a tool ran, which one, **who executed it**, and whether it worked. The arguments and
 * the result are a press away, in the trace panel.
 *
 * The full card still exists — `ToolCard` — and the voice overlay still uses it, because there is
 * no trace panel beside a voice session.
 */
import { useT } from '../i18n/context'
import type { Activity } from '../state/turn'
import { formatMs } from './format'
import { AlertIcon, CheckIcon, SpinnerIcon } from './Icon'
import { EXECUTOR_TAG } from './labels'

interface Props {
  activity: Activity
  /** Omitted where there is nothing to open — the voice overlay has no trace panel beside it. */
  onOpen?: () => void
}

export function ToolRow({ activity, onOpen }: Props) {
  const s = useT()
  const executor = activity.kind === 'tool' ? activity.executor : 'foundry'
  const tag = activity.kind === 'mcp' ? activity.serverLabel : EXECUTOR_TAG[executor]
  const where =
    activity.kind === 'mcp'
      ? s('tool.mcpServer')
      : executor === 'app'
        ? s('tool.executedHere')
        : s('tool.executedInFoundry')

  // A button only where pressing it does something. In the voice overlay it is a statement, not
  // a control, and a button that opens nothing is a lie told with the cursor.
  const Element = onOpen ? 'button' : 'div'

  return (
    <Element
      type={onOpen ? 'button' : undefined}
      className="tool-row"
      data-testid="tool-row"
      data-executor={executor}
      data-status={activity.status}
      title={onOpen ? s('tool.openInTrace') : undefined}
      onClick={onOpen}
    >
      <span className="tool-row__status" aria-hidden="true">
        {activity.status === 'running' ? (
          <SpinnerIcon size={13} />
        ) : activity.status === 'failed' ? (
          <AlertIcon size={13} />
        ) : (
          <CheckIcon size={13} />
        )}
      </span>
      <span className="tool-row__name">{activity.name}</span>
      <span className="tool-row__executor" data-testid="executor-tag" title={where}>
        {tag}
      </span>
      <span className="tool-row__meta">
        {activity.status === 'running'
          ? s('tool.running')
          : activity.status === 'failed'
            ? s('tool.failed')
            : activity.kind === 'tool' && activity.durationMs !== undefined
              ? formatMs(activity.durationMs)
              : ''}
      </span>
    </Element>
  )
}
