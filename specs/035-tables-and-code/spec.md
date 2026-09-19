# Spec: Tables and code you can take

| | |
|---|---|
| **ID** | 035-tables-and-code |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |
| **Clarified** | 2026-09-19 |

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

**A table** carries a copy control offering it as **tab-separated** text. This is a *clipboard*
operation, not a file: a spreadsheet pastes TSV straight into cells, while CSV on the clipboard
lands in a single column or opens an import dialog. CSV would be the better answer to a question
nobody asked here — "download a file".

A cell containing a tab, a newline or a quote is **quoted, with inner quotes doubled** — the CSV
escaping rule, applied to a tab delimiter. Without it a single cell with a line break in it silently
shifts every column after it.

**There is no second control offering Markdown.** A reader pasting into a document already has it:
the answer actions copy `turn.text`, which is the model's own Markdown table, verbatim. A button
that produced a second version of the same thing would be a second source of truth for it (§4).

**A table wider than the column** scrolls horizontally inside its own container. The conversation
column never scrolls sideways, at any width.

**While streaming**, a block that has not closed yet carries no controls — there is nothing complete
to take — and gains them when the turn settles. The condition is the **turn**, not the fence: a
fence that has closed while the answer keeps arriving is complete, but the controls would still
appear mid-paragraph and move the text under the reader.

**The trace panel's payload reader is left alone.** It has no copy control today — checked, not
assumed — and adding one is a different surface with different content: a JSON payload somebody is
reading, not a code block inside an answer. Recorded below as a gap rather than folded in here.

## Acceptance criteria

1. **AC1** — A fenced code block renders its detected language name; an undetected one renders no
   language.
2. **AC2** — A code block offers a copy control that is reachable by keyboard and has an accessible
   name.
3. **AC3** — Copying a code block places exactly its content on the clipboard — no language line, no
   surrounding whitespace.
4. **AC4** — Copy success and failure use the existing copy feedback (§4).
5. **AC5** — A table offers a copy control producing **tab-separated** text whose rows and columns
   match the rendered table.
6. **AC6** — A cell containing a tab, a quote or a newline is quoted with inner quotes doubled, and
   round-trips (asserted with such a table).
11. **AC11** — No control offers the table as Markdown; the answer actions remain the one way to
    take the model's own text (§4).
7. **AC7** — A table wider than its column scrolls within its own container, and the conversation
   column does not scroll horizontally (existing layout test, extended).
8. **AC8** — A block or table inside a turn still streaming renders no copy control; it appears when
   the turn settles.
9. **AC9** — Rendering and copying issue no request (asserted).
10. **AC10** — Every new string ships `en` + `pt`.
12. **AC12** — A settled turn's blocks carry controls; a streaming turn's do not, whether or not
    the fence itself has closed.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **Copy behaviour** | `useCopy` stays the single source of truth for clipboard interaction and its feedback; these controls use it rather than re-implementing it (§4). |
| **Markdown rendering** | `Markdown.tsx`'s block memoisation must survive: controls are added without making each token re-render the settled blocks (spec 004 AC8). |
| **Deferred, and recorded** | `LogViewer` — the trace panel's payload reader — has no copy control at all. That is a real gap and it is not this spec's surface. |
| **Docs** | None expected. |

## Out of scope / deferred

- Sorting, filtering or reformatting a table.
- Running or editing code.
- Line numbers, wrapping toggles, or diff rendering.
- Downloading a code block as a file. Copy answers the need; a download needs a filename and a
  language-to-extension table, which is a surface of its own.
- A copy control in the trace panel's payload reader — a real gap, deliberately not widened into
  here.
