# Spec: The turn shows its steps when the model shows no reasoning

| | |
|---|---|
| **ID** | 015-steps-narration |
| **Status** | done |
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
- When no reasoning summary arrives, what stands in its place is true: a statement about this turn,
  not a claim about the deployment, and the numbered rows below it carry the account.
- The copy shown when reasoning is absent stops asserting things about the deployment that the
  deployment contradicts.
- Everything on screen is derived **only** from observed events (§5, §8) — nothing is inferred about
  the model's intent, and no prose is written on the model's behalf.

## Non-goals

- **No invented reasoning.** Text presented as the agent's thinking, composed by this app, is out —
  it is the exact dishonesty §5 forbids. The steps are labelled as *what happened*, never as
  *what the agent thought*.
- No new event type and no new field on an existing one — the contract does not change (§9).
- No change to the *payloads* the trace panel renders; a result stays a press away, in the reader
  (spec 009, spec 010 AC1). The rows in the panel do gain the ordinal and the subject, because the
  rows are the same component everywhere — which narrows those two specs and is recorded here
  rather than discovered later.
- No re-layout of the tool row's existing columns (spec 014 AC9 fixed them on purpose).
- No dependency on Application Insights or on any second data source.

## User-facing behavior

Within an agent turn's activity panel:

- **Each call row carries the argument that distinguishes it** — for `lookup_knowledge`, the query
  string; seven identical rows become seven readable searches. Truncated to one line.
- **Steps are numbered.** A turn with more than one call numbers them 1..N in event order, MCP calls
  included, so the seven calls read as a sequence and not as a repetition glitch.
- **When no reasoning summary arrived and the turn has settled**, the bordered card collapses into
  one quiet line saying the model emitted no summary *this turn*. It makes no claim about the model
  or the deployment, and the numbered rows beneath it are the account of what happened.
- **While the turn is streaming**, the live line (spec 011) names the running step and shows how long
  the current state has lasted, so a multi-leg turn is visibly progressing rather than frozen. This
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
5. **AC5** — Given a turn with more than one call, when it renders, then each row carries its
   ordinal, counting from 1 in event order.
6. **AC6** — Given a turn with exactly one call, when it renders, then no ordinal appears.
7. **AC7** — Given a turn mixing app-executed and Foundry-executed calls, when it renders, then the
   ordinals run unbroken across both kinds, in event order.
8. **AC8** — Given a settled turn with no `reasoning_summary` events, when it renders, then the line
   in the reasoning card's place states that no summary arrived **this turn**, asserts nothing about
   the model's capability or the deployment, and is not labelled as the agent's reasoning.
9. **AC9** — Given a turn that did emit reasoning summaries, when it renders, then the reasoning
   card renders exactly as it does today.
10. **AC10** — Given a streaming turn whose current state is a call in flight, when it renders, then
    the live line carries that call's ordinal, its name, and the time elapsed since the state began.
11. **AC11** — Given a streaming turn whose current state is thinking, when it renders, then the
    live line carries the time elapsed since that state began, and the elapsed time restarts when
    the state changes.
12. **AC12** — Given the same turn, when it is rendered by the chat, the trace panel and the voice
    overlay, then all three show the same ordinal for the same call — including the overlay, which
    lists newest-first.
13. **AC13** — Given any turn, when the event log is replayed through the turn state, then every
    ordinal and every argument drawn is a function of the events alone.

## Contract / data impact

**None.** `ai/harness/_shared/contract.py` (§9's source of truth) does not change. The ordinal is
the position a call already occupies in the arrival order, and the arguments already ride on
`tool_call` and `mcp_call`. A different harness emitting the same nine events gets the numbered rows
without being touched — which is the §9 test.

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

## Clarified decisions (2026-09-16)

- **One call is one step.** Numbered in event order, 1..N. The alternative — one step per response
  leg, the way the portal groups — is more faithful to what the model decided (leg 1's two calls
  were one decision, not two) but needs a grouping container the panel does not have, and the
  problem to solve is that the *rows* are indistinguishable. A leg that calls twice therefore reads
  as two sequential steps; that is a known, accepted inaccuracy about simultaneity.
- **The argument shown is the first string value of the call's JSON arguments.** A generic rule, not
  a per-tool table: it covers all four tools in the fixture (`timezone`, `query`, `query`, `url`),
  works for the fifth tool nobody has written, and avoids a second source of truth about tools
  beside `ai/harness/_shared/tools/` (§4). Absent, empty, or unparseable arguments show nothing.
- **There is no separate "what the agent did" block.** The numbered rows, each carrying its real
  argument, *are* the account. A block above them would repeat, word for word, the lines directly
  beneath it. What replaces the empty reasoning card is one quiet line stating the fact.
- **The live line's clock times the current state**, restarting when the state changes: *Thinking ·
  12s*, then *Step 3 · calling `lookup_knowledge` · 0s*. This **deliberately reverses spec 011's
  non-goal** ("no elapsed-time counter"). 011 assumed one short wait; the observed turn ran seven
  legs where every call returned in 0–1 ms and all the waiting was the model between them — a clock
  that runs only during calls would sit at 0 s for precisely the seconds that look frozen.
- **MCP calls take step numbers too**, in the same sequence. The number counts what the agent did;
  who executed it is the executor column's job (§8), and numbering half the list would leave
  unexplained gaps.
- **All three surfaces show both.** The ordinal is derived once, in the turn state, alongside the
  other pure derivations of the event log (§4) — so it is a property of the activity and not of the
  render order. The voice overlay, which lists newest-first, shows 3, 2, 1 and stays correct. The
  overlay gains the most from the argument: a voice session has no trace panel, so today there is
  no way at all to see what a tool was asked.

## Related: spec 016, the model's own preamble

Spec 016 instructs the agent, in `agent.yaml`, to say one short sentence before a slow tool call
("let me check that on the web"). It attacks the same silence from the other end and is honest by
construction — the model says it, we only render it. It does not replace this spec: it is one
sentence per turn, not per step; it says what the agent is *about to* do, not what it did; and it
is advice a model may ignore. One interaction to watch in the plan: that sentence arrives as
`text_delta`, and `turnStatus` treats any text as `answering`, which retires the live line — so the
preamble may dismiss the very line this spec is improving.

## Open questions (clarify before planning)

_None. Resolved 2026-09-16 — see "Clarified decisions" above._

## Out of scope / deferred

- Showing a tool call's *result* on the row. The trace panel owns payloads (spec 009).
- Collapsing repeated identical calls into one row with a count — a different feature, and it hides
  the loop this turn actually ran.
- Anything that would tell the user *why* the agent repeated a call. That is reasoning, and if the
  model did not say it, this app does not know it.
