/**
 * The dark left column: brand, the two views, who is answering, what this browser kept, and a mono
 * footer describing what we are connected to.
 *
 * Spec 021 gave it structure and took something away. The **full agent listing left** — ten agents
 * with a kind, a version, a status and a harness never fit in 248px, and the tenth was being cut in
 * half by the language switch. What stays is the one fact the reader needs everywhere: which agent
 * is answering. The listing is a screen now (`AgentsScreen`), and `Sidebar.test.tsx` asserts it has
 * not crept back.
 *
 * The footer names the model and nothing else. The Foundry project id is a deployment detail no
 * reader acts on, and `model` arrives as `<connection>/<model>` — where the connection is usually
 * the project again. Whether that connection routes through the gateway is the part worth showing,
 * and the line below already says it.
 */
import { Favourites } from './Favourites'
import { HistoryList } from './HistoryList'
import { AgentsIcon, ChatIcon, PanelIcon, PlusIcon, SearchIcon } from '../components/Icon'
import { Monogram } from '../components/Monogram'
import { modelName } from '../components/format'
import { useT } from '../i18n/context'
import { LANGS, type Lang } from '../i18n/strings'
import type { BffConfig } from '../config'
import type { AgentsState } from '../state/agents'
import type { HistoryState } from '../state/history'
import type { AgentRow } from '../types/agents'

/** The two things the main column can show. Two booleans' worth of app, hence no router. */
export type View = 'chat' | 'agents'

interface Props {
  config: BffConfig | null
  /** `GET /config` failed, which is not the same as not having answered yet (AC3). */
  configFailed: boolean
  agents: AgentsState
  /** The starred agents, already resolved against the listing (spec 022). */
  favourites: AgentRow[]
  lang: Lang
  view: View
  history: HistoryState
  /** The stored conversation currently on screen, if this session opened one. */
  activeId: string | null
  /** Lifted to `App` since spec 025: a keyboard command toggles it, so it needs one owner (§4). */
  collapsed: boolean
  onToggleCollapse: () => void
  /** The palette's visible control — so the keyboard is never the only way in (AC3). */
  onOpenPalette: () => void
  onLang: (lang: Lang) => void
  onNewSession: () => void
  onView: (view: View) => void
  onOpenConversation: (id: string) => void
  onSelectAgent: (name: string) => void
}

export function Sidebar({
  config,
  configFailed,
  agents,
  favourites,
  lang,
  view,
  history,
  activeId,
  collapsed,
  onToggleCollapse,
  onOpenPalette,
  onLang,
  onNewSession,
  onView,
  onOpenConversation,
  onSelectAgent,
}: Props) {
  const s = useT()

  /** The configured agent answers until someone chooses otherwise (019 AC4, AC12). */
  const answering = agents.selected ?? config?.agent_name

  return (
    <aside className="sidebar" data-collapsed={collapsed}>
      <div className="sidebar__brand">
        <img src="/icon-foundry-live-agent-branco.svg" alt="" width="22" height="22" />
        <span className="sidebar__product">{s('app.name')}</span>
        <button
          type="button"
          className="sidebar__collapse"
          title={s(collapsed ? 'nav.expand' : 'nav.collapse')}
          aria-label={s(collapsed ? 'nav.expand' : 'nav.collapse')}
          onClick={onToggleCollapse}
        >
          <PanelIcon size={17} />
        </button>
      </div>

      <button type="button" className="sidebar__new" onClick={onNewSession}>
        <PlusIcon size={16} />
        <span className="sidebar__label">{s('sidebar.newSession')}</span>
      </button>

      <button type="button" className="sidebar__nav-item" onClick={onOpenPalette}>
        <SearchIcon size={17} />
        <span className="sidebar__label">{s('palette.open')}</span>
      </button>

      <nav className="sidebar__nav" aria-label={s('app.name')}>
        {(
          [
            ['chat', ChatIcon, 'nav.chat'],
            ['agents', AgentsIcon, 'nav.agents'],
          ] as const
        ).map(([id, Icon, key]) => (
          <button
            key={id}
            type="button"
            className="sidebar__nav-item"
            aria-current={view === id ? 'page' : undefined}
            // Collapsed, the label leaves the layout but not the accessibility tree (AC2).
            aria-label={s(key)}
            title={s(key)}
            onClick={() => onView(id)}
          >
            <Icon size={17} />
            <span className="sidebar__label">{s(key)}</span>
          </button>
        ))}
      </nav>

      {answering && (
        <div className="sidebar__section">
          <button
            type="button"
            className="answering"
            data-testid="answering-agent"
            onClick={() => onView('agents')}
          >
            <Monogram name={answering} size={26} />
            <span className="answering__naming">
              <span className="answering__name">{answering}</span>
              <span className="answering__state">{s('agents.answering')}</span>
            </span>
          </button>
          {agents.switched && (
            <p className="agents__switched" role="status">
              {s('agents.switched').replace('{name}', agents.switched)}
            </p>
          )}
        </div>
      )}

      <Favourites rows={favourites} answering={answering} onSelect={onSelectAgent} />

      <HistoryList
        conversations={history.conversations}
        storing={history.storing}
        activeId={activeId}
        onOpen={onOpenConversation}
        onRename={history.rename}
        onRemove={history.remove}
      />

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
          {config ? modelName(config.model) : s(configFailed ? 'config.unavailable' : 'config.loading')}
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
