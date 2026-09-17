# Spec: The composer, and stopping a turn

| | |
|---|---|
| **ID** | 023-composer-and-stop |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

The composer is a single-line text field, and a turn that has started cannot be stopped.

Both are the most-used interaction in the product, and both fail in the same demo. A question worth
asking an agent about Foundry is often three lines with a snippet in it; typed into a one-line field
it becomes a smear the author cannot re-read before sending. And once it is sent, the field is
disabled until the model is finished — so a question sent by mistake, or an answer that has plainly
gone the wrong way, costs the reader every second the model wants to spend. During a live demo that
is the longest silence in the session and there is nothing to do but watch it.

Neither is a missing capability. The stream is a `fetch` whose body is read to completion, and the
field is an `<input>` because the shell was built before anyone typed a real question into it.

## Goals

- **Write a real question**: multiple lines, a pasted snippet, and a field that grows with it.
- **Stop a turn that is running**, and keep whatever it had already produced.
- Be honest about what stopping means: the browser stops listening; the run in Foundry does not
  necessarily stop (§5).

## Non-goals

- **No cancellation of the Foundry run.** Whether a run can be cancelled through the Responses API,
  and at what cost, is a §10 question nobody has answered from a doc. This spec stops the *client*.
- **No retry, no edit, no branch** — spec 026 owns asking again.
- **No rich composer**: no slash commands, no mention picker, no attachments (spec 045), no
  formatting toolbar. Markdown typed by hand is already what the field carries.
- No change to the `AgentEvent` set (§9) or to the `POST /chat` request body.
- No auto-send, no "send on paste", nothing the app decides.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**The field.** A multi-line field that starts one line tall and grows with the text up to a ceiling,
after which it scrolls inside itself. `Enter` sends; `Shift+Enter` breaks a line. A field that has
grown returns to one line after sending.

**The button.** While a turn is streaming, the send control becomes a **stop** control, with its own
accessible name and its own icon — the same button position, so the hand that just pressed send is
already on it. Pressing it ends the stream.

**What a stopped turn looks like.** It keeps the text, the tool rows and the reasoning it had
already received, and it is marked as **stopped** — not as finished, and not as an error. Nothing
more is appended to it. The trace panel still opens on it, because the identifiers it carries are
real and the spans it produced may still arrive.

**What the app says about the run.** A stopped turn carries one short line saying the answer was
interrupted here and the run may still be finishing in Foundry. We say it because it is true and
because a reader watching a trace appear afterwards deserves to have been told.

**The conversation continues.** A stopped turn does not end the conversation: the next message goes
to the same `conversation_id`, because that is Foundry's state and this app does not own it.

## Acceptance criteria

1. **AC1** — The composer accepts a multi-line value: `Shift+Enter` inserts a newline and does not
   send; `Enter` sends and does not insert a newline.
2. **AC2** — The field's rendered height grows with added lines up to a ceiling, then stops growing.
3. **AC3** — After a successful send the field is empty and back to its one-line height.
4. **AC4** — While a turn is streaming the primary control is a stop control with an accessible name
   distinct from send; when nothing is streaming it is the send control.
5. **AC5** — Activating stop ends the stream: no further events are applied to the turn, even if the
   transport delivers more.
6. **AC6** — A stopped turn retains every event it had already received (text, tool rows, reasoning)
   and renders them.
7. **AC7** — A stopped turn renders as **stopped** — distinct from a finished turn and from an
   errored one — and carries the line about the run possibly continuing.
8. **AC8** — After a stop, the composer is enabled again and the next message is sent on the same
   `conversation_id`.
9. **AC9** — `Escape` in the composer does not stop a running turn, and does not clear the field.
10. **AC10** — A stopped turn's answer actions still offer the trace; copy and download are offered
    when there is text to copy.
11. **AC11** — Every new string ships `en` + `pt`, and the stop control is an SVG icon (existing
    i18n and brand tests, extended).

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged. Stopping is a client abort of an HTTP response; no event, no endpoint, no request field. |
| **Turn state** | A turn gains a **stopped** status alongside `streaming` and its settled states. The source of truth is the turn reducer named in the plan; the activity panel, the answer actions, the meta line and the export all read it from there (§4). |
| **Stored conversations** | A stopped turn is stored like any other — spec 021's record is a drawing of what was rendered, and this was rendered. |
| **Docs** | `docs/how-it-works/` — the streaming-events page gains a paragraph on what an abort does and does not do. |

## Clarified decisions (2026-09-17)

- **A stopped turn is terminal.** There is no resume, and the app holds no state about a run it has
  stopped listening to. Two reasons, and the second is the binding one: we have no cancellation, so
  the run continues regardless and "resume" would mean reopening a stream that no longer exists; and
  any notion of resumption would make the app keep state about a run **Foundry owns**, which is what
  §8 forbids. Continuing means asking again (spec 026) or simply sending the next message, which
  goes to the same conversation.
- **The line says two things, both verifiable**: the answer was interrupted here, and the run may
  still be finishing in Foundry. It says **nothing about tokens or cost** — we have not measured
  what a run does after the browser stops listening, and an implication of spend would be exactly
  the claim §5 rules out. Spec 028 touches usage; if someone measures it there, this line can earn
  the cost sentence with evidence.
- **`Esc` does not stop a turn.** `Escape` already has four owners — the payload reader, the modal
  focus hook, the agent chip's menu and the history rename — and a document-level handler would
  collide with all of them. The stop control is the only way. Keyboard semantics belong to spec 025.
- **The field's height ceiling is an implementation detail** and is decided in `plan.md`, not here:
  the spec's requirement is that it grows and then stops growing (AC2), which is testable either way.

## Open questions (clarify before planning)

*None — resolved above.*

## Out of scope / deferred

- Cancelling the Foundry run itself — a separate spec, and a §10 question first.
- Stopping a **voice** session mid-answer; the overlay's end control already exists and barge-in is
  the voice equivalent (spec 012).
- A draft that survives a reload.
