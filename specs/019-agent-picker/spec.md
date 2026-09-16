# Spec: The agents screen — pick which Foundry agent answers

| | |
|---|---|
| **ID** | 019-agent-picker |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

Which agent answers is decided by an environment variable, read once at process start.
`AGENT_HARNESS` and `AGENT_NAME` become an adapter in `build_harness()`, and the only way to change
either is to edit `.env` and restart the BFF.

That was the right shape while there was one harness. With spec 018 there are two, and the cost of
the current design becomes visible: **you cannot see the swap the repository is about**. A reader
who wants to feel the difference between a prompt agent and a hosted agent has to stop the server,
change a variable, start it again, and remember what the first one did.

It also hides the service. This app talks to a real Foundry project that has real agents in it, with
versions and kinds and models — and shows none of it. The header prints an agent name the BFF read
from its own environment, which is not the same thing as knowing what is deployed.

Spec 020 makes this urgent: you cannot run two agents side by side while exactly one of them is a
startup constant.

## Goals

- A **screen that lists the agents in the Foundry project**, read from the service: name, kind
  (prompt / hosted / workflow), the version its endpoint serves, that version's status, and the
  model. Not a list written in our code.
- **Choosing one binds the conversation to it**, without restarting anything.
- **Honesty about what this build can drive** (§5): an agent the app has no harness for is listed
  and *not selectable*, with the reason on it — never hidden, never offered and then failing.
- The header, the trace panel and the voice session all follow the selection rather than the
  environment.
- When the project cannot be listed — no permission, not configured, service error — the screen
  **says so** and the app keeps working against its configured default.

## Non-goals

- **No creating, editing, deleting or deploying agents from this UI.** It reads the project; it does
  not administer it. `ai/scripts/apply_agent.py` and `azd` stay the way agents are changed.
- **No agent-loop logic entering the app (§8).** Letting a *person* choose which agent answers is
  configuration. The app choosing for them, or switching agents based on the model's output, would
  be the violation.
- No change to the `AgentEvent` set (§9).
- No side-by-side execution — that is **spec 020**. This spec ends at "one conversation, one
  selected agent".
- No per-agent instructions editor, no model override, no tool toggles. Nothing that would let the
  browser reshape an agent at request time (§8).
- No persistence of the choice beyond the browser session.

## User-facing behavior

The sidebar's **Sessions** section becomes **Agents**. That section carries, today, one honest
entry saying there is no history to show (design note M9) — so the space is already there and
already admitting it has nothing to say.

Each agent is a row: its name, its kind, the version the endpoint serves and that version's status.
The one currently answering is marked. A row the app cannot run is dimmed and carries a short
reason — no harness for that kind in this build, the agent is disabled, or its latest version is
not `active`.

Selecting a row **starts a new conversation**, and the screen says so rather than letting the user
discover it. A Foundry conversation belongs to one agent; carrying it across would be the state leak
AC6 forbids. There is no confirmation dialog: the conversation is not persisted anywhere, and
"New session" is already one click away in the same column.

When the list cannot be read, the section shows the reason and a single row for the agent the BFF is
configured with — the app still works, and it does not pretend to have read anything.

**i18n (§7).** Every string here is new and ships `{ en, pt }`: the section title, the kind labels,
the version-status labels, the "currently answering" mark, each not-selectable reason, the "new
conversation started" notice, and the listing-failed message. Agent names, version numbers and model
ids are data and stay verbatim.

## Acceptance criteria

1. **AC1** — Given a configured Foundry project, when the BFF's agents endpoint is called, then it
   returns the project's agents with, for each: name, kind, the version its endpoint serves, that
   version's status and the model — obtained from the service, with no hardcoded entry in the
   response.
2. **AC2** — Given an agent's kind, then it is **read from the service**, not inferred from its
   name or from configuration. How the listing exposes it is verified against the live project and
   recorded with its date (§10); if the listing does not carry it, the spec records what second
   call does.
3. **AC3** — Given the endpoint is unavailable, unauthorised or unconfigured, then it responds with
   a typed, explicit failure the UI can render (§5), and never with an empty list presented as
   "no agents".
4. **AC4** — Given the agents section with agents listed, when it renders, then each row shows the
   agent's kind, its served version and that version's status, and exactly one row is marked as the
   one currently answering.
5. **AC5** — Given an agent this build cannot drive, when the section renders, then the row is
   present, not selectable, and carries the reason in the active language. The three reasons are
   distinguished: no harness for that kind, the agent is disabled, or the served version is not
   `active`.
6. **AC6** — Given the user selects a selectable agent, when they send the next message, then the
   turn runs against that agent and the header names it — with no process restart.
7. **AC7** — Given a conversation with messages, when the user selects a different agent, then a
   new conversation starts, the screen says so, and no Foundry conversation id crosses between the
   two agents.
8. **AC8** — Given a selected agent, when the user opens voice, then the session attaches to *that*
   agent; and when that agent cannot be driven by voice, the voice control is disabled with a
   reason (spec 018 AC9).
9. **AC9** — Given the listing fails, when the section renders, then it shows the failure and the
   app remains usable against its configured default agent.
