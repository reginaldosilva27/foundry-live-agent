# Spec: Side by side — one question, two agents, two streams

| | |
|---|---|
| **ID** | 020-side-by-side |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

`docs/harness-comparison.md` is a good table. It is also the only answer this project gives to the
question it exists to answer — *what changes when Foundry runs the loop versus when your container
does?* — and a table is an argument, not a demonstration.

With spec 018 there are two real harnesses and with spec 019 you can switch between them. Switching
is still a comparison you have to hold in your head: ask the prompt agent, read the answer, watch
the tool rows, note the numbers; switch; ask again; try to remember what the first one did. The
difference that matters — *this one answered in 1.2 s and that one took 2.8 s, this one called Learn
twice and that one called it once, this one cost less* — is exactly the part that memory is worst at.

For a repository whose job is teaching, the comparison should be something you can point at.

## Goals

- **One question, sent to two agents at once**, each streaming into its own column, live and
  simultaneously.
- Each column is the **same instrument** as the single-agent view: the same reasoning card, the same
  tool rows, the same error rendering — reused, not re-drawn (§4).
- Each column ends with **its own numbers**: time to first token, total duration, tokens, cost, and
  a link to its own trace.
- **Failure is independent.** One agent erroring leaves the other running and finishing.
- The comparison is honest: it measures two runs of the same prompt, and says nothing the events and
  spans did not say.

## Non-goals

- **No verdict.** The app does not score, rank, or declare a winner. Two agents, two sets of numbers,
  and a reader who can think. Anything else would be the app judging model output — which is a short
  walk from the agent loop §8 keeps out.
- **No shared state between the columns.** Two independent conversations; neither sees the other's
  messages or tool outputs.
- No change to the `AgentEvent` set (§9).
- No more than two columns. Three would be a grid, not a comparison, and would not fit the layout
  this app has.
- No voice in comparison mode — two simultaneous spoken answers are not a feature.
- No export, no saved comparisons, no history of past runs.
- No re-running one side against the other's answer. That is an evaluation harness and a different
  project.

## User-facing behavior

The user turns on comparison mode and picks the second agent from the same sidebar list spec 019
built. The conversation area **splits into two columns**, each headed by its agent's name and kind.
The activity panel steps aside: in comparison mode each column carries its own reasoning card, its
own tool rows and its own numbers, so the eye reads down a column instead of across the screen.
Those are the same components the single-agent view uses, parameterised — not a second rendering
of the same idea (§4).

They type one question, once. Both columns start at the same moment: two answers arriving at their
own pace, two sets of tool rows — and, when one agent is the hosted harness, an executor tag that
reads `foundry` next to a tag that reads `bff` for the identical tool. Under each answer, that run's
figures and a link that opens that run's trace.

If one side fails, its column shows the error and the other carries on to `done`. Stopping the turn
stops both.

Voice is unavailable while comparison mode is on, and says why.

Any two agents from the list can be compared — including two prompt agents. "Prompt versus hosted"
is the comparison this repo was built to show, but it is not a rule the screen enforces: comparing
two prompt agents with different instructions is the more useful day-to-day tool, and forbidding it
would be code written to remove a capability.

**i18n (§7).** New strings ship `{ en, pt }`: the mode toggle, the "compare with…" label, the column
headers' kind labels, the "voice is unavailable while comparing" reason, and any empty or failed
state. The figures are formatted by existing bilingual components.

## Acceptance criteria

1. **AC1** — Given comparison mode with two agents selected, when the user sends one message, then
   both agents receive the **same** text and both streams begin without waiting for the other to
   finish.
2. **AC2** — Given both columns streaming, when events arrive, then each column renders only its own
   agent's events: no text, tool row, MCP call, reasoning or usage figure appears under the wrong
   agent.
3. **AC3** — Given comparison mode is on, then each column renders its own activity — reasoning,
   tool rows, live status — using the same components as the single-agent view, and the shared
   activity panel is not shown.
4. **AC4** — Given a column's turn reaching `done`, then that column shows its time to first token,
   its total duration, its input / output / reasoning tokens and its cost — each figure rendered
   only when the events produced it, never as a zero standing in for an absence (§5).
5. **AC5** — Given a hosted agent in one column and a prompt agent in the other calling the same
   tool, then the two rows are visibly the same tool with different executor tags (`foundry` vs
   `bff`) — the difference spec 018 produced, made legible.
6. **AC6** — Given a column whose harness emits no `mcp_call` or no `reasoning_summary`, then that
   column renders correctly and the absence is not shown as an error. An empty reasoning card is a
   normal state (spec 015), and `mcp_call` is harness-specific after spec 018.
7. **AC7** — Given a completed column, when its trace link is opened, then the trace drawer shows
   **that** run's spans, keyed by that run's `response_id`.
8. **AC8** — Given one agent failing mid-turn, then its column shows the error and the other column
   continues and reaches `done`.
9. **AC9** — Given a turn in flight, when the user stops it, then both streams stop and both columns
   settle into a terminal state.
10. **AC10** — Given comparison mode, then the two runs use **separate Foundry conversations**: no
    conversation id is shared between the columns, and a follow-up question goes to both, each
    continuing its own history.
11. **AC11** — Given any two selectable agents from the spec 019 list, then the comparison runs —
    including two agents of the same kind. No rule restricts the pair.
