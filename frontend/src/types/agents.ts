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
  /**
   * What this agent is worth being asked (spec 037).
   *
   * Empty for every agent this repository did not write, which is most of the project's. The
   * frontend holds NO list of its own: a set of example questions in TypeScript would be a second
   * description of an agent whose first one lives in `agent_core.yaml` (§4), and deriving one from
   * the agent's tools would be the app inventing a description of it.
   */
  suggestions: { en: string; pt: string }[]
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
  /**
   * The version the endpoint actually serves (spec 031).
   *
   * **Not the same as `version` on a row.** The listing reports the NEWEST version, because it does
   * not carry the endpoint's `version_selector` and resolving a pin there would cost a call per
   * agent (AC12). This screen reads it properly, so once anything is pinned these two disagree —
   * which is the whole point, and why the screen says which is which.
   */
  served_version: string
  latest_version: string
  /** Whether a selector chose the served version, rather than it merely being the newest. */
  pinned: boolean
  /** `null` means the service did not report them — not that this agent has none. */
  versions: AgentVersion[] | null
}

/** One version of an agent (spec 031). Mirrors `AgentVersion` in `backend/app/agents.py`. */
export interface AgentVersion {
  version: string
  /** `null` when the service reported no status. Rendered as not reported, never as healthy. */
  status: string | null
  /** The service's own Unix seconds. Formatted for reading here, because §7 lives here. */
  created_at: number | null
  /** `null` when the service reported none — a hosted version has no model at all. */
  model: string | null
  served: boolean
  /** Whether this version can be rolled back to. Never true for the served one. */
  promotable: boolean
  /**
   * `''` when promotable; otherwise a CODE the UI translates — `served` · `not_owned`.
   *
   * Decided by the BFF, like `reason`: ownership comes from the harness `agent.yaml` files and a copy
   * of that rule here would be the §4 drift.
   */
  promote_reason: string
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
