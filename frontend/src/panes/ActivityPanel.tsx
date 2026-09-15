/**
 * What the agent did during one turn: the reasoning summary, then every tool and MCP call in the
 * order the agent produced them.
 *
 * It sits inside the turn rather than in a column of its own, which is what the design does — the
 * activity is part of the answer's story, not a sidebar to it.
 */
import { ReasoningCard } from '../components/ReasoningCard'
import { ToolRow } from '../components/ToolRow'
import type { Turn } from '../state/turn'

interface Props {
  turn: Turn
  /** Open the trace panel on one call. The chat shows the fact; the panel holds the payload. */
  onOpenCall: (callId: string) => void
}

export function ActivityPanel({ turn, onOpenCall }: Props) {
  const streaming = turn.status === 'streaming'

  return (
    <div className="activity">
      <ReasoningCard text={turn.reasoning} streaming={streaming} />
      {turn.activities.map((activity, i) => {
        const id = activity.kind === 'tool' ? activity.callId : `mcp_${i}`
        return <ToolRow key={id} activity={activity} onOpen={() => onOpenCall(id)} />
      })}
    </div>
  )
}