12. **AC12** — Given the cost figure, then it covers what the events and spans report and **says
    what it does not cover**: a hosted agent's container compute is billed by the platform and is
    not visible to this app, so presenting a hosted column's cost as complete would be a
    measurement standing in for a guess (§5).
13. **AC13** — Given comparison mode is on, then the voice control is disabled with a reason in the
    active language.
14. **AC14** — Given comparison mode is turned off, then the app returns to the single-column chat
    with the originally selected agent, and the existing single-agent suites pass unchanged.
15. **AC15** — Given every string this spec adds, then each exists in `en` and `pt` (§7).
16. **AC16** — Given the same two agents and the same question, when the comparison is run against
    the **live** service, then the run is recorded as a dated fixture and the observed differences
    are written into `docs/harness-comparison.md` as measurements with their date (§5, §10).

## Contract / data impact

- **`AgentEvent` (§9): unchanged.** Two streams of the same contract. If anything here needs a new
  event — an agent identifier on each event, say — that is a §9 change needing its own spec, and the
  alternative (one SSE stream per agent, each already scoped) should be preferred precisely because
  it needs no contract change.
- **The chat transport.** Two concurrent turns per user message is new. Whether that is two
  independent SSE streams or one multiplexed stream is a plan decision, but it is a **public
  contract** either way and its source of truth is the backend route, mirrored by the frontend
  stream hook and the streaming documentation in the same change (§4).
- **Frontend turn state** currently assumes one turn in flight. Making it two must not fork the
  component tree: the column is the existing conversation view parameterised, or §4 is broken by
  construction — a second copy of the activity rendering would drift within a release.
- **Depends on spec 019** for naming a per-turn agent; this spec should not invent a second way.
- **`docs/harness-comparison.md`** gains measured figures and stops being sourced only from
  documentation (AC11).

## Clarified decisions

Taken 2026-09-16 with the user.

| # | Question | Decision |
|---|---|---|
| 1 | What gives way for the second column? | **The activity panel.** Each column carries its own activity inline, so everything about one agent is in one column and the eye never crosses the screen to compare tool calls. |
| 2 | Only different harnesses, or any two agents? | **Any two**, from spec 019's list, including two of the same kind. Restricting the pair would be code written to remove a capability, and two prompt agents with different instructions is the more useful everyday comparison. |
| 3 | Is the second agent chosen per session or per message? | **Per session.** It is a mode you are in, not a decoration on one message. |
| 4 | Multi-turn? | A follow-up goes to **both**, each continuing its own conversation (AC10). |
| 5 | Does the cost figure include container compute? | **No, and it says so** (AC12). The platform bills CPU + memory across active sessions; this app cannot see that number, and a cost figure that quietly omits it would be the kind of confident-looking wrong number §5 exists to prevent. |
| 6 | Two concurrent client-side tool calls in the BFF? | Twice the work, nothing structural to decide. Third-party rate limits on `search_web` are a `plan.md` risk, not a spec question. |
| 7 | How is comparison mode entered? | A `plan.md` decision — a header toggle or an action on the agents list. The behavior is fixed by the ACs either way. |

## What shipped, and what did not

Built 2026-09-19. Every acceptance criterion had a passing test except **AC16**, which asks for a
**measured** run against the live service.

**AC16 met 2026-09-20.** Six turns, three probes, both agents, through the real BFF
(`ai/scripts/compare_harnesses.py`); recordings under `ai/tests/fixtures/recorded/compare-*` and
the measurements in `docs/harness-comparison.md` with their date. The headline is that **time to
first token differs 2–3×** while total time does not, which is the difference a reader of this
screen actually feels. The credential was never missing — see `docs/REFERENCES.md`, *The credential,
and what it turned out to be*.

Three things this spec expected to decide turned out to need no decision, and that is worth
recording rather than quietly enjoying:

- **The transport.** The contract section left "two SSE streams or one multiplexed stream" as a plan
  decision. `POST /chat` already takes `agent` per request and resolves the harness per request
  (spec 019), so two columns are two ordinary posts. **The backend diff for this spec is empty**,
  and AC8 and AC10 hold by construction rather than by a rule.
- **Clarify decision #1** — the activity panel giving way so each column carries its own activity
  inline — was implemented by **spec 021**, which moved `ActivityPanel` inside each turn. AC3's
  second half was already true before this spec started.
- **AC5 and AC12** were already built: `ToolRow`'s executor tag, and the sentence spec 028 added for
  exactly this comparison. This spec passes each column its own `harness` and asserts the result.

Two defects were found by **rendering the screen and looking at it**, neither visible to a test that
reads the DOM or the stylesheet, and both now have tests:

- The meta line read `… 820 ms to first token 4.2 s`, with the label between the two numbers and no
  way to tell which it belonged to. The bare number has always been the total, so the labelled one
  moved after it.
- The columns handed `Conversation` no-op handlers, so **repeat** and **edit** rendered and did
  nothing. They are absent now: asking again here would have to ask both agents, which is what the
  composer already does.

## Out of scope / deferred

- A third column.
- Scoring, grading, or an LLM judging the two answers.
- Saving or sharing a comparison.
- Comparing across Foundry projects or subscriptions.
- Replaying a recorded comparison as a demo mode.
