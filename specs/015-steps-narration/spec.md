# Spec: The turn shows its steps when the model shows no reasoning

| | |
|---|---|
| **ID** | 015-steps-narration |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

A turn that calls one tool seven times renders as seven identical lines. Observed 2026-09-16, asking
*"How does this project talk to Microsoft Foundry?"*: the activity panel showed `lookup_knowledge`
seven times, each with the same name, the same `bff` tag and a duration of 0–1 ms, above a card
reading **NO REASONING SUMMARY**. The same turn in the Foundry portal is legible — seven responses,
each with its own reasoning item and its own call — because the portal shows the *structure*: this
call, then that one, then the next.

Nothing was hidden by Foundry. The distinguishing fact — the `query` each call carried — arrived in
the `tool_call` event, went into the frontend's state, and is never drawn. What the user sees is a
stalled screen, and the only card that speaks blames the deployment:

> This model emits none. Point the deployment at a reasoning model to see this card fill in.

That sentence is false here. Verified against the live service the same day, the agent runs `gpt-5.5`
with `reasoning: {summary: auto}` — a reasoning model, correctly configured. It spent reasoning
tokens and emitted `reasoning` output items on that turn; `auto` simply let the model decide not to
summarise. (The definition has since moved to `summary: detailed`, which asks for one every time.
A model that still summarises nothing, and a harness whose model has no reasoning at all, both stay
possible — this spec is about that case.)

So there are two failures, and only one of them is about reasoning:

1. When no summary arrives, the turn says nothing true about what the agent is doing.
2. Repeated calls to one tool are indistinguishable, **whether or not** reasoning arrives.

## Goals

- A repeated tool call is distinguishable from the one before it, by what the agent actually asked
  for, at a glance and without opening the trace panel.
- A turn with several tool round trips reads as several **steps**, in order, the way the portal's
  response list does.
- When no reasoning summary arrives, the space it occupied carries something **true and useful**
  instead of an apology — a factual account of what the agent did, derived from the event stream.
- The copy shown when reasoning is absent stops asserting things about the deployment that the
  deployment contradicts.
- Everything on screen is derived **only** from observed events (§5, §8) — nothing is inferred about
  the model's intent, and no prose is written on the model's behalf.

## Non-goals

- **No invented reasoning.** Text presented as the agent's thinking, composed by this app, is out —
  it is the exact dishonesty §5 forbids. The steps are labelled as *what happened*, never as
  *what the agent thought*.
- No new event type and no new field on an existing one — the contract does not change (§9).
- No change to what the trace panel renders; the payloads stay a press away (spec 009).
- No re-layout of the tool row's existing columns (spec 014 AC9 fixed them on purpose).
- No dependency on Application Insights or on any second data source.

## User-facing behavior

Within an agent turn's activity panel:

- **Each call row carries the argument that distinguishes it** — for `lookup_knowledge`, the query
  string; seven identical rows become seven readable searches. Truncated to one line.
- **Steps are numbered.** A turn with more than one round trip numbers them, so the seven calls read
  as a sequence and not as a repetition glitch.
- **When no reasoning summary arrived and the turn has settled**, the card in that position states
  the fact plainly — the model emitted no summary this turn — and, if the turn called tools, gives
  the step-by-step account of what it did instead of an empty box.
- **While the turn is streaming**, the live line (spec 011) says which step is running and how long
  it has been running, so a multi-round turn is visibly progressing rather than frozen. This
  deliberately revisits 011's "no elapsed-time counter" non-goal; the reason it was a non-goal there
  — a single short wait — does not hold for a seven-leg turn.

All new prose ships `en` + `pt` (§7).

## Acceptance criteria

1. **AC1** — Given a `tool_call` whose arguments are `{"query": "..."}`, when its row renders, then
   the query text is on the row.
2. **AC2** — Given two calls to the same tool with different arguments, when they render, then the
   two rows differ in what they display.
3. **AC3** — Given a call whose arguments are absent, empty, or not valid JSON, when its row
   renders, then the row still renders, with no argument text and no error.
