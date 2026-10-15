/**
 * The Playground (spec 060): one screen, two tabs, in the shape of the Foundry portal's.
 *
 * **Agent** is an agent beside its definition, with a second one to compare against (spec 020).
 * **Tools** is spec 042's runner, unchanged, and still behind its own flag: with the flag off the
 * tab says so rather than vanishing, because a tab that appears and disappears with deployment
 * configuration is a screen nobody can find twice.
 *
 * The tab is part of the address (`/playground`, `/playground/tools`), so the tabs navigate rather
 * than hold state — `route.ts` stays the one definition of which screen is showing (§4).
 */
import type { ReactNode } from 'react'
import { useT } from '../i18n/context'
import type { PlaygroundTab } from '../state/route'

interface Props {
  tab: PlaygroundTab
  onTab: (tab: PlaygroundTab) => void
  /** The Agent tab's content. */
  agent: ReactNode
  /** The Tools tab's content, or `null` when the deployment switched the runner off. */
  tools: ReactNode | null
}

/**
 * Both tabs stay in the Tab order rather than using arrow-key roving: arrow keys are the trace
 * panel's (spec 025), and `keys.ts` is the one place a key is named (§4).
 */
const TABS: PlaygroundTab[] = ['agent', 'tools']

export function PlaygroundScreen({ tab, onTab, agent, tools }: Props) {
  const s = useT()

  return (
    <div className="playground-screen">
      <header className="playground-screen__head">
        <h1 className="playground-screen__title">{s('playground.title')}</h1>
        <p className="playground-screen__lead">{s('playground.lead')}</p>
        <div className="playground-screen__tabs" role="tablist" aria-label={s('playground.title')}>
          {TABS.map((id) => (
            <button
              key={id}
              id={`playground-tab-${id}`}
              type="button"
              role="tab"
              className="playground-screen__tab"
              aria-selected={tab === id}
              aria-controls={`playground-panel-${id}`}
              onClick={() => onTab(id)}
            >
              {s(id === 'agent' ? 'playground.tab.agent' : 'playground.tab.tools')}
            </button>
          ))}
        </div>
      </header>

      <div
        className="playground-screen__panel"
        role="tabpanel"
        id={`playground-panel-${tab}`}
        aria-labelledby={`playground-tab-${tab}`}
      >
        {tab === 'agent' ? agent : (tools ?? <p className="playground-screen__off">{s('playground.toolsOff')}</p>)}
      </div>
    </div>
  )
}
