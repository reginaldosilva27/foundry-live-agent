# Spec: The event inspector

| | |
|---|---|
| **ID** | 038-event-inspector |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |
| **Clarified** | 2026-09-19 |

## Problem / motivation

The contract is the most reusable thing this repository has. Nine event types, closed, with the
argument for each written into `contract.py`: `executor` is constitution §8 expressed in the type
system; `arguments` stays a raw string because a half-arrived argument has no meaning; a turn with a
tool round trip produces two `response.completed` events, so usage must be summed and `done` held
back or the contract breaks.

None of that is visible in the running app. A reader can see the effects — a tool row, a reasoning
card, a usage figure — and never the events. To watch the stream they must open the browser's network
inspector and read an SSE body by hand, which is precisely the audience this project is trying not
to require that of.

`GET /config` already carries the raw material: the nine event types, and a mapping report saying how
many Foundry event names have been verified against a recorded run and which have not.

## Goals

- **Watch the events arrive**, in order, as the turn happens.
- **Read one event** in full.
- Put the **mapping report** beside them, so the contract's own honesty is on screen next to the
  contract working.

## Non-goals

- **No editing, injecting or replaying events.** Watching is watching. An app that could inject an
  event would be an app that could fake a run.
- **No second transport.** The inspector reads the events the app is already receiving; it does not
  open its own stream.
- **No decisions taken from it.** Nothing the inspector shows changes what the app does (§8).
- No change to the `AgentEvent` set (§9) — the point is to make the existing one visible.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**A panel** lists every event of the current turn as it arrives: its type, its sequence position, and
a one-line summary — the tool's name, the delta's length, the call id. High-frequency types
(`text_delta`, `reasoning_summary`) are collapsed into a running count with their accumulated text
available, or the list becomes unreadable within a second of a turn starting.

**Filtering by type** uses the nine types as reported by `GET /config`, not a list kept in the
frontend (§4).

**Selecting an event** shows it in full, as the JSON that crossed the wire, copyable.

**The contract summary** sits at the top: the nine types, and the mapping report — verified count,
total, and the unverified Foundry event names listed individually. That list is §10 in numeric form
and it is the reason to build this panel rather than a prettier one.

**The events are kept for every turn, always**, not only while the inspector is open. "Only while
open" would mean opening it mid-turn shows a partial list, and a panel whose first answer is "some
of what happened" is worth less than one that is always complete — especially since the turn a
reader opens it for is usually the one that just went wrong.

The cost is bounded and stated: each turn keeps at most **2000** raw events, and a turn that
exceeds that says so rather than silently dropping the rest. A long answer is a few hundred
`text_delta`s, so the cap is reached by a pathological turn and by nothing ordinary.

**It reads the events the app already received.** No second stream, no SSE frames — the frames are
a level below the contract this panel exists to show, and a framing bug would need a different tool.
Noted as deferred rather than folded in.

**It is toggled, not navigated to.** It shows the events of the turn on screen, so it lives beside
the chat like the trace panel does, reachable from the command palette and the keyboard (spec 025).
A route would take the reader away from the thing being inspected.

**It is a developer surface and reads as one**: monospaced, dense, off by default, and not in the way
of anyone using the app to talk to an agent.

**A turn that errored or was stopped** (spec 023) keeps its events; the inspector is often most
useful exactly there.

## Acceptance criteria

1. **AC1** — With the inspector open, each event of the current turn renders in arrival order with
   its type and a one-line summary.
2. **AC2** — `text_delta` and `reasoning_summary` render collapsed with a count, and their
   accumulated text is available.
3. **AC3** — Selecting an event renders its full JSON, copyable.
4. **AC4** — The type filter's options come from `GET /config`'s `event_types`; no list of event
   names exists in frontend source (asserted).
5. **AC5** — The panel renders the mapping report's verified count, total and each unverified name.
6. **AC6** — The inspector opens no network connection of its own (asserted).
7. **AC7** — Nothing in the inspector changes the app's behaviour: with it open and closed, the same
   turn produces the same messages (asserted).
8. **AC8** — A turn that errored or was stopped keeps its events in the inspector.
9. **AC9** — The inspector is closed by default.
10. **AC10** — Every new string ships `en` + `pt`; event type names are not translated, being
    contract identifiers.
11. **AC11** — Events are retained for a turn whether or not the inspector was open, so opening it
    mid-turn shows the whole turn.
12. **AC12** — A turn exceeding the retention cap says so, and does not silently drop events.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **Event retention** | The app currently reduces events into a turn and does not keep them. Keeping the raw events costs memory per turn; the plan decides whether they are kept always, only while the inspector is open, or bounded — and the honest constraint is that "only while open" means opening it mid-turn shows a partial list, which the panel must then say. |
| **Contract vocabulary** | `contract.py` is the source of truth; `events.ts` mirrors it with the existing parity test; the inspector renders from config (§4). Three places, one fact, already checked. |
| **Docs** | `docs/how-it-works/` — the streaming-events page gains its live counterpart. |

## Out of scope / deferred

- Injecting, editing or replaying events.
- Recording a session to a fixture file from the browser — tempting, and it would need a §5
  conversation about what counts as a recorded run.
- Any view of the voice session's events (spec 039).
- The SSE frames as delivered — a level below the contract, and where a framing bug would show.
