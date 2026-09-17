# Spec: Addressable — the app gets URLs

| | |
|---|---|
| **ID** | 024-addressable |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

Nothing in this app can be linked to. `App.tsx` says so in its own comment: two booleans' worth of
navigation, so no router. That was the right call for spec 004 and it has been outgrown three times
since — an agents screen (019), stored conversations (021), and a trace panel that can be parked on
any turn (014).

The cost lands hardest on the thing this repository is for. It is teaching material. "Open that
trace and look at the span tree" is an instruction that cannot be sent to anyone, because there is
no address for a trace. Neither is there one for a conversation this browser has kept, nor for the
agents screen. The browser's Back button, meanwhile, leaves the app entirely — which is the one
thing every reader tries first.

## Goals

- **Every view the app can show has an address**, and opening that address shows it.
- **Back and Forward move through the app**, not out of it.
- A trace can be **handed to someone else** as a URL.
- The URL is an **address, not state**: nothing the app needs in order to be correct lives only in it.

## Non-goals

- **No server-side rendering, no data loading from the route.** The route selects what is already in
  memory or in this browser's storage; it never becomes a second way to fetch.
- **No conversation content in the URL.** A conversation's id addresses this browser's record of it.
  Sending that link to a colleague opens an empty app, correctly — they do not have the record, and
  the app must say so rather than invent one.
- No query-string configuration (no `?agent=`, no `?lang=`), which would make a link a way to
  configure someone else's app.
- No router library unless the plan shows the hand-rolled version is worse; four routes is not a
  dependency.
- No change to the `AgentEvent` set (§9) or to any BFF endpoint.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Four addresses.** The chat; the agents screen; one stored conversation; one trace. Their exact
shapes are the plan's business, but a trace's address is keyed on the Foundry `response_id`, because
that is the identifier that means the same thing to everybody who can read the workspace.

**Opening a conversation's address** restores exactly what reopening it from the rail restores —
the drawing, the Foundry `conversation_id`, and the agent that held it (021).

**Opening a trace's address** opens the app with the trace panel showing that response. When this
browser has the turn, the conversation is behind it. When it does not — the link came from someone
else — the panel still opens and reads the spans, because the spans live in the workspace, not in
this browser. The screen says plainly that the conversation itself is not on this machine.

**An address that resolves to nothing** — a conversation this browser never had, a deleted one —
shows the chat with a line saying so. It does not silently redirect, and it does not invent a
conversation.

**Navigating in the app writes the address.** Choosing an agent, opening a conversation, opening the
trace panel and moving it between turns all update the URL without reloading. Back undoes the last
of those.

## Acceptance criteria

1. **AC1** — Each of the four views has an address, and loading the app at that address renders that
   view.
2. **AC2** — Navigating between views in the app updates the address without a page load.
3. **AC3** — Back returns to the previously shown view; Forward returns to the one left.
4. **AC4** — Loading a stored conversation's address restores its messages, its Foundry
   `conversation_id` and its agent — identical to opening it from the rail.
5. **AC5** — Loading a trace's address opens the trace panel for that response id.
6. **AC6** — Loading a trace's address for a turn this browser does not have still opens the panel
   and requests the spans, and the screen states that the conversation is not stored here.
7. **AC7** — An address that resolves to no stored conversation renders the chat and a message
   saying so; it does not redirect and does not create a conversation.
8. **AC8** — No route reads or writes anything the app needs to be correct: `conversation_id` still
   comes from this browser's record, and the selected agent still comes from the agents state (§8).
9. **AC9** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged. |
| **URL scheme** | New public surface. Its single source of truth is the route module named in the plan; the sidebar, the agents screen, the trace panel and the answer actions all build links through it, never by string-concatenating a path (§4). |
| **Constitution §8** | The URL must stay a projection. A route that carried `conversation_id`, an agent choice, or anything Foundry owns would be state the app duplicates — the test is spec 021's: it never travels, nothing derives a decision from it. |
| **Deployment** | A single-page app on deep routes needs the host to serve `index.html` for unknown paths. Static Web Apps / Container Apps config is part of this change, not a follow-up. |
| **Docs** | `docs/architecture.md` — the route table. `README` ↔ `README.pt-BR` if either shows a URL. |

## Clarified decisions (2026-09-17)

**The four addresses**, flat rather than nested:

| Address | Shows |
|---|---|
| `/` | the chat |
| `/agents` | the agents screen |
| `/c/<id>` | a conversation this browser kept |
| `/trace/<response_id>` | the trace panel on that response |

- **The trace is keyed on Foundry's `response_id`, not nested under the conversation.** Nesting is
  tidier hierarchically and breaks the case the feature exists for: a trace link sent to a colleague
  must open, and they do not have `/c/<id>`. Spans live in the workspace, not in this browser
  (AC6).
- **The trace panel's turn position is not in the URL.** It is derived from the message the panel is
  on, and putting an index in the address would be a second way of saying where the panel is — and
  an index that points at nothing in a restored conversation.
- **`/compare` is reserved** for spec 020's side-by-side and is not implemented here. Reserving it
  costs nothing and stops 020 from having to redesign the scheme.
- **History API, not hash.** Clean URLs, because this repository's URLs end up in documentation and
  on slides. The price is a requirement on a host that **does not exist yet** — `infra/` is a stub
  with no `main.bicep` and the `justfile` has no frontend deploy. Under §5, unverifiable
  infrastructure is a documented manual step rather than unverified IaC: the requirement ("serve
  `index.html` for unknown paths") is written into `infra/README.md` in this change and satisfied
  when the deployment is built. A hash fallback was rejected as two route implementations to
  maintain, with detection that only fails in production.
- **Router library or hand-rolled** is an implementation decision and is made in `plan.md`.

## Open questions (clarify before planning)

*None — resolved above.*

## Out of scope / deferred

- Sharing a conversation with someone else (would mean the content leaving this browser — a
  different spec, and a privacy decision).
- Deep-linking into a single tool call inside a trace.
- Any route that configures the app for whoever opens it.
