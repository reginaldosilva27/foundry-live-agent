# Spec: The agent, inspected

| | |
|---|---|
| **ID** | 030-agent-inspector |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

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
- **No running anything.** Inspecting is not talking to it.
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Opening** an agent from its card on the agents screen shows its detail: name, kind, served version
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
hidden because we did not write it, and none is filled because we did.

## Acceptance criteria

1. **AC1** — An agent card opens a detail view for that agent.
2. **AC2** — The detail renders instructions, tools, model, served version, version status, kind and
   harness, from the service's response.
3. **AC3** — A function tool renders its name and parameter schema; an MCP tool renders its server
   label and approval setting.
4. **AC4** — Each tool states who executes it for the harness that would drive this agent, read from
   the BFF — not derived in the frontend (§4).
5. **AC5** — A field the service did not report renders as not reported, and is never filled from
   repository configuration (asserted against a fixture missing that field).
6. **AC6** — Reasoning configuration renders when reported and is absent when not.
7. **AC7** — Instructions and each schema can be copied.
8. **AC8** — A detail that could not be read renders the failure code translated, and never an empty
   detail standing in for a failure (019 AC3's rule).
9. **AC9** — Selecting the agent from the detail behaves exactly as selecting it from its card
   (019 AC7): it starts a new conversation and returns to the chat.
10. **AC10** — Nothing in the detail writes: no request other than a read is issued from this view
    (asserted).
11. **AC11** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **`GET /agents`** | Gains a detail read — either a richer row or a per-agent route. Either way it stays read-only; spec 019's non-goal is unchanged and this spec re-states it. |
| **`AgentSummary` ↔ `AgentRow`** | The Python dataclass stays the source of truth and the TypeScript type mirrors it, with the parity test that already exists (§4). |
| **Executor attribution** | Comes from the BFF alongside the tool, for the same reason `harness` does: `HARNESS_FOR_KIND` and the tool registry are the BFF's knowledge, and a copy of the rule in TypeScript is the §4 violation. |
| **§10** | Which fields the Agents v2 read actually returns — instructions? tool schemas? the reasoning block? — is verified against the live service and recorded, not assumed. Fixtures are recorded from real responses (§5). |
| **Docs** | `docs/harness-comparison.md` — the screen now shows what the table asserts. |

## Open questions (clarify before planning)

- [ ] Does the Agents v2 read return instructions and tool definitions for an agent this project did
      not create? If not, the spec shrinks to what it does return, and says so.
- [ ] Detail as a route (needs spec 024), a panel, or an expansion of the card?
- [ ] Does the detail show the *repository's* definition side by side for the two agents we own — a
      drift check — or is that a separate idea worth its own spec?
- [ ] For a hosted agent, is the container image and its sandbox part of what is shown?

## Out of scope / deferred

- Editing, in any form (spec 041 for the variant that produces a diff).
- Version history and rollback (spec 031).
- Showing an agent's evaluation or usage statistics.
