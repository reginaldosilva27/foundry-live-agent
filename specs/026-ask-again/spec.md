# Spec: Asking again — repeat and edit a question

| | |
|---|---|
| **ID** | 026-ask-again |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

A question that came out wrong can only be fixed by typing it again. There is no repeat, no edit,
and no way to take back a turn that went somewhere useless — which is most of what anyone does while
learning what an agent is good at.

It is worth being exact about why this is allowed, because the shape of it looks like the thing
constitution §8 forbids. §8 is about the *app* deciding: re-prompting the model, looping on its
output, choosing what to send next. Nothing here does that. A person pressing **repeat** is a person
asking again, and the app carries the message it is given, exactly as it carries a message typed
into the composer. The line this spec must not cross is automatic retry — the app deciding, on its
own, that an answer was bad enough to ask again — and that is a non-goal below, permanently.

## Goals

- **Ask the same question again** with one action.
- **Edit a question and send the edited version**, without retyping it.
- Be clear about what happens to the conversation Foundry holds, since the app does not own it.

## Non-goals

- **No automatic retry, ever** — not on an error, not on an empty answer, not on a tool failure.
  The app never decides to ask again (§8). This is the load-bearing non-goal of this spec.
- **No branching tree of alternatives**, no "regenerate with a different model", no A/B of two
  answers on one question — spec 020 owns comparison, and it compares *agents*, deliberately chosen.
- **No deletion of a turn from Foundry's conversation.** We do not own it and will not pretend to.
- No change to the `AgentEvent` set (§9) or to the `POST /chat` request body.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Repeat** sits with the answer actions of a finished turn (copy, download, trace). It sends the same
question again, on the same conversation, and the new turn is appended below — it does not replace
the old one. Both stay on screen, which is the honest rendering: the conversation Foundry holds now
contains both, and hiding one would make the screen disagree with the service.

**Edit** sits on the question, not on the answer. It puts the question's text back into the composer
with the cursor in it, ready to be changed and sent. The original question and its answer stay where
they are, for the same reason.

**What the screen says about it.** Because both turns remain, a reader needs to know the second was
a repeat rather than a second question. A repeated turn carries a short mark saying so.

**The agent that answers** is the one answering now, which may not be the one that answered the
first time — a reader who switched agents and then repeated is asking a different agent the same
question, and that is a reasonable thing to want. The mark says which one, so nothing is implied
that is not true.

**A stopped turn** (spec 023) offers repeat like any other, because asking again is exactly what a
reader who stopped a turn is likely to want next.

## Acceptance criteria

1. **AC1** — A finished turn's actions include **repeat**, with an accessible name.
2. **AC2** — Activating repeat sends the same question text again, on the same `conversation_id`.
3. **AC3** — The repeated turn is appended; the original question and answer remain rendered.
4. **AC4** — A repeated turn renders a mark identifying it as a repeat and naming the agent that
   answered it.
5. **AC5** — A question renders an **edit** control that places its text in the composer, focused,
   without sending anything.
6. **AC6** — Sending from an edit is an ordinary send: same conversation, appended below, original
   untouched.
7. **AC7** — Repeat is offered on a stopped turn and on an errored turn; on an errored turn it is
   offered even though there is no text to copy.
8. **AC8** — When the conversation is blocked because its agent is not selectable (021 AC18), both
   controls render unavailable and carry that same reason; pressing them sends nothing.
9. **AC9** — Nothing repeats without a person acting: no code path calls send from a turn's
   completion, failure, or empty result (asserted as a test, not only reviewed).
10. **AC10** — Repeat and edit are unavailable while a turn is streaming.
11. **AC11** — Every new string ships `en` + `pt`, and both controls are SVG icons.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged. A repeat is an ordinary `POST /chat`. |
| **Turn state** | A turn gains a "repeat of" marker so the mark can render. Source of truth is the turn/message state named in the plan; the export (`exportTurn.ts`) and the stored conversation carry it with them (§4). |
| **Constitution §8** | AC8 is the guard. The plan must name where the "no automatic send" invariant is tested, so it cannot be lost to a later refactor. |
| **Docs** | `docs/how-it-works/` — the function-call round trip page already explains who decides what; a paragraph here says why a person repeating is not the app looping. |

## Clarified decisions (2026-09-17)

- **Neither control offers to stop a running turn.** AC9 already makes both unavailable while one is
  streaming, and since spec 023 the reader has a stop control of their own. Two ways to end a turn
  would be a second place deciding what "interrupt this" means; the composer's control is the one.
- **A blocked conversation blocks repeat too.** When the turn's agent is no longer selectable, 021
  AC18 already refuses the composer with a reason; repeat would fail in exactly the same way, so it
  renders unavailable carrying that same reason — the pattern the agents screen, the rail and the
  palette all use. Offering a control that fails on press is what §5 rules out.
- **The mark always names the agent**, not only when it differs. AC4 already requires it, and the
  alternative makes absence mean "the same agent", which is an inference the reader has to perform
  on a screen that could simply have said so.
- **A repeat always goes to the same conversation.** Repeating into a fresh one would be the app
  deciding to fork state Foundry owns — and a reader who wants that has **New conversation** next to
  them. The one thing repeat means is "ask that again, here".

## Open questions (clarify before planning)

*None — resolved above.*

## Out of scope / deferred

- Deleting or hiding a turn from the transcript.
- Editing a question in a *restored* conversation whose agent is gone.
- Comparing two answers to the same question side by side (spec 020).
