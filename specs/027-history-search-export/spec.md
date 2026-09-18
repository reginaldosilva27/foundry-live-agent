# Spec: History you can search, and take with you

| | |
|---|---|
| **ID** | 027-history-search-export |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

Spec 021 gave the browser a record of up to twenty-five conversations, titled by the first thing the
person typed. Twenty-five is enough to be worth searching and too many to scan — and a title taken
from an opening sentence is a poor index of what a conversation turned out to be about.

The record is also a one-way door. A reader can download a single turn as Markdown from the answer
actions, and that is the whole of it: no way to take a conversation, no way to take the lot, no way
to move the record to another browser, and no way to clear it deliberately rather than by wiping
site data. For a repository whose readers are meant to study what the agent did, the transcripts
being trapped in one browser profile is the wrong default.

Everything needed is already local. The stored record holds the full message list, so search and
export are reads of something this browser already has.

## Goals

- **Find a conversation by what is in it**, not only by its title.
- **Take a conversation out** — one, or all of them — in a form that is readable and re-importable.
- **Put one back**, so the record can move between browsers.
- **Clear the record on purpose**, with the consequence stated before it happens.

## Non-goals

- **No server-side history.** The record stays in this browser. Nothing is uploaded, and no BFF
  endpoint stores a transcript. Spec 021's rule stands: it never travels.
- **No search of Foundry's conversations.** We search what this browser drew. What Foundry holds is
  Foundry's, and reading it back would be duplicating state the service owns (§8).
- **No semantic search, no embedding, no asking a model to summarise or title a conversation** —
  spec 021 ruled that out by name and the reason has not changed: it would be the app running
  inference of its own.
- **No validating an imported pointer against Foundry.** Asking the service whether a
  `conversation_id` exists would be the app deriving a decision from the stored record — 021's
  second rule, and the reason import trusts the file (see below).
- No per-conversation delete: `useHistory.remove` and the rail's trash control already exist (021).
  This spec adds only clearing the *whole* record.
- No raising the twenty-five limit as part of this spec.
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Search** is a field at the top of the rail's history list, and the same field opens the history
screen. Typing filters the list, case-insensitively, across four things the record already holds:
the title, the text of both roles' messages, the **name of a tool** that ran in the conversation,
and the **label or name of an MCP server** Foundry called. Arguments and outputs are deliberately
not searched: a match inside a JSON blob renders as an unreadable fragment, and in a 248px rail that
is noise rather than an index. A match shows the conversation's title and a short fragment of the
matching text, so the reader can tell which of three similar conversations this is. Clearing the
field restores the full list. The search is over what is stored; it never asks the BFF anything.

**The history screen** is a new address, `/history`, reached from the rail and from the command
palette (025). It is the place the record is managed, for the same reason spec 021 moved the agents
listing off the rail: the rail is 248px, and a sentence about what clearing destroys does not fit in
it. The screen carries the same search field, the full list — title, agent, date, number of turns —
and the three actions that act on the record as a whole.

**Export one** is a control on each row of the history screen: a Markdown document, rendered through
the same module the single-turn download already uses (§4), so one document describes a conversation
the way one document already describes a turn.

**Export everything** is one control on the screen: a single JSON file containing the whole record —
every conversation, its messages, its Foundry `conversation_id` and the agent that held it, **as
stored**, including the trace identifiers each turn already carries. Nothing is stripped on the way
out: the identifiers are what tie a transcript back to spans in the workspace, which is the point of
a teaching repository, and a `response_id` or an OTel trace id is inert without access to that
workspace. JSON rather than Markdown because this one is meant to be read back.

**Import** takes that JSON file and merges it into the record. A conversation already present is not
duplicated. If the import would exceed the record's limit, the newest are kept, and the screen says
how many were kept and how many were not — silently discarding someone's transcripts is exactly the
kind of thing §5 is about. A file that is not a record leaves the record untouched and says so.

**Import trusts the file's `conversation_id`.** It writes the pointer verbatim and asks Foundry
nothing, because checking would be this app deriving a decision from its own storage. A pointer from
another project or tenant therefore fails the way any unusable pointer already fails: the next turn
sent into that conversation errors, and the existing turn-error card says so. No new failure mode,
no "imported" flag on the record, no second error branch to keep.

**Clear** removes the whole record, and asks first on the screen, naming what will be lost: the
conversations this browser drew. It states plainly that the conversations themselves live in Foundry
and are not deleted by this — because they are not, and a reader who believed otherwise would be
wrong in a way that matters. Cancelling changes nothing.

## Acceptance criteria

1. **AC1** — The history list has a search field; typing filters to conversations whose title or
   message text matches, case-insensitively.
2. **AC2** — A filtered result renders a fragment of the matched text, not only the title.
3. **AC3** — Clearing the field restores the unfiltered list.
4. **AC4** — Search issues no network request.
5. **AC5** — Search also matches a tool name and an MCP server label stored in a conversation's
   turns, and does **not** match text that appears only in a tool's arguments or output.
6. **AC6** — `/history` parses and builds through `route.ts`, renders the history screen, and is
   reachable from the rail and from the command palette.
7. **AC7** — Exporting one conversation produces a Markdown document containing every message in
   order, the agent and the conversation's identifiers.
8. **AC8** — Exporting everything produces one JSON file carrying a format version and every stored
   conversation with its messages, `conversation_id`, agent and stored trace identifiers.
9. **AC9** — Importing a previously exported file restores its conversations, and reopening one
   resumes the Foundry conversation exactly as the original record did (021) — the stored
   `conversation_id` is written verbatim and no request is made to validate it.
10. **AC10** — Importing a file containing a conversation already stored does not duplicate it.
11. **AC11** — An import that exceeds the record's limit keeps the newest, and the screen reports how
    many were kept and how many were dropped.
12. **AC12** — Importing a file that is not a valid record, or one carrying an unknown format
    version, leaves the record untouched and says so.
13. **AC13** — Clear asks for confirmation naming what is lost and stating that Foundry's
    conversations are not deleted; cancelling changes nothing, confirming empties the record and the
    stored key.
14. **AC14** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged. No endpoint, no request field. |
| **Export format** | New public surface — a file people will keep. It carries a `version` field so a later record shape can read an older file, and its payload is the stored shape verbatim. Its single source of truth is `frontend/src/state/history.ts`, which owns both the stored shape and the exported one (§4). |
| **Stored data** | `fla.history.v1` (021) is read and written; the key and its shape do not change. |
| **Routes** | `/history` is added to `route.ts`, the single source of truth for the address scheme (024 §4). |
| **Constitution §8** | Import writes only the drawing and the pointer. Nothing imported is treated as truth about Foundry, nothing derives a decision from it, and no request validates it (021's three rules, unchanged). |
| **Docs** | `docs/architecture.md` — what the browser keeps, and now what leaves it and comes back. |

## Out of scope / deferred

- Raising or removing the twenty-five limit.
- Syncing history across devices or to an account.
- Searching or listing the conversations that exist in Foundry but not in this browser.
