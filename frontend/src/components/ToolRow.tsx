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
 *
 * **The columns are fixed** (spec 014 AC9). Laid out as flex, the executor tag started at a
 * different x on every row, and the column that carries the whole of §8 — who ran this — was the
 * one the eye could not scan. Three surfaces render this component, so the grid is declared once.
 */
import { useT } from '../i18n/context'
import type { Activity } from '../state/turn'
import { formatMs } from './format'
import { AlertIcon, CheckIcon, SpinnerIcon } from './Icon'
import { EXECUTOR_TAG } from './labels'

interface Props {
  activity: Activity
  /**
   * This call's duration as a fraction of the longest in the same turn, for the bar (spec 014 AC6).
   *
   * Omitted where there is nothing to compare against — the voice overlay shows calls one at a
   * time — and a row without it draws no bar at all. It is a ratio and not a duration on purpose:
   * the comparison is the caller's to make, because only the caller can see the whole turn.
   */
  durationRatio?: number
  /**
   * The duration Foundry's span reports for this call (spec 005 AC17).
   *
   * An MCP call arrives already finished, so the event stream carries no duration for it — but the
   * `execute_tool` span does. Given one, the row stops saying it has none.
   */
  spanDurationMs?: number
  /** Omitted where there is nothing to open — the voice overlay has no trace panel beside it. */
  onOpen?: () => void
}

export function ToolRow({ activity, durationRatio, spanDurationMs, onOpen }: Props) {
  const s = useT()
  const executor = activity.kind === 'tool' ? activity.executor : 'foundry'
  const tag = activity.kind === 'mcp' ? activity.serverLabel : EXECUTOR_TAG[executor]
  const where =
    activity.kind === 'mcp'
      ? s('tool.mcpServer')
      : executor === 'app'
        ? s('tool.executedHere')
        : s('tool.executedInFoundry')

  const duration = (activity.kind === 'tool' ? activity.durationMs : undefined) ?? spanDurationMs
  const bar = duration !== undefined && durationRatio !== undefined

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
      <span className="tool-row__meta" title={duration === undefined ? s('tool.noDuration') : undefined}>
        {activity.status === 'running'
          ? s('tool.running')
          : activity.status === 'failed'
            ? s('tool.failed')
            : duration !== undefined
              ? // A span's duration is a float; the row is a place for a number, not a measurement.
                formatMs(Math.round(duration))
              : ''}
      </span>

      {/* The bar's only claim is "this call took this much of the longest one". It is given no
          axis, no gridline and no start offset, because the events carry durations and not a
          clock — a timeline drawn from these numbers would be invented (§5). The span tree in the
          trace panel is the one with a real axis, because spans carry offsets (spec 005). */}
      {bar && (
        <span
          className="tool-row__bar"
          data-testid="tool-bar"
          aria-hidden="true"
          style={{ '--bar': `${Math.round(durationRatio * 100)}%` } as React.CSSProperties}
        />
      )}

      {/* Foundry runs an MCP call to completion before telling us, so there is no duration to
          show. Said in the row rather than left as a blank column. */}
      {duration === undefined && activity.status !== 'running' && (
        <span className="tool-row__nobar">{s('tool.noDuration')}</span>
      )}
    </Element>
  )
}
