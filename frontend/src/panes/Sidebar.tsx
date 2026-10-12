/**
 * The dark left column: brand, the two views, who is answering, what this browser kept, and a mono
 * footer describing what we are connected to.
 *
 * **Three blocks, and only the middle one moves.** The head (brand, the new session, the views) and
 * the foot (language, what we are connected to) are pinned; everything that grows with use — the
 * agent, the favourites, the history — lives in `.sidebar__scroll` between them. 021 gave the
 * overflow to the history's own list, which is one list *per age group*: with `Today`, `Last 7 days`
 * and `Older` on screen none of the three could shrink and the rail painted straight over the
 * language switch and the footer. One scrolling region has one place for that to go wrong, and
 * `Sidebar.test.tsx` asserts the boundary rather than the stylesheet.
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
import { useRef, useState } from 'react'
import { useModalFocus } from '../hooks/useModalFocus'
import { Favourites } from './Favourites'
import { HistoryList } from './HistoryList'
import {
  AgentsIcon,
  ChatIcon,
  ClockIcon,
  ColumnsIcon,
  PanelIcon,
  PlusIcon,
  SearchIcon,
} from '../components/Icon'
import { Monogram } from '../components/Monogram'
import { HarnessBadge } from '../components/HarnessBadge'
import { modelName } from '../components/format'
import { useT } from '../i18n/context'
import { LANGS, type Lang } from '../i18n/strings'
import { searchConversations } from '../state/history'
import type { BffConfig } from '../config'
import type { AgentsState } from '../state/agents'
import type { HistoryState } from '../state/history'
import type { AgentRow } from '../types/agents'

/**
 * What the main column can show.
 *
 * Derived from the address rather than stored beside it (spec 024) — `App` maps one to the other,
 * and `route.ts` stays the single definition of the scheme (§4).
 */
export type View =
  | 'chat'
  | 'agents'
  | 'history'
  | 'agent'
  | 'about'
  | 'preferences'
  | 'tools'
  | 'compare'

/**
 * The views the rail can switch to.
 *
 * `agent` is deliberately not one: a single agent's detail needs a name, so it is reached by naming
 * one (from a card, or from the address) rather than by pressing a nav item (spec 030).
 */
