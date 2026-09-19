# Plan: The event inspector

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

**Retention lives on the message.** `useAgentStream` already reduces each event into a `Turn`; it
now also appends the raw event to `message.events`, capped at `MAX_RETAINED`. Keeping it there
rather than in the inspector is what makes AC11 true — the panel can be opened at any moment and
sees the whole turn — and it means the inspector holds no state of its own beyond which event is
selected.

**`state/events.ts` does the summarising.** Pure: a one-line summary per event, and the collapsing
of `text_delta` / `reasoning_summary` into a run with a count and the accumulated text. Pure
because that is the part worth testing and none of it needs a DOM.

**The panel renders from `GET /config`.** The filter's options are `config.event_types` and the
contract summary is `config.event_mapping` — no list of event names in frontend source, which AC4
asserts by grepping.

**Alternative rejected:** retaining only while open. Cheaper, and wrong at the only moment the
panel matters.

## Affected files

- `frontend/src/hooks/useAgentStream.ts` — `AgentMessage.events`, capped.
- `frontend/src/state/events.ts` (new) + test — summaries and runs.
- `frontend/src/components/EventInspector.tsx` (new) + test.
- `frontend/src/App.tsx` — the toggle, off by default; the palette and key binding.
- `frontend/src/state/keys.ts`, `frontend/src/state/palette.ts` — the command.
- `frontend/src/i18n/strings.ts`, `frontend/src/styles/app.css`.
- `docs/how-it-works/streaming-events.md` — its live counterpart.

## Contract / data model changes (§4)

`AgentEvent` unchanged (§9). `AgentMessage` gains:

```ts
events: unknown[]      // raw, in arrival order, capped
truncated: boolean     // the cap bit, and the panel says so
```

Raw `unknown[]`, not `AgentEvent[]`: the inspector's job is to show what crossed the wire, and
typing it would quietly hide an event the contract does not know about — which is exactly what a
reader opens this for.

## i18n (§7)

`events.title` · `events.filter` · `events.all` · `events.runOf` (`{count} x {type}`) ·
`events.truncated` · `events.empty` · `events.copy` · `keys.toggleEvents`.

Event type names are **not** translated: they are contract identifiers and a reader compares them
with `contract.py`.

## Test strategy (§2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | events render in arrival order with a summary | `events.test.ts`, `EventInspector.test.tsx` |
| AC2 | deltas collapse into a run with a count and accumulated text | `events.test.ts` |
| AC3 | selecting one renders its full JSON, copyable | `EventInspector.test.tsx` |
| AC4 | the filter comes from config; no event-name list in `src/` | `EventInspector.test.tsx` |
| AC5 | the mapping report renders in full | `EventInspector.test.tsx` |
| AC6/AC7 | no request; the same turn produces the same messages either way | `useAgentStream` test |
| AC8 | an errored or stopped turn keeps its events | `useAgentStream` test |
| AC9 | closed by default | `App` test |
| AC11/AC12 | retention is unconditional; the cap is reported | `useAgentStream` test |
