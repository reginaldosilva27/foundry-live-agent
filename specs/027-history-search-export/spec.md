# Spec: History you can search, and take with you

| | |
|---|---|
| **ID** | 027-history-search-export |
| **Status** | draft |
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
- No raising the twenty-five limit as part of this spec.
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Search** is a field at the top of the rail's history list. Typing filters the list by title and by
message text, across both roles. A match shows the conversation's title and a short fragment of the
matching text, so the reader can tell which of three similar conversations this is. Clearing the
field restores the full list. The search is over what is stored; it never asks the BFF anything.

**Export one** is offered on a conversation in the list: Markdown for reading, using the same
renderer the single-turn download already uses, so one document describes a conversation the way one
document already describes a turn.

**Export everything** is offered once, near the list: a single JSON file containing the whole record
— every conversation, its messages, its Foundry `conversation_id` and the agent that held it. JSON
rather than Markdown because this one is meant to be read back.

**Import** takes that JSON file and merges it into the record. A conversation already present is not
duplicated. If the import would exceed the record's limit, the oldest are dropped, and the screen
says how many were kept and how many were not — silently discarding someone's transcripts is exactly
the kind of thing §5 is about.

**Clear** removes the whole record, and asks first, naming what will be lost: the conversations this
browser drew. It states plainly that the conversations themselves live in Foundry and are not
deleted by this — because they are not, and a reader who believed otherwise would be wrong in a way
that matters.

## Acceptance criteria

1. **AC1** — The history list has a search field; typing filters to conversations whose title or
   message text matches, case-insensitively.
2. **AC2** — A filtered result renders a fragment of the matched text, not only the title.
3. **AC3** — Clearing the field restores the unfiltered list.
4. **AC4** — Search issues no network request.
5. **AC5** — Exporting one conversation produces a Markdown document containing every message in
   order, the agent and the conversation's identifiers.
6. **AC6** — Exporting everything produces one JSON file containing every stored conversation with
   its messages, `conversation_id` and agent.
7. **AC7** — Importing a previously exported file restores its conversations, and reopening one
   resumes the Foundry conversation exactly as the original record did (021).
8. **AC8** — Importing a file containing a conversation already stored does not duplicate it.
9. **AC9** — An import that exceeds the record's limit keeps the newest, and the screen reports how
   many were kept and how many were dropped.
10. **AC10** — Importing a file that is not a valid record leaves the record untouched and says so.
11. **AC11** — Clear asks for confirmation naming what is lost and stating that Foundry's
    conversations are not deleted; cancelling changes nothing.
12. **AC12** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged. No endpoint, no request field. |
| **Export format** | New public surface — a file people will keep. It must carry a version field so a later record shape can read an older file. Its single source of truth is the history module named in the plan, which owns both the stored shape and the exported one (§4). |
| **Stored data** | `fla.history.v1` (021) is read and written; the key and its shape do not change. |
| **Constitution §8** | Import writes only the drawing and the pointer. Nothing imported is treated as truth about Foundry, and nothing derives a decision from it (021's three rules, unchanged). |
| **Docs** | `docs/architecture.md` — what the browser keeps, and now what leaves it. |

## Open questions (clarify before planning)

- [ ] Does the exported JSON include the **trace identifiers** per turn, so a transcript can be tied
      back to spans in the workspace?
- [ ] Does import trust the `conversation_id` in the file? Resuming a Foundry conversation from an
      imported pointer is the point — but on a different tenant it will simply fail. What does the
      failure look like?
- [ ] Should search also match tool names and MCP server labels, which is often what a reader is
      actually looking for?
- [ ] Is there a per-conversation delete today, or does this spec add it alongside clear-all?

## Out of scope / deferred

- Raising or removing the twenty-five limit.
- Syncing history across devices or to an account.
- Searching or listing the conversations that exist in Foundry but not in this browser.
