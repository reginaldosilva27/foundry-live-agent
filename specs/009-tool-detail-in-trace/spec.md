# Spec: The tool call stays in the chat; its payload moves to the trace panel

| | |
|---|---|
| **ID** | 009-tool-detail-in-trace |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-15 |

## Problem / motivation

An MCP search returns a page of documentation. The chat renders it in full, inside the tool card,
above the answer — so a single `microsoft_docs_search` puts several hundred lines of JSON between
the question and the answer to it. The reader scrolls past the machinery to reach the point.

The machinery is not the problem; the *payload* is. That a tool ran, which one, and who executed it
is the argument this project exists to make — spec 004 put it in the chat on purpose, and both
READMEs sell it. What does not belong next to the prose is the argument JSON and the full result:
those are for someone inspecting a run, and this app already has a panel for exactly that.

So: the chat keeps the fact, the trace panel gets the evidence.

## Goals

- A tool or MCP call takes **one line** in the chat: what ran, who ran it, whether it worked, how
  long it took.
- The arguments and the full result are one click away, in the trace panel.
- Nothing is lost. Every field the card used to show is still readable somewhere.
- The distinction the chat exists to teach — *the BFF executed this one, Foundry executed that one*
  — survives the shrink.

## Non-goals

- No change to the `AgentEvent` contract, the BFF, or any harness. This is a rendering change.
- No span tree, no Application Insights query — that is still spec 005, and the panel still says so.
- No change to the **voice overlay**, which has no trace panel beside it: there the full card stays,
  because it is the only place the detail can be read. **Superseded on 2026-09-15**: in a live
  session that full card buries the conversation you are listening to, so the overlay shows the
  compact row too and the payload is simply not offered during a call.
- No truncation, no "show more" inside the chat. A shortened payload in two places is worse than a
  whole one in the right place.

## Clarified decisions (2026-09-15)

- **Compact in the chat, complete in the trace** — rather than removing the call from the chat
  entirely. With the panel closed, a chat that shows no tool activity would hide the one thing this
  repository is built to show.
- **Clicking the line opens the panel on that call**, which is what makes "one click away" true.
- **The panel follows the selected turn**, defaulting to the newest. Opening `Traces` from a turn's
  meta line shows that turn.
- **The voice overlay keeps the full card** (see non-goals).

## User-facing behavior

In the chat, each call renders as a single row: a status mark, the tool's name, the executor tag
(`bff` / `foundry` / the MCP server's label), and the duration. The row is a button; pressing it
opens the trace panel with that call's arguments and result expanded.

The trace panel gains an **Agent activity** section above the spans placeholder, listing every call
of the turn being shown, each with its arguments and its result or error. New prose ships `en` +
`pt` (§7).

## Acceptance criteria

1. **AC1** — Given a turn with a tool call, when the chat renders it, then the call's arguments and
   result do **not** appear in the chat.
2. **AC2** — Given that same turn, when the chat renders it, then the call's name, executor tag and
   status are visible in one row.
3. **AC3** — Given the trace panel is showing that turn, when it renders, then the call's arguments
   and its result are both readable there.
4. **AC4** — Given the chat row for a call, when the user presses it, then the trace panel opens
   showing that call.
5. **AC5** — Given a call that failed, when the chat renders it, then the row reads as failed, and
   the error text is in the trace panel.
6. **AC6** — Given a turn with no calls, when the trace panel renders it, then the activity section
   says there were none rather than drawing an empty box.
7. **AC7** — Given a voice session, when the overlay renders a call, then it still shows the full
   card with arguments and result.

## Contract / data impact

None. `AgentEvent`, the BFF and the harnesses are untouched; this changes where the same `Turn` is
rendered. The one thing that must move together (§4) is the documentation that describes the UI:
both READMEs' feature table and `docs/how-it-works/function-call-round-trip.md`, which shows the
pair of events and says the UI renders them.

## Open questions (clarify before planning)

None — resolved above on 2026-09-15.

## Out of scope / deferred

- Copying a call's payload to the clipboard.
- Linking a call to its span once spec 005 lands. The activity section is where that will attach.
