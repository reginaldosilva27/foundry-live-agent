# Spec: The trace panel groups its calls, and opens one in a reader

| | |
|---|---|
| **ID** | 010-log-reader |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-15 |

## Problem / motivation

Spec 009 moved the tool payloads out of the chat and into the trace panel. That fixed the chat and
moved the problem: the panel is a 320px column, and an MCP search result is a page of documentation
rendered as one unwrapped line of JSON. Three calls in a turn means scrolling past thousands of
characters to find the one you came for — and the panel is the surface for *inspecting* a run, so
being unreadable there is worse than being unreadable in the chat.

Two things are wrong, and they are different. The panel **lists** every payload expanded, when what
a reader needs first is the list of calls. And there is **nowhere comfortable to read one**: a
narrow dark column is the wrong shape for a 4000-character JSON document.

## Goals

- The panel shows the calls of a turn as a compact, scannable group — not as a wall of payloads.
- Opening one call gives a reader with room: centred, wide, scrollable, with the payload formatted
  rather than dumped.
- JSON is shown as JSON — indented, so the structure is visible — and anything else is shown as it
  came, unaltered.
- Closing the reader returns you exactly where you were.

## Non-goals

- No syntax highlighting theme, no folding tree, no JSON path filter. A formatted, scrollable,
  readable payload is the goal; a JSON IDE is not.
- No copy-to-clipboard yet (deferred from spec 009; still deferred).
- No change to the chat, to the voice overlay, to the `AgentEvent` contract, or to any backend.
- No span data. That is still spec 005, and the panel still says so where spans would go.

## Clarified decisions (2026-09-15)

- **Collapsed by default, one line per call** in the panel, matching how the chat now reads.
- **A centred modal**, not a wider column: the reader is for one payload at a time, and it should
  use the width of the app rather than the width of the drawer.
- **Pretty-printing is best-effort and never lossy**: if the payload parses as JSON it is indented;
  if it does not, it is rendered exactly as received. Nothing is truncated or re-encoded (§5).
- **A call pressed in the chat** still opens the trace panel on that call — spec 009's behavior —
  and now that call is the one expanded.

## User-facing behavior

In the trace panel, the **Agent activity** section lists each call as one row: status, name,
executor tag, duration. Pressing a row opens a reader in the middle of the screen with that call's
arguments and its result or error, each formatted and scrollable, with the call's name and executor
in the header. The reader closes with its button, with `Escape`, or by pressing the backdrop. All
new prose ships `en` + `pt` (§7).

## Acceptance criteria

1. **AC1** — Given a turn with calls, when the trace panel renders, then each call is one row and
   no payload text is rendered in the panel.
2. **AC2** — Given a row in the panel, when it is pressed, then a reader opens showing that call's
   arguments and its result.
3. **AC3** — Given a payload that is valid JSON, when the reader shows it, then it is indented over
   multiple lines rather than shown as one line.
4. **AC4** — Given a payload that is not JSON, when the reader shows it, then it appears exactly as
   it was received.
5. **AC5** — Given a call that failed, when the reader shows it, then the error is shown in place of
   a result.
6. **AC6** — Given the reader is open, when `Escape` is pressed, then it closes and the panel is
   still there.
7. **AC7** — Given a call pressed from the **chat**, when the trace panel opens, then the reader
   opens on that call.

## Contract / data impact

None. No `AgentEvent`, no BFF, no harness, no configuration. `docs/how-it-works/function-call-round-trip.md`
describes where each half of a call is drawn and moves with this change (§4).

## Open questions (clarify before planning)

None — resolved above on 2026-09-15.

## Out of scope / deferred

- Copy to clipboard, and downloading a payload.
- Searching within a payload.
- Reading a payload from a turn other than the one the panel is showing.
