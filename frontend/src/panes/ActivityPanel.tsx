/**
 * What the agent did during one turn: the reasoning summary, then every tool and MCP call in the
 * order the agent produced them.
 *
 * It sits inside the turn rather than in a column of its own, which is what the design does — the
 * activity is part of the answer's story, not a sidebar to it.
 *
 * **Three calls or more fold into one line** (spec 061), as the Claude app does: the count and the
 * distinct tools, in the order they were first used — both read from the events, nothing more.
 * Folded from the start rather than at settle, so nothing collapses under someone reading; while
 * the turn runs, the live line at its foot names the call in flight.
 */
import { useState } from 'react'
import { ChevronIcon } from '../components/Icon'
import { ReasoningCard } from '../components/ReasoningCard'
import { ToolRow } from '../components/ToolRow'
import { useT } from '../i18n/context'
import { callKey, isSettled, type Turn } from '../state/turn'

/** The smallest number of calls that folds. Two rows are not "many". */
const FOLD_AT = 3

interface Props {
  turn: Turn
  reasoningOpen?: boolean
  /** Open the trace panel on one call. The chat shows the fact; the panel holds the payload. */
  onOpenCall: (callId: string) => void
}

export function ActivityPanel({ turn, onOpenCall, reasoningOpen }: Props) {
  const s = useT()
  const streaming = !isSettled(turn)
  const [open, setOpen] = useState(false)
  const folds = turn.activities.length >= FOLD_AT

  const rows = turn.activities.map((activity, i) => {
    const id = callKey(activity, i)
    return (
      <ToolRow
        key={id}
        activity={activity}
        // A lone call numbered "1" implies a second one that never came, so the ordinal
        // appears only where there is a sequence to place it in (spec 015 AC6).
        showStep={turn.activities.length > 1}
        onOpen={() => onOpenCall(id)}
      />
    )
  })

  return (
    <div className="activity">
      <ReasoningCard text={turn.reasoning} streaming={streaming} reasoningOpen={reasoningOpen} />
      {folds ? (
        <section className="tool-group" data-open={open}>
          {/* Named by its content: the count and the tools are the information here. */}
          <button
            type="button"
            className="tool-group__toggle"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <ChevronIcon size={14} className="tool-group__chevron" />
            <span className="tool-group__count">
              {s('tools.group').replace('{n}', String(turn.activities.length))}
            </span>
            <span className="tool-group__names">
              {[...new Set(turn.activities.map((activity) => activity.name))].join(', ')}
            </span>
          </button>
          {open && <div className="tool-group__rows">{rows}</div>}
        </section>
      ) : (
        rows
      )}
    </div>
  )
}
