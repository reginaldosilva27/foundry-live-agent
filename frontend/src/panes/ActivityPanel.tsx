/**
 * What the agent did during one turn: the reasoning summary, then every tool and MCP call in the
 * order the agent produced them.
 *
 * It sits inside the turn rather than in a column of its own, which is what the design does — the
 * activity is part of the answer's story, not a sidebar to it.
 */
import { ReasoningCard } from '../components/ReasoningCard'
import { ToolCard } from '../components/ToolCard'
import type { Turn } from '../state/turn'

interface Props {
  turn: Turn
}

export function ActivityPanel({ turn }: Props) {
  const streaming = turn.status === 'streaming'

  return (
    <div className="activity">
      <ReasoningCard text={turn.reasoning} streaming={streaming} />
      {turn.activities.map((activity, i) => (
        <ToolCard key={activity.kind === 'tool' ? activity.callId : `mcp_${i}`} activity={activity} />
      ))}
    </div>
  )
}
