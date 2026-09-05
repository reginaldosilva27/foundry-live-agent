/**
 * Which harness the BFF is running (AC9).
 *
 * The design mock has no such badge, because the mock knows about one agent. Swapping
 * `AGENT_HARNESS` is the point of the contract in §9, and a swap nobody can see from the screen
 * is a claim rather than a demonstration.
 */
import { useT } from '../i18n/context'

interface Props {
  harness?: string
  failed: boolean
}

export function HarnessBadge({ harness, failed }: Props) {
  const s = useT()
  const value = harness ?? (failed ? s('config.unavailable') : s('config.loading'))
  return (
    <span className="harness-badge" data-testid="harness-badge" data-known={Boolean(harness)}>
      <span className="harness-badge__label">{s('header.harnessLabel')}</span>
      <span className="harness-badge__value">{value}</span>
    </span>
  )
}
