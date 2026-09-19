# Spec: The agent, inspected

| | |
|---|---|
| **ID** | 030-agent-inspector |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 · clarified 2026-09-19 |

## Problem / motivation

The agents screen answers *which agents exist*. It does not answer *what this agent is*, which is the
question a reader has the moment they see ten of them: what is it told to do, what tools does it
have, what model serves it, is reasoning configured, which version am I talking to.

Today the only way to find out is to open `ai/harness/_shared/agent_core.yaml` in an editor — which
works for the two agents this repository owns and not at all for the other eight in the project,
whose definitions are not in this repository and never will be. For a teaching app whose whole
subject is *the agent runs in Foundry, this is the app around it*, being unable to show what runs in
Foundry is a conspicuous gap.

It is also the honest half of the editing question. Reading an agent's definition is a read;
`GET /agents` is read-only by construction (019) and this keeps it that way.

## Goals

- **Open an agent and see what it is**: instructions, tools with their schemas, model, served
  version and its status, and how reasoning is configured.
- Show **what the service reports**, and nothing else.
- Make the two harnesses comparable by reading both, in the same shape, from the same source.

## Non-goals

- **No editing.** Not instructions, not tools, not the model. The definition's source of truth is
  `agent_core.yaml` plus each harness's `agent.yaml`, and a browser form writing to Foundry would be
  a second source drifting from the first (§4). Spec 041 owns the variant that does not.
- **No reading the repository's YAML to fill gaps.** When the service does not report a field, the
  screen says it was not reported. Filling it from the repo would show a reader the repository's
  intention as if it were the deployment's state (§5) — and would be wrong the moment someone
  applied a version from another machine.
- **No version history** — spec 031.
- **No drift check against the repository's YAML.** Comparing what is deployed with what
  `agent_core.yaml` says is a second question — what counts as a difference, how to render it, what
  to do about it — and it applies to two of the ten agents. Spec 041 already exists to produce a
  diff; that is its home.
- **No environment variables.** A hosted agent's definition carries them and the recorded listing
  holds `KEY_VAULT_URI` among them. Shipping a container's environment to the browser is how a
  secret leaves by accident later, so the detail carries the container's **shape** — image, cpu,
  memory, protocol versions — and not its environment. The one variable the screen needs, the model
  deployment name, already arrives as `model` (spec 019).
- **No running anything.** Inspecting is not talking to it.
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Opening** an agent from its card goes to `/agents/{name}`, its own address. Instructions run to
two thousand characters and a function tool carries a JSON schema; neither fits a 268px card or a
320px panel, and an addressable detail is a **link** — which in a teaching repository is half the
value, because "look at what this agent is told to do" can be sent to somebody. The detail shows: name, kind, served version
and status, model, the harness this build would drive it with, and the same selectability and reason
the card carries. Choosing it from here selects it, exactly as the card does.

**Instructions** render as text, in a block that can be read and copied. They are frequently the
single most useful thing on the screen and they are long; the block scrolls rather than the page.

**Tools** render as a list: name, type, and — for a function tool — its parameter schema, readable
and copyable. An MCP tool names its server and its approval setting. The screen says who executes
each one for this harness, because that distinction is the project's central lesson and the reader
is looking straight at the place to say it.

**Reasoning configuration** renders when the service reports it, with the detail level. This is where
a reader learns why a reasoning card is empty — spec 015's "a turn with no summary is a normal
state" becomes checkable instead of folkloric.

**A field the service did not report** is shown as not reported, by name. An agent the service could
not describe at all shows the failure code, translated, the way the listing already does (019 AC3).

**An agent from outside this repository** renders exactly like the two that are in it. No field is
hidden because we did not write it, and none is filled because we did. The recorded listing carries
`instructions`, `model` and `tools` for every prompt agent in the project, ours and not — and for
five of them the instructions come back as the **empty string**, which is what those agents really
are. That is why *reported and empty* and *not reported* must stay two different things on this
screen: the first is a fact about the agent, the second is a fact about the service.

**A hosted agent shows what a hosted agent is.** Its definition carries no instructions, no tools and
no model — it carries a container: an image, a cpu and memory allocation, and the protocol versions
it speaks (verified against the recorded listing). So that is what the detail shows, and the absent
fields are reported as not reported rather than left to look like an error.

**One read answers the screen.** `GET {project_endpoint}/agents?api-version=v1` already returns every
field above for every agent, so the detail needs no second call per agent — the same finding spec
019 made about `kind`, holding for the whole definition.

## Acceptance criteria

1. **AC1** — An agent card opens `/agents/{name}`, which parses and builds through `route.ts` and
   renders that agent's detail; the address survives a reload.
2. **AC2** — The detail renders instructions, tools, model, served version, version status, kind and
   harness, from the service's response.
3. **AC3** — A function tool renders its name, description and parameter schema; an MCP tool renders
   its server label, server URL and approval setting. The service types every tool, and narrowing
   that to the two kinds this app renders — treating an unknown type as a function tool rather than
   dropping it — is done in the BFF, once (§4).
4. **AC4** — Each tool states who executes it for the harness that would drive this agent, read from
   the BFF — not derived in the frontend (§4).
5. **AC5** — A field the service did not report renders as not reported, and is never filled from
   repository configuration (asserted against the recorded listing, where `testagentdemo` has no
   `tools` key at all). A field reported **empty** renders as empty, not as not reported.
6. **AC6** — Reasoning configuration renders when reported and is absent when not. Only two of the
   ten recorded agents report it, so absent is the ordinary case, not a fault.
7. **AC7** — Instructions and each schema can be copied.
8. **AC8** — A detail that could not be read renders the failure code translated, and never an empty
   detail standing in for a failure (019 AC3's rule).
9. **AC9** — Selecting the agent from the detail behaves exactly as selecting it from its card
   (019 AC7): it starts a new conversation and returns to the chat.
10. **AC10** — Nothing in the detail writes: no request other than a read is issued from this view
    (asserted).
11. **AC11** — A hosted agent renders its container's image, cpu, memory and protocol versions, and
    **never its environment variables** (asserted against the recorded listing, which holds a
    `KEY_VAULT_URI` among them).
12. **AC12** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **`GET /agents`** | Gains a sibling, `GET /agents/{name}`, answered from the **same listing call** — the service already returns the whole definition, so no second upstream request exists. Read-only; spec 019's non-goal is unchanged and this spec re-states it. |
| **`AgentSummary` ↔ `AgentRow`** | The Python dataclass stays the source of truth and the TypeScript type mirrors it, with the parity test that already exists (§4). |
| **Executor attribution** | Comes from the BFF alongside the tool, for the same reason `harness` does: `HARNESS_FOR_KIND` and the tool registry are the BFF's knowledge, and a copy of the rule in TypeScript is the §4 violation. |
| **§10** | **Answered from the recording, not assumed.** `backend/tests/fixtures/agents-listing-20260916.json` (10 agents, captured from the live project) shows a prompt agent's definition carrying `instructions` · `model` · `tools` · `reasoning`, and a hosted agent's carrying `container_configuration.image` · `cpu` · `memory` · `protocol_versions` · `environment_variables` and none of the former. Recorded in `docs/REFERENCES.md`. |
| **Docs** | `docs/harness-comparison.md` — the screen now shows what the table asserts. |

## Out of scope / deferred

- Editing, in any form (spec 041 for the variant that produces a diff).
- Version history and rollback (spec 031).
- Showing an agent's evaluation or usage statistics.
