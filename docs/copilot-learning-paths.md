# Copilot learning paths — choose the client before connecting

[Português](copilot-learning-paths.pt-BR.md) · [Learning journey](learning-journey.md) ·
[Official source ledger](REFERENCES.md#copilot-learning-paths--sources-read-2026-10-09)

**Documentation reviewed: 2026-10-09. No integration was executed.** This is the research phase of
[issue #37](https://github.com/reginaldosilva27/foundry-live-agent/issues/37), not a product selection
or a completed workshop. Source IDs below refer to the dated ledger. Availability and entitlement
must be checked again for the selected account, client version, region and tenant policy.

## 1. Different products, different owners

“Copilot” does not identify a single runtime, license or protocol. MCP exposes capabilities;
an agent decides when to use them; a harness governs that agent's execution. A plugin package
references capabilities but does not necessarily host them. Studio's **standard harness** is a
product term, not an implementation of this repository's `AgentHarness` contract.

| Candidate surface | Documented capabilities | Where execution lives | Relation to this project |
|---|---|---|---|
| GitHub Copilot in VS Code | Agent tools, MCP tools/resources/prompts and MCP Apps; customizations [C01] | Copilot provides inference; the editor runs configured local tools or calls remote servers. Remote development changes where local processes run. | Can consult the same public Learn MCP without calling the BFF. It is a developer client, not a third Foundry harness. |
| GitHub Copilot CLI | Terminal agent, custom agents, instructions, skills, hooks and configurable MCP tools [C02, C03] | A normal local session executes on the user's machine; explicit cloud execution is a different mode. Remote-controlling a local session does not relocate it. | Can inspect/test the app; Learn documents a CLI plugin option. No CLI plugin is installed by this change. |
| GitHub Copilot cloud agent / code review | Repository-configured MCP **tools only**, not resources/prompts; remote OAuth unsupported on these surfaces [C04] | Cloud agent works in an ephemeral cloud development environment; review is a separate workflow. Remote MCP servers remain with their operators. | Useful for contributor automation, but broader permissions and autonomous calls make it a less minimal first lesson. |
| Copilot Studio | Standard-harness agents with generative orchestration can use MCP **tools and resources**; connected agents and connectors are separate surfaces [C06, C07, C09] | Studio orchestrates; a remote MCP server or connected agent executes its own work. | Can reuse public Learn. A direct Foundry-agent connection is documented **public preview**, requires an Activity endpoint, and is not this app's SSE route [C10]. |
| Microsoft 365 Copilot | Declarative agents use Copilot's orchestrator; custom-engine agents bring their own orchestration. MCP plugins can expose actions with dynamic discovery/pinned tools and MCP Apps [C11, C12] | Declarative orchestration stays in M365; a custom engine and remote tools execute in their own hosting environment. A package does not host the server. | Foundry has a documented stable-endpoint publishing route to M365/Teams. This does not publish the React/FastAPI app or validate its client-side function round trip [C14]. |

The reviewed M365 documents explicitly warn that MCP protocol features, discovery and governance
vary by host [C13]. Do not transfer VS Code's resource/prompt support to every M365 experience.
Work IQ MCP is a **different direction**: an outside agent accesses M365 data or invokes Copilot.
Its documented tools include reads **and writes/deletes**, using Entra OAuth and tenant policy [C15].
It is not the public Learn server, and is not part of the proposed lesson.

## 2. Access, credentials and trust are part of the lesson

| Surface | Access / licensing to confirm | Credential and approval boundary |
|---|---|---|
| GitHub developer surfaces | Current plans include CLI/app, with different limits; Free agent access is limited. Confirm the selected feature, GitHub AI Credits and organization policy, not remembered premium-request quotas [C05]. | GitHub sign-in is separate from each MCP server's authentication. VS Code asks for server trust; invocation approval depends on configuration. Local servers can execute arbitrary code. CLI tool permissions can be broad: do not use blanket auto-approval [C01, C02]. |
| GitHub cloud agent / review | Repository administrator configures MCP; account entitlement and organization policies still apply [C04, C05]. | Calls run without per-call user approval. Prefer explicit read-only allowlists; review requires `readOnlyHint`. Repository secrets/variables can enter server configuration. Do not copy this configuration into the app or assume remote OAuth works [C04]. |
| Copilot Studio | Work/school account and tenant/admin access. Trial can author/test but **cannot publish**. Standalone and Teams-subset capabilities differ; the reviewed Teams subset lacks generative orchestration, so it is not equivalent for this MCP exercise. Confirm Copilot Credits/capacity [C08]. | MCP onboarding supports no auth, API key or OAuth. User-delegated permissions and tenant connector/data policies matter. Streamable transport is supported; legacy MCP SSE is not the supported onboarding path [C07]. |
| Microsoft 365 Copilot | Eligible base subscription and chosen Copilot Chat/add-on path; shared tenant data can consume Copilot Credits. Custom-engine agents in Copilot Chat do not require an **additional** Copilot add-on, which does not mean every account is eligible or Azure hosting is free [C16]. | Toolkit development requires enabled custom app upload and Copilot access. MCP plugins support documented authentication choices; exact user scopes/consent depend on the server. Catalog approval, acquisition and service authorization are separate gates [C12, C13]. |
| Foundry links | Existing Azure resources and authorized identities; model/container/Bot Service costs remain independent of Copilot entitlement [C14, C17]. | Foundry MCP docs name Foundry User for project access and Foundry Project Manager for project connections. Publishing also needs Bot Service permissions; project access alone is insufficient [C14, C17]. |

The public Microsoft Learn server uses Streamable HTTP at `https://learn.microsoft.com/api/mcp`,
requires **no authentication**, and has **no server usage charge** [C18]. The client/model may still
consume its own quota or paid credits. Public-only requests still leave the machine and must follow
Learn's terms. Never include private repository code, tenant content, credentials or transcripts.

## 3. What can connect — and what is not yet proved

- **Confirmed in official docs:** Learn can serve compatible GitHub Copilot, Studio and Foundry
  clients [C18, C19]. This confirms a documented surface, not a test in this tenant.
- **Confirmed in repository evidence:** the [shared definition](../ai/harness/_shared/agent_core.yaml)
  references Learn; the [prompt path](how-it-works/function-call-round-trip.md) delegates MCP to
  Foundry, while the [hosted graph](../ai/harness/langgraph/agent/graph.py) is the MCP client inside
  the Foundry container. See [dated recordings](../ai/tests/fixtures/recorded/README.md) and
  [measured comparison](harness-comparison.md), not an inferred current benchmark.
- **Not MCP:** `/chat` SSE, `/tools/{name}/run` HTTP and the
  [shared Python functions](../ai/harness/_shared/tools/registry.py). Sharing HTTP or the name
  “tool” does not implement MCP discovery, transport, authorization or invocation semantics.
  Exposing them would be new design/code, not a configuration step.
- **Studio → Foundry:** the preview connection requires Activity enabled and agents from the new
  Foundry portal [C10]. Responses/A2A alone are not sufficient. Endpoint enablement, connection
  identity and these exact prompt/hosted versions remain untested. No enabling SDK/API code is
  supplied here.
- **Foundry → M365/Teams:** publishing configures a stable endpoint, Activity authorization,
  Azure Bot Service and a channel/package [C14]. Personal/shared versus tenant publication use
  different authorization/approval paths. This repository's BFF answers client-side function calls;
  whether that output mechanism exists on the chosen Activity channel is an **explicit blocker**.
  Hosted tool execution avoids that particular app dependency, but channel compatibility is still
  unverified. Neither harness is declared compatible from this research alone.
- **Work IQ → Foundry/Copilot clients:** documented M365 tool access is not permission to read a
  tenant. Licensing, scopes, administrator policy, data/spend consent and exact supported client
  flow must be resolved before any call [C15, C16]. Not a shortcut for this phase.

## 4. Recommended minimal lesson — proposal, not authorization

**“One public Learn server, three different execution owners.”** Prefer **GitHub Copilot in
VS Code + public Learn MCP**, contrasted with existing prompt/hosted recordings. This adds no
Azure deployment, app bridge, secret, connector or third harness. It teaches the boundary before
introducing M365 tenant content or preview channel publication. CLI is an alternative if explicitly
selected; Studio/M365 are later lessons, not secretly substituted products.

### Proposed learner sequence after selection

1. Follow [local setup](../README.md) and the journey's Learn/comparison modules. Replay the existing
   corpus with `cd ai && pytest -q tests/test_events.py tests/test_hosted_recorded_turn.py`.
   Label the output **historical evidence**, including its date and hosted limitations.
2. After confirming account/policy/quota and authorizing this public-only exercise, follow the
   official [Learn getting-started guide][learn-start] in the selected VS Code version. Inspect
   the server URL and discovered metadata; enable only documentation search/fetch tools for the
   exercise, retain approval controls, and use an empty educational workspace without private files.
   Do not install an unrelated Azure-management MCP or auto-approve shell/write tools.
3. Candidate prompt: **“Using Microsoft Learn only, explain how prompt agents and hosted agents
   differ in where orchestration and tools execute. Cite the pages consulted. Do not deploy,
   modify files, or access tenant data.”** A prompt alone is not a security boundary: restrict
   available tools and context, and inspect any proposed call before approving it.
4. Capture the actual tool names, public arguments, results/source URLs and client/version/date.
   Compare them with the recorded Foundry events. Copilot invocation is not automatically an
   `AgentEvent`; prompt `mcp_call` and hosted `tool_call` are normalized app evidence, not Copilot
   telemetry. Do not synthesize fixtures or compare latency/quality across different dated samples.
5. The learner should identify: who selected the tool, who owns the MCP client/session, where the
   server runs, what data crossed the boundary, and where a failure would appear. Record a refusal,
   missing tool or quota failure as a blocker rather than presenting prose citations as call evidence.

**Success criterion for the future lesson:** one observed public Learn call in the selected Copilot
client, compared with provenance-backed prompt/hosted calls, and an accurate explanation of all
three owners. There is **no new live call or workshop capture in this change**. Local tests cannot
prove Copilot/M365 tenant compatibility. No Foundry live run is needed for the proposed first step;
a fresh comparison would require separate Azure spend consent.

### Decision still needed from the user

Choose the Copilot **product and client surface**, available account/license/tenant and admin policy;
confirm public-only data boundaries, credential constraints, and quota/spend consent. Only then
clarify a spec for any new connector, schema/configuration or harness behavior, with reproducible
steps/tests and required real evidence. Even this no-connector lesson's live validation waits for
selection and approval. A recommendation is not authorization. Issue #37 remains **partial**:
research/recommendation address AC1–2; selection/spec and validated execution (AC3–4) remain open.
AC5's existing ownership and event contract are unchanged.

[learn-start]: https://learn.microsoft.com/en-us/training/support/mcp-get-started
