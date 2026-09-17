# Spec: Proposing a change to the agent

| | |
|---|---|
| **ID** | 041-propose-agent-change |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

The obvious feature — edit the agent's instructions on the screen and save — is the one this project
cannot have. §8 would permit it: a person configuring an agent is configuring, not running a loop.
§4 refuses it. `ai/harness/_shared/agent_core.yaml` is the single source of truth for what the agent
is, and it exists *because* two copies of those instructions drifting a sentence at a time would make
the repository's central claim — that only the harness changes between the two agents —
unfalsifiable. A browser form writing to Foundry creates the second copy on the first save, and the
comparison in `docs/harness-comparison.md` quietly stops meaning anything.

But the want underneath is real and worth serving. Changing the agent's instructions today means
finding the file, editing YAML, running `just agent`, and having no view of what the previous version
said — and the iteration loop that produced specs 012, 015, 016 and 017 was exactly that, repeatedly.

The variant that passes keeps the file as the truth and makes the screen a better editor *of the
file*. You edit; the app gives you the change as a diff to apply, not as a fact it has already
applied.

## Goals

- **Edit the agent's definition on screen** — instructions, and the fields the schema allows.
- **The result is a proposed change to the repository**, in a form that can be reviewed: a diff, a
  file to download, or a pull request.
- **Nothing is applied by the browser**, and the screen never implies that anything was.
- Make the **round trip visible**: this is how a change to an agent is supposed to travel.

## Non-goals

- **No write to Foundry.** Not from this screen, not as an option, not behind a flag. Applying stays
  with `apply_agent.py` and `azd`, from a definition in the repository (§4). Spec 031's version
  promotion is a different thing: choosing among versions the repository already produced.
- **No editing an agent this repository does not own.** The other eight agents in the project have
  their definitions elsewhere; proposing a change to a file we do not have is meaningless.
- **No preview of behaviour.** The app does not run the proposed instructions against anything —
  that would be inference the app decided to run (§8). Spec 020's side-by-side compares agents that
  exist.
- **No model-assisted rewriting of instructions.** Asking a model to improve the prompt is the app
  running its own inference; it is not in this spec at any effort level.
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Editing** starts from the agent's detail (spec 030) and opens the *repository's* definition — not
the served one — clearly labelled as such, because those two can differ and the difference is
information the reader needs.

**When they differ**, the screen says so before any editing: the deployment is serving something
other than what the repository describes. That is a drift warning and it is arguably the most useful
thing on the screen.

**The output is a diff**, shown before anything leaves: exactly which lines of which file change.
From there it can be downloaded as the modified file, copied as a patch, or — where the deployment is
configured for it — opened as a pull request.

**The screen never says "saved".** It says what it produced and what still has to happen: review,
merge, apply. A reader must not leave this screen believing the agent changed, because it did not.

**Validation before output.** The proposal is checked against our schema (`agent_spec.py`) and an
invalid one is reported with the failure, not written out.

**A deployment not configured for this** does not show the editor at all — the same rule spec 031
applies to promotion.

## Acceptance criteria

1. **AC1** — The editor opens the repository's definition for an agent this repository owns, labelled
   as the repository's, and is unavailable for every other agent.
2. **AC2** — When the served definition differs from the repository's, the screen states the
   difference before editing.
3. **AC3** — Producing a proposal renders a diff of exactly the files and lines that would change.
4. **AC4** — The proposal can be taken as the modified file and as a patch.
5. **AC5** — No request that writes to Foundry is issued from this screen, under any input
   (asserted — this is the §4/§8 guard).
6. **AC6** — The screen never reports that the agent was changed, updated or saved; its wording
   states what remains to be done (asserted against the strings).
7. **AC7** — A proposal failing schema validation is reported with its validation failure and
   produces no output.
8. **AC8** — With the deployment not configured for proposals, no editor is offered.
9. **AC9** — Where pull-request creation is configured, a failure to create one is reported with its
   code and leaves the diff available to take by hand.
10. **AC10** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **Reading the repository's YAML** | New BFF capability: the definition files become something the BFF reads and renders. It reads; it does not write them from a request. |
| **Schema** | `agent_spec.py` is the validator and stays the single source of truth for our schema (§4). The editor's fields are generated from it, or they are a second description of the schema. |
| **Pull-request creation** | If configured, it needs a credential for a code host — which is **not** an Azure service and therefore not covered by `DefaultAzureCredential`. That is a second third-party secret after `TAVILY_API_KEY`, and the constitution requires saying why and where the reader will hit it. The clarify step decides whether it is worth that at all. |
| **Docs** | `docs/development-workflow.md` — the proposal path beside the file-and-`just agent` path. `SECURITY.md` if a code-host credential ships. |

## Open questions (clarify before planning)

- [ ] Is pull-request creation in scope at all, given it costs a second third-party secret? Download
      and copy may be the whole of it.
- [ ] Which fields are editable — instructions only, or tools and model too? Tools are where a bad
      edit breaks a harness silently.
- [ ] Where does the BFF read the repository from — the deployed image, a mounted checkout? In a
      container the files are whatever was built, which may not be what `main` says.
- [ ] Does the drift warning (AC2) deserve to be its own thing, shown on the agents screen without
      anyone opening an editor?

## Out of scope / deferred

- Applying anything to Foundry.
- Editing agents outside this repository.
- Any model-assisted authoring.
- Previewing the proposed agent's behaviour.
