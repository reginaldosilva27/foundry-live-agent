/**
 * One call, with room to read it (spec 010).
 *
 * The trace panel is a 320px column and an MCP result is a page of documentation. Rather than
 * making the column wider — which would cost the chat the same space on every screen — one call at
 * a time opens here: centred, wide, scrollable, with the payload indented by `formatPayload`.
 *
 * The scrim and the tokens are the voice overlay's, so this is the app's second modal and not its
 * second modal *style*.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useT } from '../i18n/context'
import { useModalFocus } from '../hooks/useModalFocus'
import type { Activity } from '../state/turn'
import { formatPayload } from '../state/payload'
import { formatMs } from './format'
import { CloseIcon } from './Icon'
import { EXECUTOR_TAG } from './labels'

interface Props {
  activity: Activity
  onClose: () => void
}

export function LogViewer({ activity, onClose }: Props) {
  const s = useT()
  const scrim = useRef<HTMLDivElement>(null)
  useModalFocus(scrim)
  const executor = activity.kind === 'tool' ? activity.executor : 'foundry'
  const tag = activity.kind === 'mcp' ? activity.serverLabel : EXECUTOR_TAG[executor]

  // One parse per payload, not one per render: these are large strings.
  const args = useMemo(() => formatPayload(activity.arguments), [activity.arguments])
  const output = useMemo(() => formatPayload(activity.output ?? ''), [activity.output])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="log-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={s('log.title')}
      ref={scrim}
      tabIndex={-1}
    >
      <div className="log-backdrop" data-testid="log-backdrop" onClick={onClose} />

      <section className="log" data-testid="log-viewer" data-executor={executor}>
        <header className="log__head">
          <span className="log__name">{activity.name}</span>
          <span className="log__executor">{tag}</span>
          {activity.kind === 'tool' && activity.durationMs !== undefined && (
            <span className="log__duration">{formatMs(activity.durationMs)}</span>
          )}
          <button
            type="button"
            className="log__close"
            aria-label={s('log.close')}
            onClick={onClose}
          >
            <CloseIcon size={15} />
          </button>
        </header>

        <div className="log__body">
          <h3 className="log__label">{s('tool.arguments')}</h3>
          <pre className="log__payload" data-testid="log-arguments">
            {args}
          </pre>

          {activity.status === 'failed' ? (
            <>
              <h3 className="log__label">{s('tool.failed')}</h3>
              <pre className="log__payload log__payload--error" data-testid="log-error">
                {activity.error}
              </pre>
            </>
          ) : activity.output === undefined ? (
            <p className="log__empty">{s('log.empty')}</p>
          ) : (
            <>
              <h3 className="log__label">{s('tool.result')}</h3>
              <pre className="log__payload" data-testid="log-result">
                {output}
              </pre>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
