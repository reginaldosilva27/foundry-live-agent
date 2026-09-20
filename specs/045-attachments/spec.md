# Spec: Attachments on a question

| | |
|---|---|
| **ID** | 045-attachments |
| **Status** | clarified — blocked |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |
| **Clarified** | 2026-09-19 |
| **Blocked on** | a Foundry doc nobody has read (see below) |

## Problem / motivation

Every question this app can ask is a string. A reader wanting the agent to look at a Bicep file, an
error log, a screenshot of a Foundry blade or a CSV has to paste it into a one-line composer — soon a
multi-line one (spec 023) — and hope it fits.

This is the most expensive item on the UI map and it is placed last deliberately. It is the only one
that changes the request body of `POST /chat`, and probably the contract: the app's public shape
today is `message · conversation_id · agent`, and spec 021 made "the request stays exactly those
three fields" a test, because that is how the browser's local record is kept from leaking into
Foundry's state.

It is also the one with a real infrastructure question underneath — where does an uploaded file live,
who can read it, and how long does it stay — which is not a frontend question at all.

The spec exists so that when it is wanted, the work starts from the right question rather than from a
file input.

## Goals

- **A question can carry a file**, and the agent can use it.
- The file's **path through the system is deliberate and stated**: what is stored, where, for how
  long, and who can read it.
- **The contract change, if any, is made on purpose** — specified, tested, and moved through every
  consumer (§9).

## Non-goals

- **No silent contract drift.** If this needs a new `AgentEvent` or a new request field, that is
  §9/§4 work with a spec and fixtures, not an addition made during implementation.
- **No file storage in the browser's history.** Spec 021's record is a drawing of a conversation; it
  is not a file store, and a base64 image in `localStorage` would exhaust it within a few turns.
- **No client-side parsing.** The app does not read a PDF, extract text from an image, or summarise a
  CSV before sending — that is the app deciding what the model gets to see.
- **No multi-file, no folders, no drag-and-drop of a directory** in the first pass.
- **No attachment during a voice session.**

## Clarify outcome: this one does not ship, and the reason is the spec's own

The draft's first open question says it plainly: *does the Responses API accept file input
alongside a message, and how — until this is answered from a doc, nothing else in this spec can be
planned.* It had not been answered: no doc had been read for file input, and **§10 forbids writing
the rest from memory.**

**Amended 2026-09-20 — the doc question is answered, and the spec stays blocked.** The Responses
API does take file input beside a message, as `input_image` / `input_file` content parts carrying
either a URL, a `data:` base64 URI, or a `file_id` from `POST /openai/v1/files`. All three designs
this spec could not choose between are real, which is why it could not choose. Shapes, limits and
the one caveat (a Q&A report of the *agent* path rejecting base64) are in `docs/REFERENCES.md`.
What still blocks this spec is below, and neither item is a documentation question.

That is not the only blocker, and the others are not the kind a developer should resolve alone:

