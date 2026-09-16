/**
 * The dark left column: brand, session, and a mono footer describing what we are connected to.
 *
 * The footer names the model and nothing else. The Foundry project id is a deployment detail no
 * reader acts on, and `model` arrives as `<connection>/<model>` — where the connection is usually
 * the project again. Whether that connection routes through the gateway is the part worth showing,
 * and the line below already says it.
 *
 * The mock's list of past sessions is gone (design-system note M9). There is nowhere to persist a
 * conversation to in this release, so a list of them would be a drawing of a feature rather than a
 * feature — the shell stays, with one honest entry that says so (constitution §5).
 */
import { modelName } from '../components/format'
import { useT } from '../i18n/context'
import { LANGS, type Lang } from '../i18n/strings'
import type { BffConfig } from '../config'

interface Props {
  config: BffConfig | null
  lang: Lang
  onLang: (lang: Lang) => void
  onNewSession: () => void
}

export function Sidebar({ config, lang, onLang, onNewSession }: Props) {
  const s = useT()

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src="/icon-foundry-live-agent-branco.svg" alt="" width="22" height="22" />
        <span className="sidebar__product">{s('app.name')}</span>
      </div>

      <button type="button" className="sidebar__new" onClick={onNewSession}>
        {s('sidebar.newSession')}
      </button>

      <div className="sidebar__section">
        <p className="sidebar__section-title">{s('sidebar.sessionsTitle')}</p>
        <p className="sidebar__session">{s('sidebar.currentSession')}</p>
        <p className="sidebar__note">{s('sidebar.noHistory')}</p>
      </div>

      <div className="sidebar__spacer" />

      <div className="sidebar__lang" role="group" aria-label={s('sidebar.language')}>
        {LANGS.map((code) => (
          <button
            key={code}
            type="button"
            className="sidebar__lang-option"
            aria-pressed={code === lang}
            onClick={() => onLang(code)}
          >
            {code}
          </button>
        ))}
      </div>

      <footer className="sidebar__footer">
        <p data-testid="sidebar-model">
          <span className="sidebar__key">{s('sidebar.modelLabel')}</span>
          {modelName(config?.model)}
        </p>
        {config && (
          <p className="sidebar__gateway">
            {config.uses_gateway ? s('sidebar.gatewayOn') : s('sidebar.gatewayOff')}
          </p>
        )}
        <p className="sidebar__transport">
          <span className="dot" aria-hidden="true" />
          {s('sidebar.transport')}
        </p>
      </footer>
    </aside>
  )
}
