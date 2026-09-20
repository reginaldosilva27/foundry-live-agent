# Spec: Versions, and going back to one

| | |
|---|---|
| **ID** | 031-agent-versions |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |
| **Clarified** | 2026-09-19 |

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

## How promoting actually works

Read from the shipped `azure-ai-projects` 2.6.0 typespec (§10 — see *Contract / data impact* for what
that does and does not settle). There is **no promote verb**. Going back to a version is a
merge-patch on the agent endpoint's *routing*:

```
agents.update_details(
    agent_name,
    agent_endpoint=AgentEndpointConfig(
        version_selector=VersionSelector(
            version_selection_rules=[
                FixedRatioVersionSelectionRule(agent_version="3", traffic_percentage=100)
            ]
        )
    ),
)
```

Two consequences shape everything below. First, **the body carries no definition** — this call
cannot author an agent even by mistake, which is the property the non-goals wanted and an
acceptance criterion asserts. Second, **the selector, not `versions.latest`, is what answers.**

## The served version is not the latest version

Today `backend/app/agents.py` documents `data[].versions.latest.version` as *"the served version"*,
and derives `version_not_active` from that version's status. That is true only because nobody has
ever pinned anything. The moment this spec ships, pinning version 3 while 8 is the newest makes
those two words come apart, and every screen that says "version" today would be lying.

So the app gains **one** corrected concept, not two:

> **`served_version`** — the version the endpoint's selector pins, when it carries one; otherwise
> `versions.latest.version`.

`version_not_active` follows it: the status that matters is the served version's, not the newest
one's. The listing fixture has no `agent_endpoint` key at all, so the fallback branch is today's
behaviour exactly — the correction ships **dormant**, changing nothing on screen until someone
promotes, and a test covers both branches.

**Where it is resolved matters.** `GET {project_endpoint}/agents` does not carry `agent_endpoint`
(the field is absent, not null, on all ten agents — consistent with nothing ever being pinned, and
not proof the listing would omit it if something were). Spec 030 verified that the listing needs no
per-agent call, and this spec does not spend that: the **agents listing is unchanged**, one call,
and the rail's badge is labelled as the *latest* version. The **agent detail screen** — which this
spec is already extending with a version list — is authoritative: it reads the agent directly, and
that is the only place `served_version` is resolved and shown.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**The list** sits with the agent's detail (spec 030): each version with its identifier, its status,
when it was created, and the model it names. The served one is marked, and when it is not the newest
the screen says so plainly — a pinned project is an unusual state and reads as one. What the service
does not report about a version is shown as not reported, never inferred. A hosted agent's version
has no model at all (spec 030), which is that same rule, not a special case.

**Versions of every agent list.** That is a read, and the other eight agents in the project are as
interesting to look at as ours.

**Promoting is offered on this repository's own agents only** — the names in `ai/harness/*/agent.yaml`,
which is where that fact already lives (§4). A version row on any other agent carries the code
`not_owned` and no control, and **the BFF refuses the write too**: a restriction only the UI honours
is not a restriction. This bounds the blast radius to what this repository authored, which is the
same sentence the non-goals use to justify promoting at all.

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

**Nothing is recorded in the app.** This app has no notion of a user, so a "who" it printed would be
invented, which is the dishonesty §5 names. The screen shows current truth instead — the served
version, freshly read. `SECURITY.md` says where the record does live: the actor is the BFF's own
managed identity, the durable trail is Azure's, and a BFF shared by several people makes a promotion
unattributable by design.

## Acceptance criteria

1. **AC1** — An agent's versions render newest first with identifier, status, creation time and
   model, and the served one is marked.
2. **AC2** — A field the service did not report renders as not reported.
3. **AC3** — Promote is offered only on a version that is not served, only when the BFF reports it
   can write, and only on an agent this repository owns.
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
11. **AC11** — `served_version` is the version the endpoint's selector pins when it carries one, and
    `versions.latest.version` when it does not; `version_not_active` reads the served version's
    status. Both branches are tested.
12. **AC12** — The agents listing still makes exactly one upstream call and no per-agent call, and
    its version is labelled as the latest rather than the served one. A test asserts the absence of
    the extra call.
13. **AC13** — The BFF refuses a promote on an agent this repository does not own, with the code
    `not_owned`, even when the write flag is on and the caller holds the role.
14. **AC14** — The promote request carries only an agent name and a version identifier. A test
    asserts that no agent definition can travel on it.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **New write endpoint** | The first one in the app. It names the agent and the version and does nothing else — no body that could carry a definition, so this route can never become a way to author an agent (AC14). |
| **`GET /config`** | Gains whether this deployment can write, so the UI can decline to offer what will fail. The BFF is the source of truth for that (§4). |
| **New setting** | One opt-in env var, **default false**, gating both the route and the `/config` capability. It is the first boolean capability flag here — every other one is derived from the presence of configuration (`pricing_enabled`, `voice_enabled`, `tracing_enabled`) — because the enabling fact is a *permission*, not an address. The plan names it. |
| **RBAC / §-zero-secrets** | Writing needs a role on the project that reading does not. Entra ID via `DefaultAzureCredential`, as everywhere. The security consequence is real and belongs in the spec: **anyone who can reach this BFF can change which version the project serves** — which is why the flag is off by default. The flag reveals a control; it cannot grant a permission the identity lacks, so a deployment that turns it on without the role gets AC8's translated failure. No Bicep exists yet, so the role assignment is documented as a manual step rather than shipped as unverified IaC (§5). |
| **Ownership** | The promotable set is derived from the `name` in each `ai/harness/*/agent.yaml` — no new source of truth, and a fork that edits those files gets its own agents. |
| **§10 — what is and is not verified** | The call shape above is read from the shipped `azure-ai-projects` 2.6.0 typespec, not from memory and not from a doc page. **Not verified against the live service:** whether `agents.get()` returns `agent_endpoint` populated, whether `update_details` accepts this selector, and which role it requires. `az` on the author's machine is a broken build (`Bad CPU type in executable`), so no credential was available. This is recorded as an open item in `docs/REFERENCES.md` — *not* guessed silently — and is safe to ship because the path is off by default. No fixture is hand-written to make a test pass (§5); the write is tested at the seam, and the live round trip is recorded when `az` works. **Amended 2026-09-20:** `az` was never broken — the Intel build shadowed a working `arm64` one — and the read half was made. `agents.get()` *does* return `agent_endpoint`, on every agent, and an unpinned one names the sentinel `@latest`, which this spec read as a pin. Corrected in `_pinned_version`; see `docs/REFERENCES.md`. The **write** half remains unverified. |
| **Docs** | `docs/architecture.md` and the harness docs — the rollback story gains its demonstrated form. `SECURITY.md` — the new write surface, and where the audit trail actually lives. `docs/REFERENCES.md` — the call shape and the open verification item. |

## Out of scope / deferred

- Creating or deleting versions.
- Diffing a served version against the repository's YAML.
- Any notion of an identity or an audit log in this app.
- Traffic splitting. The type models a *list* of weighted rules while the documented behaviour is
  one version at 100% (`docs/REFERENCES.md`); this app sends exactly one rule at 100% and records
  the disagreement rather than exploring it.