- **It changes the app's public request shape.** `POST /chat` is `message · conversation_id ·
  agent`, and `App.routing.test.tsx` asserts exactly those three keys — deliberately, because that
  test is how spec 021 keeps this browser's local record from leaking into Foundry's state. Adding
  a fourth field is a §9/§4 change with a spec, fixtures and every consumer moved, not an addition
  made while implementing something else.
- **"Where does the file live" is an infrastructure and retention decision**, not a frontend one.
  What is stored, for how long, and who can read it has to be answered **before** an upload
  endpoint exists, not after. That is the operator's call.
- **The two harnesses may not behave the same.** If the hosted agent handles file input differently
  from the prompt agent, the contract has to express the difference, and §9's adapter-parameterised
  suite is where that would surface. Unknown, for the same reason as the first blocker.

### What the last open question turned out to be worth

*"Is a file worth it at all, or is the real want pasting a long snippet?"*

Checked rather than guessed: **the composer is already a `textarea` with `Shift+Enter` for a line
break** (spec 023). A Bicep file, an error log or a CSV can be pasted today and travels as the
`message` it is — no contract change, no upload endpoint, no retention question. That covers a
large share of the motivating cases at zero architectural cost.

A **screenshot of a Foundry blade** is the case it does not cover, and it is a real one. It is also
precisely the case that needs the unanswered question answered first.

### What would unblock this

Recorded in [`docs/REFERENCES.md`](../../docs/REFERENCES.md) rather than left in a spec nobody
opens. In short: read the Responses API's file-input documentation, establish whether content is
inlined, uploaded to Foundry, or read from storage the agent has access to, and decide retention
before writing an endpoint.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Attaching** is offered in the composer: one file, chosen or dropped, shown as a named chip above
the input with its size and a way to remove it before sending.

**Limits are stated before the attempt**, not after: which types and what maximum size. A file
outside them is refused with the reason, and the composer keeps the typed question.

**While it uploads**, the send is in progress and visibly so; a failure says what failed and keeps
both the question and the file.

**In the transcript**, the question renders with its attachment named — the transcript must show what
was asked, and the file was part of what was asked.

**In the stored conversation**, the attachment is a reference, never the bytes. Reopening shows the
question with the file named; whether the file is still retrievable is a separate fact and the screen
does not claim it is.

**What the agent can do with it** depends on the agent and on the tools it has. The screen does not
imply a capability the agent lacks: attaching a file to an agent that cannot read files should say
so, or the feature teaches the wrong thing.

## Acceptance criteria

1. **AC1** — The composer accepts one file by choosing and by drop, and renders it as a named chip
   with its size and a remove control.
2. **AC2** — The accepted types and maximum size are stated in the UI before an attempt.
3. **AC3** — A file outside the limits is refused with the reason, and the typed question is kept.
4. **AC4** — A failed upload states what failed and keeps both the question and the file.
5. **AC5** — A sent question renders in the transcript with its attachment named.
6. **AC6** — The stored conversation record holds a reference, never file bytes (asserted).
7. **AC7** — Reopening a stored conversation renders the attachment's name and does not claim the
   file is retrievable unless it is.
8. **AC8** — With the answering agent unable to accept files, attaching is unavailable and the
   reason is stated — as a code from the BFF, translated in the frontend (§7, the 019 pattern).
9. **AC9** — No attachment control is offered during a voice session.
10. **AC10** — The change to `POST /chat`'s request shape is exactly what this spec declares, and the
    existing test asserting the request's fields is updated in the same change, never loosened
    (§4, §9).
11. **AC11** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **`POST /chat`** | Changes shape. Spec 021's test — the request carries `message · conversation_id · agent` — exists to keep local state from leaking, and this spec must show that its reasoning still holds with a fourth field, or find another route for the upload. |
| **`AgentEvent`** | Possibly unchanged; possibly not. Whether the agent's *use* of a file produces anything the stream must carry is the first open question, and a new event type means §9 work — a spec, fixtures, and every consumer moved. |
| **Storage** | Where an uploaded file lives is infrastructure: a storage account, its lifetime, its access model, and Entra ID rather than a key (zero secrets). It is Bicep, and under §5 unverifiable infrastructure is documented as a manual step rather than shipped as unverified IaC. |
| **§10** | How Foundry's Responses API accepts a file alongside a message — if it does — comes from a doc read at the time of writing, recorded in `docs/REFERENCES.md`. This is the question the whole spec waits on. |
| **Docs** | `docs/architecture.md`, `docs/how-it-works/`, `SECURITY.md` — an upload endpoint is a new attack surface. |

## Open questions — resolved, or blocking

| Question | Outcome |
|---|---|
| Does the Responses API accept file input, and how? | **Blocking.** Unanswered; no doc read, no credential to probe with (§10). |
| Does the file go to Foundry, to storage, or into the message? | Blocked by the above — "three different specs wear the same name" is exactly right. |
| Do both harnesses handle it identically? | Blocked by the above. |
| What is retained, and who can read it? | **The operator's decision**, and it must precede an upload endpoint. |
| Is a file worth it, or is the want pasting a snippet? | **Largely the latter**, measured: the composer is already a multi-line `textarea` (spec 023), so logs, Bicep and CSV paste today. A screenshot is the remaining case. |

## Out of scope / deferred

- Multiple files, folders, archives.
- Any client-side extraction or preprocessing.
- Attachments during voice.
- Images as output (spec 044).