10. **AC10** — Given the selection, when the page is reloaded, then it returns to the configured
    default. Nothing about the choice is persisted — matching the session list, which is not
    persisted either (§5: no drawing of a feature that does not exist).
11. **AC11** — Given every string this spec adds, then each exists in `en` and `pt` (§7), and the
    existing string-parity test covers them.
12. **AC12** — Given the existing chat, voice and trace suites, then they still pass: an app started
    with no selection behaves exactly as it does today, driven by its environment.

## Contract / data impact

This is a **public contract change** and the reason this is its own spec.

- **New: an agents listing endpoint** on the BFF. Its response shape is a new contract with one
  source of truth on the backend, mirrored by the frontend type and by the API documentation, all
  moving in the same change (§4) — the way `BffConfig` mirrors `routers/config.py` today.
- **Changed: how a turn names its agent.** Today `POST /chat` runs whatever `build_harness()` built
  at startup. It must become able to run a named agent. Whether that is a field on the chat request
  or a session-scoped selection is a `plan.md` decision — but `GET /config`'s `harness` /
  `agent_name` stop being the whole truth, and everything reading them moves with it.
- **Changed: harness selection is no longer a startup singleton.** `backend/app/harness_factory.py`
  is the single place a harness name becomes an object and stays so; it gains the ability to do that
  per conversation. `AGENT_HARNESS` becomes the **default**, not the law.
- **How an agent maps to a harness** becomes a real rule that must live in exactly one place: the
  app has to decide, from what the listing says about an agent, which adapter can drive it.
- **`AgentEvent` (§9): unchanged.**
- **`docs/REFERENCES.md`** gains the listing API's endpoint, SDK call, `api-version` and the RBAC
  role it needs (§10).

## Clarified decisions

Taken 2026-09-16 with the user, except where the documentation settled it.

| # | Question | Decision |
|---|---|---|
| 1 | Where does the screen live? | **A panel in the sidebar**, replacing the Sessions section. No routing, no modal; the selected agent stays visible while you chat, which a modal cannot do. |
| 2 | Switching agents mid-conversation? | **Start a new conversation automatically and say so.** No confirmation dialog — nothing is persisted to lose, and "New session" is already in the same column. |
| 3 | Show every version, or the latest? | **The served version only**, with its number and status as columns. The documentation is explicit that an agent endpoint routes 100% of traffic to one version and that traffic splitting is unsupported — so listing the others would list things that cannot be chosen, and choosing one would need version routing, a declared non-goal. |
| 4 | Does the selection survive a reload? | **No** (AC10). |
| 5 | Does `AGENT_HARNESS` / `AGENT_NAME` still matter? | Yes — as the **default**, not the law. An app with no selection behaves exactly as today (AC12). |
| 6 | Which SDK call lists agents? | **Settled by the doc:** `project_client.agents.list()` on `azure-ai-projects>=2.3.0`; REST `GET {project_endpoint}/agents?api-version=v1` with the `https://ai.azure.com` audience. Per-agent detail via `agents.get(agent_name)`, versions via `agents.list_versions(agent_name)`. |
| 7 | Is there a field saying prompt vs hosted? | The version **definition** carries `kind` (`prompt` · `hosted` · `workflow`). Whether the *listing* surfaces it, or whether a second call per agent is needed, is **verified live** — AC2, not a guess (§10). |
| 8 | Agents from other projects? | **No.** One project, the one the BFF is configured with. |
| 9 | What does the not-selectable reason say? | Three distinct reasons, not one vague one: no harness for this kind, the agent is disabled, the served version is not `active` (AC5). All bilingual. |
| 10 | RBAC to list? | To be confirmed against the live project. The doc names **Foundry Project Manager** for *deploying* a hosted agent; listing is a read and is expected to need less, but "expected" is not "verified" (§10). |

## What the documentation already settles (§10)

Read 2026-09-16. Each goes into `docs/REFERENCES.md` in the implementing commit.

| Fact | Source |
|---|---|
| `project_client.agents.list()` · `agents.get(name)` · `agents.list_versions(name)`, `azure-ai-projects>=2.3.0` | [Manage hosted agents](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/manage-hosted-agent) |
| REST `GET {project_endpoint}/agents?api-version=v1`; `az rest` needs `--resource https://ai.azure.com` or auth fails | same |
| Version status values: `creating` · `active` · `failed` · `deleting` · `deleted`; provisioning typically 2–5 minutes | same |
| An agent can be **disabled**: the endpoint goes offline and rejects requests while versions stay intact | same |
| An agent endpoint serves **one version**, 100% of traffic; splitting is not supported | same |
| Draft versions (preview) are `draft-{timestamp}`, excluded from listings unless `include_drafts=true`, and never resolved as latest | same |
| Definition kinds are `prompt`, `hosted`, `workflow` | [agent.yaml reference](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/agent-yaml-reference) |

## Out of scope / deferred

- Creating or editing agents from the UI.
- Showing an agent's instructions or tool list on the screen (a natural follow-up; not needed to
  choose one).
- Remembering a favourite agent across browser sessions.
- Filtering or searching the list.
