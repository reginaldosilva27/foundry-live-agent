# Spec: Prompt-agent harness — agent as code, and the client-side tools

| | |
|---|---|
| **ID** | 002-prompt-agent-harness |
| **Status** | in-progress |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-04 |

## Problem / motivation

Spec 001 defined what a harness *emits*. This spec builds the first one that actually talks to
Foundry: an agent defined as code, applied by a script so `azd up` leaves something working behind,
and the two function tools the agent can ask us to run.

The tools are where the repository's argument becomes concrete. Foundry decides *that*
`get_current_datetime` should be called and with what arguments; **our process decides nothing** — it
looks the name up in a registry, runs it, and returns the output. Anyone reading `tools/` should be
unable to find a decision.

There is also a question this spec must answer before anything is built on top of it. The agent's
inference is meant to route through an existing APIM gateway using *bring your own model*, and the
docs say BYOM reaches models over `chat/completions` while noting *"The Response API isn't supported
at present."* If that sentence constrains our BFF→Foundry hop rather than the Foundry→gateway hop,
the entire streaming design is wrong. **That gets verified first, by observation, not by reasoning.**

## Goals

- The agent's definition lives in version control and is applied by a script, not clicked into a portal.
- Two function tools implemented **once**, shared by every harness, with no decision logic in them.
- `lookup_knowledge` behind an interface that makes swapping to Foundry IQ a one-class change.
- Real recorded fixtures, so spec 003's normaliser is written against observed behaviour.
- Open questions O-1, O-3, O-8 and O-9 answered with evidence and recorded in `docs/REFERENCES.md`.

## Non-goals

- No BFF, no HTTP, no SSE (spec 003). No UI (spec 004).
- No Bicep. `infra/` stays empty until the spike confirms what to provision.
- The LangGraph harness stays a scaffold that raises `NotImplementedError`.

## User-facing behavior

Indirect, but two things become visible. `just agent` applies the definition and prints the agent
name and version. And a user asking *"What time is it in São Paulo, and what do the Foundry docs say
about hosted agents?"* triggers one **app-executed** tool and one **Foundry-executed** MCP call —
the pair the activity panel exists to show side by side.

## Acceptance criteria

1. **AC1** — `get_current_datetime(timezone)` returns the current time in that IANA zone with the
   ISO-8601 timestamp, the zone name and the UTC offset. An unknown zone returns a structured error,
   never an exception that would break the tool round trip.
2. **AC2** — `lookup_knowledge(query)` searches a local markdown corpus and returns ranked passages,
   each carrying the source file it came from. An empty corpus or a no-match query returns an empty
   result, not an error.
3. **AC3** — `lookup_knowledge` is implemented against a `KnowledgeSource` Protocol. Swapping the
   local corpus for another implementation requires **no change** to the tool, its schema, or its
   registration — proven by a test that runs the tool against a second implementation.
4. **AC4** — Every tool is exposed through one registry mapping name → (JSON schema, callable).
   Looking up an unknown name raises a typed error naming the tool.
5. **AC5** — Every tool's JSON schema is valid for a Foundry `FunctionTool`: an object with typed
   properties, a `required` list, and `additionalProperties: false`.
6. **AC6** — **No tool module decides anything.** No module under `tools/` imports the agent, the
   model, or another tool, and none branches on which tool to call. Enforced by a test that inspects
   imports (§8).
7. **AC7** — `agent.yaml` declares the agent's name, instructions, model alias, version and its three
   tools; a loader validates it and rejects a file that names a tool the registry doesn't have.
8. **AC8** — `apply_agent.py` reads `agent.yaml` and creates an agent version through the Agent
   Service SDK, printing the resulting name and version. Run twice, it creates a second version
   rather than failing.
9. **AC9** — **The spike answers O-8**: whether `responses.create(stream=True)` drives a prompt agent
   whose model is `apim-analytics-demo/gpt-5.4`. Result recorded in `docs/REFERENCES.md` either way.
10. **AC10** — **The spike answers O-1**: the real stream event names for reasoning summaries, text,
    function calls and MCP calls, recorded as a fixture under `tests/fixtures/recorded/`.
11. **AC11** — `PromptAgentAdapter` satisfies `HarnessAdapter` and **passes the spec 001 conformance
    suite unedited**, replaying the recorded fixture.
12. **AC12** — `ai/` gates green.

## Contract / data impact

- Consumes the §9 contract. Does not change it — unless the spike reveals an event the vocabulary
  can't express (e.g. an MCP approval request), which would be its own spec.
- Creates `agent.yaml` as our schema. `docs/harness-comparison.md` already explains why it is ours
  and not Foundry's deprecated one; it moves if this changes.
- `docs/REFERENCES.md` gains the spike's findings (§10).

## Open questions (clarify before planning)

- [ ] **O-8 / O-9 / O-1 / O-3 — all blocked on Azure access.** The `az` session is authenticated as
      `reginaldo.silva@belake.ai`, whose tenants do **not** include subscription
      `7a4e9773-94ea-45a8-9b58-2701ed307318` where `foundry-analytics-demo` lives. The spike is
      written and ready; it cannot run until `az login` reaches that tenant.
- [x] Should the tools be async? → **No.** Both are synchronous and fast. The BFF runs them in a
      thread if it ever needs to. Making them async would add ceremony for no benefit.
- [x] Should `lookup_knowledge` do embeddings? → **No.** A scored keyword match over a small markdown
      corpus is honest for a reference repo, and keeps the swap to Foundry IQ the interesting part.
      A fake local "semantic" search would imply a capability it doesn't have (§5).
- [x] Does the agent get created per environment or once? → Per `azd` environment, by name. Foundry
      versions each `create_version` call, which is the rollback story.

## Out of scope / deferred

- Foundry IQ replacing the local corpus → Phase 4. The Protocol is the seam.
- MCP approval handling, if O-3 shows `require_approval: "never"` is rejected → its own spec.
