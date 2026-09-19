# Spec: What this build is talking to

| | |
|---|---|
| **ID** | 032-connection-panel |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |
| **Clarified** | 2026-09-19 |

## Problem / motivation

`GET /config` reports more than the app shows. It carries the harness, the agent and its version, the
model, whether inference routes through the gateway, whether tracing is enabled and whether the
gateway writes spans, whether speech and voice are available, the WebRTC api-version, the full event
vocabulary, and a mapping report saying how many Foundry event names have been verified against a
real run and which have not.

The app shows four of those: the model and the gateway flag in the rail's footer, the harness badge
in the header, and the agent name beside it. The rest — including the one that is pure constitution
§10 in numeric form, *this many event names verified, these ones not* — is visible only by curling
the endpoint.

That is the wrong way round for this repository. A reader's first question in front of a deployed
demo is *what am I actually looking at* — which project, which model, through the gateway or not,
with tracing or not — and answering it currently requires reading the source.

## Goals

- **One place that says what this deployment is**, readable without the terminal.
- Include the **event-mapping report**, because it is the app's own account of what §10 has and has
  not verified.
- Be **read-only**, obviously and by construction.

## Non-goals

- **Nothing is editable here.** These are facts about a deployment, decided by environment and by
  infrastructure. A field that looked editable would be a lie about who is in charge, and an endpoint
  that accepted one would be a configuration-writing surface this project does not want.
- **No secrets, no endpoints, no resource identifiers that are not already public in `GET /config`.**
  This spec renders what the endpoint already returns and does not extend it to carry more.
- **No health checks, no live probing.** `GET /health` exists; this is not a monitoring screen.
- No change to the `AgentEvent` set (§9), and **no new field on `GET /config`** — clarify resolved
  every open question without needing one.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**The panel lives at its own address**, `/about`, beside `/agents` and `/history` (spec 024). It is
the thing a reader wants to send to somebody else — *here is what that deployment is* — and a modal
cannot be linked. It is a fifth ordinary screen, so it adds no interaction pattern to translate or
to audit in spec 040's accessibility pass.

**It is not where the browser's preferences go.** Spec 036's preferences are what *this browser*
keeps and they are editable; this is what the *deployment* decided and it is read-only by
construction. That is the same distinction spec 021 built the history feature around, and a toggle
sitting beside a fact would blur it — which is what the non-goals mean by "a field that looked
editable would be a lie about who is in charge". Keeping them apart is also what lets AC2 be a clean
assertion about a whole screen rather than about half of one.

**The panel** groups what the endpoint reports into the questions a reader actually asks:

- **Who answers** — the Foundry project, the configured agent, its version, the harness driving it,
  the model. The project name is shown: *which project am I looking at* is the first question this
  panel exists to answer, and the name is already in `GET /config`, so the screen discloses nothing
  a reader of the endpoint did not already have. The project **endpoint** stays off the screen, as
  it is today.
- **How inference routes** — through the AI Gateway or direct, which the model name's shape already
  encodes and which the config states outright.
- **What is observable** — whether tracing is enabled, and whether the gateway writes spans. This is
  where a reader learns why the trace panel is empty before they conclude the app is broken.
- **What voice can do** — whether Voice Live is available and on which api-version.
- **The event contract** — the nine event types, and the mapping report: how many Foundry event
  names have been verified against a recorded run, and which have not. The unverified ones are named,
  not counted. That list is the project being honest about itself (§5, §10) and it is the most
  interesting thing on the panel.
- **What this build may change** — whether it can roll an agent back to an earlier version
  (spec 031). It is the app's only write and it is off by default, so a reader looking at a
  deployment where the control never appears learns here that this is configuration rather than a
  missing feature.

**Unverified event names are named, not linked.** One translated sentence carries what a link would
only point at — that these are mapped from documented payload shapes and have not been seen in a
recorded run. A hardcoded repository URL would be wrong for every fork, and this app holds no source
of truth for its own address.

**When `GET /config` has not answered**, the panel says it is loading. When it has **failed**, the
panel says so — which is a different fact from a deployment with nothing configured, and the app
already keeps those apart (021 AC3).

**The rail's footer keeps its two lines.** It is the glance; this is the look. The footer links here
rather than growing.

## Acceptance criteria

1. **AC1** — The panel renders every field `GET /config` returns, grouped into the sections above.
   A field the BFF adds and the panel does not render is a **test failure**, not a silent omission:
   the panel's coverage is checked against the BFF's own response shape, the way the agents mirror
   already is (§4). Spec 031's `agents.can_promote` is the case that proves it.
2. **AC2** — No control in the panel writes: no form, no toggle, no request other than the config
   read (asserted).
3. **AC3** — The mapping report renders the verified count, the total, and the unverified event
   names individually.
4. **AC4** — With the mapping report reporting nothing unverified, the panel says so rather than
   rendering an empty list.
5. **AC5** — A field the config does not carry renders as not reported, never as a default or a
   guess (§5).
6. **AC6** — While the config is loading the panel says loading; when it failed the panel says it
   failed, and the two states are distinguishable.
7. **AC7** — The rail's footer still renders the model and the gateway line, and offers a way into
   the panel.
8. **AC8** — The panel renders identically for a deployment with voice disabled, tracing disabled,
   and no gateway — each stated, none omitted.
9. **AC9** — Every new string ships `en` + `pt`, including a translated name for each config field
   and each event type.
10. **AC10** — The panel is at `/about`, parses and builds through `route.ts` like every other
    address, and survives a reload (spec 024).
11. **AC11** — The panel renders no editable control of any kind, and the browser's preferences are
    not on it.
12. **AC12** — The unverified event names render as text, with the sentence that says what
    unverified means, and the panel contains no external link.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). The nine event types are rendered from `event_types` as the config reports them — the frontend does not keep its own list to display (§4). |
| **`GET /config`** | Read as it is. If a field is added for this panel, it is added because the fact is missing, not because the panel wants a nicer shape. |
| **Route** | `route.ts` gains `{ name: 'about' }` and `/about`. That module stays the single source of truth for the scheme (spec 024); nothing builds the path by hand. |
| **Drift** | The panel's field coverage is asserted against `backend/app/routers/config.py`, so a new config field fails CI here rather than going unrendered (§4, AC1). |
| **Docs** | `docs/architecture.md` — the panel is the screen version of what that page describes; they must agree, and the panel is generated from config while the page is written, so §4 says one of them defers to the other. |

## Out of scope / deferred

- Anything editable. The browser's preferences are spec 036 and live elsewhere.
- Health, uptime, or live service status.
- Showing infrastructure identifiers not already in `GET /config` — the project **endpoint** in
  particular stays off the screen.
- Linking out to this repository's documentation.