4. **AC4** — Given argument text longer than the row, when it renders, then it is truncated to one
   line and the row's existing columns keep their positions.
5. **AC5** — Given a turn with more than one tool round trip, when it renders, then each step
   carries its ordinal, in event order.
6. **AC6** — Given a turn with exactly one call, when it renders, then no step numbering appears.
7. **AC7** — Given a settled turn with no `reasoning_summary` events and at least one tool call,
   when it renders, then the account of what the agent did is shown, listing each step's tool and
   argument, and it is not labelled as the model's reasoning.
8. **AC8** — Given a settled turn with no `reasoning_summary` events and no tool calls, when it
   renders, then a message states that no summary arrived, without asserting that the model is
   incapable of emitting one.
9. **AC9** — Given a turn that did emit reasoning summaries, when it renders, then the reasoning
   card is unchanged and no steps account replaces it.
10. **AC10** — Given a streaming turn with a call in flight in step N, when it renders, then the
    live line names the step and the elapsed time of that call.
11. **AC11** — Given the whole feature, when the event log is replayed, then every value drawn comes
    from an event — no component fabricates text attributed to the agent.

## Contract / data impact

**None.** `ai/harness/_shared/contract.py` (§9's source of truth) does not change: step boundaries
are derivable from the order the existing events already arrive in, because the BFF answers one
function call at a time, and the arguments are already on `tool_call`. If clarification concludes
that step boundaries *cannot* be derived reliably, that finding turns this into a contract change
and the spec stops here for a contract-change review.

i18n: new keys in `frontend/src/i18n/strings.ts`, `en` + `pt` (§7). The false `reasoning.absentBody`
copy is corrected in the same change.

## What the recorded fixtures already settle

Read from `ai/tests/fixtures/recorded/prompt-agent-turn-20260915.jsonl` (310 events, a real turn),
so these are observations and not assumptions (§5):

- **A single response leg can carry two function calls.** Leg 1 emitted `get_current_datetime`
  *and* `lookup_knowledge` before completing. So "one step per round trip" and "one step per call"
  are genuinely different numbering schemes, and the choice has to be made rather than assumed.
- **A leg can carry several MCP calls and several reasoning items, interleaved.** Leg 2:
  reasoning → `microsoft_docs_search` → reasoning → `microsoft_docs_fetch` → reasoning → message.
- **Every observed call's arguments are a flat JSON object whose first value is the meaningful
  string**: `{"timezone": "America/Sao_Paulo"}`, `{"query": "..."}` (function and MCP alike),
  `{"url": "https://..."}`. A generic "first string value" rule covers all four tools in the
  fixture without a per-tool table.

## Open questions (clarify before planning)

- [ ] **What counts as one step** — the round trip, which groups leg 1's two calls into one step, or
      the call, which numbers them 1 and 2? The portal groups by response; the rows are per call.
- [ ] **Which argument to show** — the generic "first string value" rule the fixture supports, or a
      per-tool rule that reads better for the four tools we have and needs editing for the fifth?
- [ ] **Where the steps account lives** — does it replace the reasoning card in that slot, or sit
      below the call rows as its own block? Replacing it risks reading as reasoning; sitting apart
      risks repeating what the rows already say.
- [ ] **Is the steps account needed at all**, if the rows themselves become readable (AC1–AC6)?
      The rows may already be the account, in which case AC7 collapses into a heading.
- [ ] **Elapsed time granularity** — the running call's own elapsed time, or the turn's? Does it
      keep ticking (a timer, which is not event-derived) or update only on events?
- [ ] **MCP calls in the numbering** — they arrive already settled and carry `arguments` too. Do
      they take a step number, or only the app-executed calls?
- [ ] **Does the voice overlay change?** It renders `ToolRow` without a trace panel behind it.

## Out of scope / deferred

- Showing a tool call's *result* on the row. The trace panel owns payloads (spec 009).
- Collapsing repeated identical calls into one row with a count — a different feature, and it hides
  the loop this turn actually ran.
- Anything that would tell the user *why* the agent repeated a call. That is reasoning, and if the
  model did not say it, this app does not know it.
