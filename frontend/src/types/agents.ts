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

/**
 * What `GET /agents/{name}` reports. Mirrors `AgentDetail` / `ToolInfo` / `ContainerInfo` in
 * `backend/app/agents.py` (spec 030), with the same parity test guarding the drift.
 *
 * **`null` means the service did not report it**, and is not the same as empty. Five of the ten
 * agents in the recorded project have instructions that really are the empty string; a hosted agent
 * has no instructions key at all. The screen renders those two differently, so the type keeps them
 * different.
 */
export interface AgentDetail extends AgentRow {
  instructions: string | null
  tools: AgentTool[] | null
  /** The service's own object, rendered as reported. `null` when it configured none. */
  reasoning: Record<string, unknown> | null
  container: AgentContainer | null
}

export interface AgentTool {
  /** `function` · `mcp`. Decided by the BFF — a copy of that rule here would be the §4 drift. */
  kind: string
  name: string
  /** `app` · `foundry` — the contract's own vocabulary for the distinction this repo teaches. */
  executor: string
  description: string
  /** A JSON string, rendered and copied verbatim. `null` when the service reported no schema. */
  parameters: string | null
  server_label: string
  server_url: string
  require_approval: string
}

/** What a hosted agent is. Its environment never travels — see `ContainerInfo` (spec 030 AC11). */
export interface AgentContainer {
  image: string
  cpu: string
  memory: string
  protocols: string[]
}

export interface AgentDetailResponse {
  agent: AgentDetail | null
  /** A failure code, or `null`. Never an empty detail standing in for one (AC8). */
  error: string | null
}
