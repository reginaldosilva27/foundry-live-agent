# Spec: Versions, and going back to one

| | |
|---|---|
| **ID** | 031-agent-versions |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

`apply_agent.py` says it plainly: every run creates a new immutable version, and that is the rollback
story. The app shows one number — the served version — and offers no way to see the others or to go
back to one.

The rollback story is therefore told and never demonstrated, in a repository that exists to
demonstrate. It also has teeth in the small: spec 012's voice, spec 016's spoken preamble and spec
015's `detailed` reasoning were each applied as a new version after listening to the previous one,
and every one of those iterations was a moment where "put the old one back" was the thing someone
wanted. The comment on version 4 in `prompt_agent/agent.yaml` is literally a note about a version
that behaved worse.

This is also the first spec in the UI backlog that **writes to Foundry**. That deserves its own
paragraph rather than a line in the plan, which is why it is a spec of its own and not part of the
inspector.

## Goals

- **See an agent's versions**, newest first, with what distinguishes them.
- **Promote a previous version**, so the rollback story is a thing you can do.
- Make the risk of that visible and deliberate — it changes what everyone talking to this project
  gets, not just this browser.

## Non-goals

- **No creating a version from the browser.** Creation stays with `apply_agent.py` and `azd`, from a
  definition in the repository (§4). Promoting an existing version selects among things the
  repository already produced; creating one would make the browser an author.
- **No deleting a version.** The record is the rollback story; removing from it is not this app's
  business.
- **No diffing a version against the repository's current YAML** — a good idea, and a different spec.
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**The list** sits with the agent's detail (spec 030): each version with its identifier, its status,
when it was created, and the model it names. The served one is marked. What the service does not
report about a version is shown as not reported, never inferred.

**Promoting** is an explicit action on a version that is not the served one. It asks first, and the
confirmation says what is actually true: this changes which version answers **for everyone using this
project**, not only in this browser, and it takes effect on the next turn. A reader who has only
ever seen browser-local settings in this app — history, favourites, the collapsed rail — needs that
sentence, because every other persistent thing here is local and this one is not.

**While it is happening** the control is busy and cannot be pressed twice. When it succeeds, the
listing and the header's version both reflect the new served version, read back from the service
rather than assumed from the request.

**When it fails**, the failure is shown with its code, translated (§7), and nothing on screen claims
a version that is not served. A permission failure is the expected case and reads as one: this build
is not allowed to change the project, which is a configuration fact, not a bug.

**A deployment whose BFF cannot write** does not render the promote control at all. It renders the
list, which is a read. Showing a control that will always fail is the kind of thing §5 rules out.

## Acceptance criteria

1. **AC1** — An agent's versions render newest first with identifier, status, creation time and
   model, and the served one is marked.
2. **AC2** — A field the service did not report renders as not reported.
3. **AC3** — Promote is offered only on a version that is not served, and only when the BFF reports
   it can write.
4. **AC4** — Promote asks for confirmation, and the confirmation states that the change affects
   everyone using the project and applies from the next turn.
5. **AC5** — Cancelling the confirmation changes nothing and issues no request.
6. **AC6** — While a promotion is in flight the control is disabled and cannot be issued twice.
7. **AC7** — After a successful promotion the served version shown comes from a fresh read, not from
   the request that was sent.
8. **AC8** — A failed promotion renders its code translated, and the served version on screen is
   unchanged.
9. **AC9** — With write capability absent from `GET /config`, no promote control renders anywhere.
10. **AC10** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **New write endpoint** | The first one in the app. It names the agent and the version and does nothing else — no body that could carry a definition, so this route can never become a way to author an agent. |
| **`GET /config`** | Gains whether this deployment can write, so the UI can decline to offer what will fail. The BFF is the source of truth for that (§4). |
| **RBAC / §-zero-secrets** | Writing needs a role on the project that reading does not. Entra ID via `DefaultAzureCredential`, as everywhere. The security consequence is real and belongs in the spec: **anyone who can reach this BFF can change which version the project serves.** The plan must say how a deployment turns that off, and off must be the default. |
| **§10** | Which API promotes a version, under which `api-version`, and which role it requires, come from a doc read at the time of writing and recorded in `docs/REFERENCES.md`. |
| **Docs** | `docs/architecture.md` and the harness docs — the rollback story gains its demonstrated form. `SECURITY.md` — the new write surface. |

## Open questions (clarify before planning)

- [ ] Does the Responses/Agents v2 API expose promoting an existing version, or only creating a new
      one? If only creation, this spec becomes "create a version from an existing definition", which
      is a different and more dangerous thing — and may be a reason not to build it.
- [ ] Is write disabled by default by configuration, by RBAC, or by both?
- [ ] Should promotion be restricted to the agents this repository owns, refusing on the other eight
      in the project?
- [ ] Does a promotion need to be recorded anywhere in the app — who did it, when — given the app has
      no notion of a user?

## Out of scope / deferred

- Creating or deleting versions.
- Diffing a served version against the repository's YAML.
- Any notion of an identity or an audit log in this app.
