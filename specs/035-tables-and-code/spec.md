# Spec: Tables and code you can take

| | |
|---|---|
| **ID** | 035-tables-and-code |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

This agent answers with tables and with code more than with anything else — it is asked about Azure
configuration, about SDK versions, about what differs between two things — and both render as text
you can only select with the mouse.

Copying a code block means dragging across it, usually catching the line above. A wide table pushes
the conversation column sideways or gets cut, depending on the width. Neither is a hard problem; both
are the kind of thing that is invisible until someone tries to use an answer rather than read it.

The pieces are already installed. `remark-gfm` parses the tables, `highlight.js` colours the code,
and `useCopy` already handles the clipboard and its failure state for the answer actions.

## Goals

- **Take a code block** with one action, and know which language it is.
- **Take a table** as something a spreadsheet will open.
- **A wide table scrolls itself** rather than the page.

## Non-goals

- **No editing, no running, no "try this" button on a code block.** Executing what a model wrote is
  not something this app does.
- **No sorting or filtering a table.** It is an answer, not a data grid; sorting it would reorder
  something the model wrote for a reason.
- **No syntax highlighting changes** beyond naming the language already detected.
- No change to the `AgentEvent` set (§9), and nothing that issues a request.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**A code block** carries its language name and a copy control, revealed on hover and always present
to the keyboard. Copying reports success or failure with the same feedback the answer actions
already use, so there is one copy behaviour in the app and not two (§4).

**A block whose language was not detected** says nothing rather than guessing one.

**A table** carries a copy control offering it as delimited text that opens correctly in a
spreadsheet. The format the clarify step settles; the requirement is that a cell containing a comma
or a newline survives the round trip.

**A table wider than the column** scrolls horizontally inside its own container. The conversation
column never scrolls sideways, at any width.

**While streaming**, a block that has not closed yet carries no controls — there is nothing complete
to take — and gains them when the turn settles.

## Acceptance criteria

1. **AC1** — A fenced code block renders its detected language name; an undetected one renders no
   language.
2. **AC2** — A code block offers a copy control that is reachable by keyboard and has an accessible
   name.
3. **AC3** — Copying a code block places exactly its content on the clipboard — no language line, no
   surrounding whitespace.
4. **AC4** — Copy success and failure use the existing copy feedback (§4).
5. **AC5** — A table offers a copy control producing delimited text whose rows and columns match the
   rendered table.
6. **AC6** — A cell containing the delimiter, a quote or a newline survives the copy correctly
   (asserted with such a table).
7. **AC7** — A table wider than its column scrolls within its own container, and the conversation
   column does not scroll horizontally (existing layout test, extended).
8. **AC8** — A block or table inside a turn still streaming renders no copy control; it appears when
   the turn settles.
9. **AC9** — Rendering and copying issue no request (asserted).
10. **AC10** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **Copy behaviour** | `useCopy` stays the single source of truth for clipboard interaction and its feedback; these controls use it rather than re-implementing it (§4). |
| **Markdown rendering** | `Markdown.tsx`'s block memoisation must survive: controls are added without making each token re-render the settled blocks (spec 004 AC8). |
| **Docs** | None expected. |

## Open questions (clarify before planning)

- [ ] CSV or TSV for a table? TSV pastes into a spreadsheet without a dialog; CSV is the more
      expected file.
- [ ] Does the table copy also offer Markdown, which is what a reader pasting into a document wants?
- [ ] Does a code block get a download as well as a copy, or is copy enough?
- [ ] Do these controls appear in the trace panel's payload reader too, or does it already have its
      own copy behaviour to reuse?

## Out of scope / deferred

- Sorting, filtering or reformatting a table.
- Running or editing code.
- Line numbers, wrapping toggles, or diff rendering.
