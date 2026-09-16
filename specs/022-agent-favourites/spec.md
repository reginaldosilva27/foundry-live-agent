# Spec: Favourite agents — the two you actually use, in the rail

| | |
|---|---|
| **ID** | 022-agent-favourites |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

The project this repository talks to has ten agents in it, and two of them are the point: the prompt
agent and the hosted one. The other eight are other people's work, living in the same Foundry
project, and spec 021 put all ten on their own screen — correctly, because hiding them would make
the project look like whatever this app happens to support (§5).

The cost is a round trip. Switching between the two agents the demo is *about* now means: leave the
conversation, cross to the agents screen, find the right card among ten, choose it, come back. The
composer's chip shortens that, but its menu is also all ten, in service order, with the two that
matter no easier to find than `globalpowerplataformaagent`.

The rail has the space and the right position for it. It is already where "who is answering" lives.

## Goals

- **Mark an agent as a favourite from its card**, and unmark it the same way.
- **Favourites appear in the rail**, under the agent that is answering, and choosing one switches to
  it exactly as the agents screen does.
- **The mark survives a reload** in this browser — like history and the collapsed rail, and honest
  about being local.
- The favourites list is **still the project's truth**: an agent that has been removed from the
  project, or that this build cannot drive, does not become choosable by having been starred.

## Non-goals

- **No favourites in Foundry.** This is a mark this browser keeps, not a property of the agent.
  Nothing is written to the service; `GET /agents` stays a read (019's non-goal, unchanged).
- **No reordering, no folders, no pinning to the top of the agents screen.** One flat list in the
  rail, in the order the service lists them.
- **No cap, no "recently used", no automatic favouriting.** The app never decides that an agent
  matters to you — that is the same reflex §8 forbids one level down.
- No change to the `AgentEvent` set (§9), to any BFF endpoint, or to `HARNESS_FOR_KIND`.
- No favourites on the composer chip's menu ordering. The menu stays the service's order; the rail
  is the shortcut this spec adds.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**On the agents screen**, each card carries a star control in its top-right corner: outline when the
agent is not a favourite, filled when it is, with an accessible name that says which action it
performs. It is a control *inside* a card that is itself a control, so it never selects the agent —
starring an agent you are not talking to does not switch to it.

**A card this build cannot drive can still be starred.** It is an honest thing to want: a reader
comparing agents may well want the workflow agent in front of them. It arrives in the rail dimmed,
not choosable, for the same reason its card is — and the reason stays available on the card.

**In the rail**, a **Favourites** group sits under the answering agent: monogram, name, and the same
dimming rule. Choosing one selects it and starts a new conversation (019 AC7), from wherever the
reader is. Collapsed, the group is monograms only, each still carrying its accessible name.

With no favourites, the group is absent entirely — not a heading over an empty box.

A favourite whose agent has left the project is **not rendered and not forgotten**: the listing is
the truth about what exists, so the row disappears while the project cannot see it, and comes back
if the agent does. Nothing tells the reader an agent was deleted, because this app does not know
that it was — it knows only that the project no longer lists it.

## Acceptance criteria

1. **AC1** — Each agent card renders a star control whose accessible name says whether it will
   favourite or unfavourite that agent.
2. **AC2** — Activating the star favourites the agent and does **not** select it: the answering
   agent is unchanged and no new conversation starts.
3. **AC3** — Activating the star on a favourited agent removes it.
4. **AC4** — A favourited agent renders in the rail's **Favourites** group, with its monogram and
   name; with no favourites, neither the group nor its heading renders.
5. **AC5** — Choosing a favourite in the rail selects that agent and resets the conversation, from
   either view.
6. **AC6** — A favourite that is not `selectable` renders in the rail dimmed and cannot be chosen.
7. **AC7** — A favourite whose agent is absent from the listing is not rendered, and is still
   present in storage — it returns when the listing does.
8. **AC8** — Favourites survive a remount: they are read back from browser storage.
9. **AC9** — With storage unavailable, starring still works for the session and nothing throws.
10. **AC10** — Every new string ships `en` + `pt`, and the star is an SVG icon — no glyph, no emoji
    (existing i18n and brand tests, extended).

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged. No endpoint, no request field, no event. |
| **New persisted data** | `fla.favourites.v1` — a list of agent **names**, in this browser. Its single source of truth is the frontend module named in the plan. Separate key from history and chrome, so one clearing does not take the others. |
| **Selectability** | Still the BFF's (`HARNESS_FOR_KIND`). A favourite renders `selectable` / `reason` exactly as the listing gives them; starring changes nothing about what can be driven (§4). |
| **Docs** | `docs/design-system.md` — the star and the rail group join the 021 layout contract. `specs/README.md` — index row. |

## Open questions (clarify before planning)

*Resolved with the author on 2026-09-16:*

- Favourites are **local to the browser**, like history — no write to Foundry.
- An agent this build cannot drive **can** be favourited, and arrives dimmed.
- Starring never switches agents.

## Out of scope / deferred

- Syncing favourites across devices or writing them to the service.
- Reordering, grouping or renaming favourites.
- Favourites influencing the composer chip's menu order.
- A "recently used" list, which would be the app deciding for the reader.
