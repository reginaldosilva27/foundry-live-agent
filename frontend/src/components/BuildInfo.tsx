import { useRef, useState } from 'react'
import { CloseIcon, InfoIcon } from './Icon'
import { modelName } from './format'
import { DemoDetails } from './DemoDetails'
import { useModalFocus } from '../hooks/useModalFocus'
import { useT } from '../i18n/context'
import type { BffConfig } from '../config'
import type { DemoState } from '../state/demo'

interface Props {
  config: BffConfig | null
  configFailed: boolean
  demo: DemoState | null
}

export function BuildInfo({ config, configFailed, demo }: Props) {
  const s = useT()
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  useModalFocus(dialog, open)

  return (
    <>
      {config?.demo || demo ? <span className="replay-badge" data-testid="replay-badge">{s('demo.title')}</span> : null}
      <button type="button" className="build-info__opener" aria-label={s('buildInfo.title')}
        title={s('buildInfo.title')} aria-haspopup="dialog" aria-expanded={open}
        aria-controls="build-info" onClick={() => setOpen(true)}>
        <InfoIcon size={16} />
      </button>
      {open && (
        <div className="build-info__scrim" onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <div ref={dialog} id="build-info" className="build-info" role="dialog" aria-modal="true"
            aria-labelledby="build-info-title" tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setOpen(false)
              }
            }}>
            <div className="build-info__head">
              <h2 id="build-info-title">{s('buildInfo.title')}</h2>
              <button type="button" className="build-info__close" aria-label={s('buildInfo.close')}
                onClick={() => setOpen(false)}><CloseIcon size={16} /></button>
            </div>
            <p data-testid="build-info-model"><span>{s('sidebar.modelLabel')} </span>
              {config ? modelName(config.model) : s(configFailed ? 'config.unavailable' : 'config.loading')}
            </p>
            {config && <p>{config.uses_gateway ? s('sidebar.gatewayOn') : s('sidebar.gatewayOff')}</p>}
            <p>{s('sidebar.transport')}</p>
            {demo && <DemoDetails demo={demo} />}
          </div>
        </div>
      )}
    </>
  )
}