export type NavView = Exclude<View, 'agent'>

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
  onView: (view: NavView) => void
  onOpenConversation: (id: string) => void
  onSelectAgent: (name: string) => void
  /**
   * The rail is open **over** the conversation (spec 047).
   *
   * Below the narrow breakpoint it stops being a column and becomes an overlay. The flag is what
   * the stylesheet keys off; the component is otherwise identical, which is the point — a second
   * navigation would be a second set of handlers to keep in step (§4).
   */
  overlay?: boolean
  inactive?: boolean
  onCloseOverlay?: () => void
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
  overlay,
  inactive,
  onCloseOverlay,
}: Props) {
  const s = useT()
  const rail = useRef<HTMLElement>(null)
  useModalFocus(rail, Boolean(overlay))
  /**
   * The query lives here because the field does (spec 027).
   *
   * It is not an address and it is not stored: a half-typed word is not somewhere a reader can be
   * sent back to, and putting it in the URL would make a link carry someone else's filter.
   */
  const [query, setQuery] = useState('')
  const results = searchConversations(history.conversations, query)

  /** The configured agent answers until someone chooses otherwise (019 AC4, AC12). */
  const answering = agents.selected ?? config?.agent_name

  return (
    <aside
      ref={rail}
      id="navigation-rail"
      className="sidebar"
      inert={inactive}
      data-collapsed={overlay ? false : collapsed}
      data-overlay={Boolean(overlay)}
    >
      <div className="sidebar__head">
        <div className="sidebar__brand">
          <img src="/icon-foundry-live-agent-branco.svg" alt="" width="20" height="20" />
          <span className="sidebar__product">{s('app.name')}</span>
          {/* One control, two jobs, because they are the same job: put the rail away. As a column
              it collapses; as an overlay (spec 047) it closes, and says so — a backdrop dismisses
              well and advertises nothing. */}
          <button
            type="button"
            className="sidebar__collapse"
            title={s(overlay ? 'nav.closeMenu' : collapsed ? 'nav.expand' : 'nav.collapse')}
            aria-label={s(overlay ? 'nav.closeMenu' : collapsed ? 'nav.expand' : 'nav.collapse')}
            onClick={overlay ? onCloseOverlay : onToggleCollapse}
          >
            <PanelIcon size={16} />
          </button>
        </div>

        <button type="button" className="sidebar__new" onClick={onNewSession}>
          <PlusIcon size={16} />
          <span className="sidebar__label">{s('sidebar.newSession')}</span>
        </button>

        {/* The palette sits with the two views because that is what it is from here: a way to get
            somewhere. Keeping it in the same group spares the rail a fourth row metric. */}
        <nav className="sidebar__nav" aria-label={s('app.name')}>
          <button type="button" className="sidebar__nav-item" onClick={onOpenPalette}>
            <SearchIcon size={16} />
            <span className="sidebar__label">{s('palette.open')}</span>
          </button>
          {(
            [
              ['chat', ChatIcon, 'nav.chat'],
              ['agents', AgentsIcon, 'nav.agents'],
              // Side by side (spec 020). A mode you go to, not a decoration on the chat.
              ['compare', ColumnsIcon, 'nav.compare'],
              ['history', ClockIcon, 'nav.history'],
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
              <Icon size={16} />
              <span className="sidebar__label">{s(key)}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Everything that grows with use, and the only thing in the rail that scrolls. */}
      <div className="sidebar__scroll">
        {answering && (
          <div className="sidebar__section">
            <button
              type="button"
              className="answering"
              data-testid="answering-agent"
              onClick={() => onView('agents')}
            >
              <Monogram name={answering} size={20} />
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

        {/* The field appears with the second thing worth searching, not before: a search box over
            an empty list is chrome that promises something the rail cannot do yet. */}
        {history.conversations.length > 0 && (
          <div className="history__search">
            <SearchIcon size={14} />
            <input
              type="search"
              className="history__search-input"
              value={query}
              aria-label={s('history.search')}
              placeholder={s('history.search')}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        )}

        <HistoryList
          results={results}
          searching={query.trim().length > 0}
          storing={history.storing}
          activeId={activeId}
          onOpen={onOpenConversation}
          onRename={history.rename}
          onRemove={history.remove}
        />
      </div>

      <div className="sidebar__foot">
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
          {/* The footer is the glance; `/about` is the look (spec 032, AC7). It links rather than
              growing — the event-mapping report is a list of names and the rail is narrow. Rendered
              unconditionally, including when the config failed, because the panel is exactly where
              a reader goes to find out why. */}
          <button
            type="button"
            className="sidebar__about"
            aria-current={view === 'about' ? 'page' : undefined}
            onClick={() => onView('about')}
          >
            {s('sidebar.about')}
          </button>
          <button
            type="button"
            className="sidebar__about"
            aria-current={view === 'preferences' ? 'page' : undefined}
            onClick={() => onView('preferences')}
          >
            {s('sidebar.preferences')}
          </button>
          {/* Spec 042's screen had no way in — not here, not in the palette, not anywhere. It
              belongs on this shelf, beside the other two surfaces that describe the build rather
              than talk to the agent.

              Only where the deployment enabled it, and read from `GET /config` rather than from a
              flag of the frontend's own: the BFF refuses the endpoint when it is off, so a door
              rendered anyway would open onto a 403. Absent reads as no, like every other
              capability here. */}
          {config?.playground?.enabled && (
            <button
              type="button"
              className="sidebar__about"
              aria-current={view === 'tools' ? 'page' : undefined}
              onClick={() => onView('tools')}
            >
              {s('tools.title')}
            </button>
          )}
          {/* Spec 047: at 320px the header has no room for this, so it lives here instead —
              beside the model and the gateway line, which is the same fact about what this build is
              made of. Same component, fed from the same source, so there is no second reading of
              which harness is driving (§4).

              Only while the rail IS the overlay. Rendering it at every width would put the badge on
              screen twice on a laptop, where the header already has it — two copies of one fact,
              which is the thing §4 is about, and it made three existing tests ambiguous the moment
              it shipped. */}
          {overlay && (
            <HarnessBadge
              harness={agents.selectedRow?.harness ?? config?.harness}
              failed={configFailed}
            />
          )}
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
      </div>
    </aside>
  )
}
