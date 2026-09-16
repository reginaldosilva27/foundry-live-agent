/**
 * What `GET /agents` reports. Mirrors `backend/app/agents.py`'s `AgentSummary` (spec 019).
 *
 * The Python dataclass is the source of truth and `agents.test.ts` reads it, so the two drift for
 * exactly one commit — the one that breaks CI (§4). Same arrangement as `events.ts` and `contract.py`.
 */

export interface AgentRow {
  name: string
  /** `prompt` · `hosted` · `workflow` · `unknown` — from the service, never inferred. */
  kind: string
  version: string
  version_status: string
  /** `''` when the service reports none. Rendered as absent, not as a guess. */
  model: string
  /**
   * Which harness would drive it, or `''` when none can.
   *
   * Sent by the BFF rather than derived here: the kind-to-harness rule is `HARNESS_FOR_KIND` in
   * `harness_factory.py` and a copy of it in TypeScript would be a second home for the rule (§4).
   * It exists because the header's badge would otherwise keep naming `AGENT_HARNESS` while a
   * selected agent of the other kind answered.
   */
  harness: string
  selectable: boolean
  /** `''` when selectable; otherwise a CODE the UI translates — never prose (§7). */
  reason: string
}

export interface AgentsListing {
  agents: AgentRow[]
  /** A failure code, or `null`. Never an empty `agents` standing in for one (AC3). */
  error: string | null
}
