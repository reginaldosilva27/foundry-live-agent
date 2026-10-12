/**
 * What the agent did during one turn: the reasoning summary, then every tool and MCP call in the
 * order the agent produced them.
 *
 * It sits inside the turn rather than in a column of its own, which is what the design does — the
 * activity is part of the answer's story, not a sidebar to it.
 */
import { ReasoningCard } from '../components/ReasoningCard'
import { ToolRow } from '../components/ToolRow'
import { isSettled, type Turn } from '../state/turn'

interface Props {
  turn: Turn
  reasoningOpen?: boolean
  /** Open the trace panel on one call. The chat shows the fact; the panel holds the payload. */
  onOpenCall: (callId: string) => void
}

export function ActivityPanel({ turn, onOpenCall, reasoningOpen }: Props) {
  const streaming = !isSettled(turn)

  return (
    <div className="activity">
      <ReasoningCard text={turn.reasoning} streaming={streaming} reasoningOpen={reasoningOpen} />
      {turn.activities.map((activity, i) => {
        const id = activity.kind === 'tool' ? activity.callId : `mcp_${i}`
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
      })}
    </div>
  )
}
