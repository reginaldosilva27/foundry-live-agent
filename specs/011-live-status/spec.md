# Spec: The turn says what is happening right now

| | |
|---|---|
| **ID** | 011-live-status |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-15 |

## Problem / motivation

Now that the stream actually streams, the gaps are visible — and they are silent. Between the last
reasoning sentence and the first token of the answer, the agent may be calling `lookup_knowledge`,
waiting on an MCP search, or thinking again, and the screen shows the same thing for all three: a
finished reasoning card and nothing else. The tool rows appear only once the call has been *made*,
so the seconds before that are unexplained.

The information already exists in the event stream. A `tool_call` with no `tool_result` yet means a
call is in flight. A `reasoning_summary` with no text after it means the model is thinking. Nothing
needs to be invented or asked for — it needs to be said.

## Goals

- While a turn is streaming, one line says which of three things is happening: the agent is
  thinking, it is running a named tool, or it has not started yet.
- The line is derived **only** from the event stream — no timers, no guesses, nothing the events
  did not say (§5, §8).
- It disappears the moment the answer starts, because the answer and its caret are then the status.
- A tool being run is named, so "waiting" and "waiting on `microsoft_docs_search`" are different.

## Non-goals

- No elapsed-time counter, no progress bar, no estimate of how long anything will take.
- No new event type and no new field — the contract does not change (§9).
- No change to the voice overlay, which has its own live surface.
- No status for a settled turn. This is about the seconds while it runs.

## Clarified decisions (2026-09-15)

- **Three states, in priority order**: a call in flight wins over thinking, which wins over "not
  started". A turn calling two tools at once names the first still running.
- **The line goes away once text arrives.** Showing "writing the answer" next to the answer being
  written is noise.
- **The reasoning card keeps its own `thinking` label** — that one says *this card is still
  growing*; the status line says *this is what the agent is doing*. They agree by construction,
  because both read the same turn.

## User-facing behavior

Under the activity, while the turn is streaming, one quiet line with three animated dots:

- *The agent is working* — nothing has arrived yet.
- *Thinking* — a reasoning summary is arriving or has arrived, and no tool is running.
- *Calling* `lookup_knowledge` — a tool call has been made and its result has not come back.

All new prose ships `en` + `pt` (§7).

## Acceptance criteria

1. **AC1** — Given a streaming turn with no events yet, when it renders, then the line says the
   agent is working.
2. **AC2** — Given a streaming turn whose reasoning has arrived and with no running call, when it
   renders, then the line says it is thinking.
3. **AC3** — Given a streaming turn with a call that has no result yet, when it renders, then the
   line says it is calling that tool, **by name**.
4. **AC4** — Given that call's result arrives and the turn is still streaming with no answer text,
   when it renders, then the line goes back to thinking.
5. **AC5** — Given the answer has started arriving, when it renders, then the line is gone.
6. **AC6** — Given the turn has settled (done or error), when it renders, then the line is gone.

## Contract / data impact

None. Pure projection of the existing `Turn`, which is itself a projection of the event stream.

## Open questions (clarify before planning)

None — resolved above on 2026-09-15.

## Out of scope / deferred

- Naming the MCP server separately from the tool while a remote call is in flight.
- A status for the voice overlay, which already shows listening/muted/connecting.
