/**
 * Who is about to answer, named in the composer (spec 021).
 *
 * The agents screen already lets a person choose; this says the same thing where the cursor already
 * is. It is a shortcut, not a second screen: it lists the agents this build can drive and hands the
 * rest — the dimmed ones, the reasons, the versions — to the listing it links to.
 *
 * Choosing here is the same call the screen makes, so switching still starts a new conversation.
 * Letting a *person* choose is configuration, not an agent loop (§8).
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from '../components/Icon'
import { Monogram } from '../components/Monogram'
import { useT } from '../i18n/context'
import type { AgentRow } from '../types/agents'

interface Props {
  agents: AgentRow[]
  /** The selection, or the BFF's configured agent. Absent means we know of no agent yet. */
  answering?: string
  onSelect: (name: string) => void
  onSeeAll: () => void
}

export function AgentChip({ agents, answering, onSelect, onSeeAll }: Props) {
  const s = useT()
  const [open, setOpen] = useState(false)
  const chip = useRef<HTMLButtonElement>(null)

  // A menu that stays open behind the reader's next click is a menu they have to fight — so it
  // closes on a click anywhere outside it, and on Escape. Escape also puts the focus back where it
  // came from, which is the half keyboard users notice.
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      chip.current?.focus()
    }
    // `pointerdown`, not `click`: a reader who presses outside has already decided, and waiting for
    // the release leaves the menu over whatever they are aiming at.
    const onPointerDown = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  if (!answering) return null

  const choose = (name: string) => {
    setOpen(false)
    onSelect(name)
  }

  return (
    <div className="agent-chip" ref={menu}>
      <button
        ref={chip}
        type="button"
        className="agent-chip__button"
        data-testid="agent-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        title={s('composer.chooseAgent')}
        aria-label={s('composer.answeringWith').replace('{name}', answering)}
        onClick={() => setOpen((value) => !value)}
      >
        <Monogram name={answering} size={22} />
        <span className="agent-chip__name">{answering}</span>
        <ChevronDownIcon size={13} />
      </button>

      {open && (
        <ul className="agent-chip__menu" role="menu" aria-label={s('composer.chooseAgent')}>
          {agents
            .filter((agent) => agent.selectable)
            .map((agent) => (
              <li key={agent.name}>
                <button
                  type="button"
                  role="menuitem"
                  className="agent-chip__item"
                  aria-current={agent.name === answering ? 'true' : undefined}
                  onClick={() => choose(agent.name)}
                >
                  <Monogram name={agent.name} size={20} />
                  {agent.name}
                </button>
              </li>
            ))}
          <li>
            <button
              type="button"
              role="menuitem"
              className="agent-chip__item agent-chip__item--all"
              onClick={() => {
                setOpen(false)
                onSeeAll()
              }}
            >
              {s('composer.allAgents')}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
