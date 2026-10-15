# Spec: A turn that says what it is doing, calls that fold, and agents as a list

| | |
|---|---|
| **ID** | 061-claude-like-turn-and-agents-list |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-10-15 |
| **Clarified** | 2026-10-15 |

## Problem / motivation

The owner reviewed three surfaces against the Claude app and called out:

1. **Agents screen** — the info control sits almost on top of the favourite star, and there is only
   one way to look at ten agents: cards. *"dê uma opção de formato de lista também além de cards"*.
2. **A turn in flight** — *"enquanto ele tá respondendo, falta um status de processando, e em qual fase
   está"*. The live line (spec 011) disappears at the first token. An agent that writes a one-line
   preamble before each tool call ("I'll look up the architecture notes.") therefore shows a caret and
   nothing else through every later call and every wait between legs — the screen reads as frozen
   exactly where spec 011 meant to prevent it.
3. **Many tool calls** — *"essas chamadas de tools deveria ter uma opção de encolher quando são
   muitas"*. Four rows of `lookup_knowledge` push the answer below the fold.

The star/info overlap is a defect (two independently positioned controls); it rides in this change
with a regression test. The rest is new behaviour.

## Goals

- The agents screen offers **Cards** and **List**, the choice survives a reload, and the two controls
  in a card never overlap.
- A streaming turn always says which phase it is in — thinking, calling a named tool, writing, or
  working — from the first moment until it settles, at the **foot** of the turn, as the Claude app does.
- A turn with **three or more** calls shows them as one folded line naming the count and the distinct
  tools; one click unfolds them.

## Non-goals

- The voice overlay's tool list is **not** folded: it is newest-first and watched live, and its overlap
  was fixed separately. Deferred, not rejected.
- No new `AgentEvent` (§9). Every phase is derived from events already on the wire.
- No phase the events do not prove (§5): after a tool result with nothing after it, the line says the
  generic *working*, not an invented "reading the results".
- The inert `activityOpen` preference (spec 052) stays inert; it does not become the fold's default.

## User-facing behavior

**Agents.** Beside the search field, a two-button switch: *Cards* · *List* (`Cartões` · `Lista`).
List renders one compact row per agent with the same facts, the same favourite and inspect controls,
the same dimming and reason for agents this build cannot run.

**Live line.** At the foot of the turn, under any text: a phase, the running tool's name and step
when there is one, an elapsed clock, three animated dots. Phases: *The agent is working* · *Thinking*
· *Step N Calling `tool`* · *Writing* (`Escrevendo`). Gone when the turn settles.

**Folded calls.** With three or more calls, one line: chevron · *4 tool calls* · `lookup_knowledge`
(distinct names, in order of first use). Collapsed from the start; the reader's click wins and is kept
for that turn. Two calls or fewer render as today.

## Acceptance criteria

### Agents screen
1. **AC1** — Given any agent card, the favourite and inspect controls share one container, so their
   spacing is a declared gap rather than the arithmetic of two absolute offsets.
2. **AC2** — Given the agents screen, a *Cards*/*List* switch is present with exactly one option pressed;
   choosing *List* marks the listing as a list.
3. **AC3** — Given *List* was chosen, when the screen is rendered again from a fresh mount, *List* is
   still chosen; storage that refuses still renders Cards.
4. **AC4** — In List, every agent still renders its name, choose control, favourite, inspect, and — for
   one that cannot be chosen — its reason, with the choose control disabled.

### Live line
5. **AC5** — Given a streaming turn whose last event was text, the status is *writing* and the line is
   rendered **after** the answer text.
6. **AC6** — Given a turn that wrote text and then started a tool call, the status is *calling* that tool
   (a running call outranks text that arrived earlier).
7. **AC7** — Given a turn whose last event was a completed tool result, the status is the generic
   *working*; given reasoning last, *thinking*.
8. **AC8** — The elapsed figure is outside what the polite live region announces.
9. **AC9** — Given a settled turn (done, error or stopped), there is no live line.

### Folded calls
10. **AC10** — Given a turn with three or more calls, the calls render folded: one control with
    `aria-expanded="false"`, naming the count and the distinct tool names, and no individual row.
11. **AC11** — Activating that control shows every row; activating it again folds them.
12. **AC12** — Given two calls or fewer, every row renders and no fold control exists.

## Contract / data impact

- No `AgentEvent` change, no BFF change, no `POST /chat` change.
- `Turn` gains an **optional** field naming the kind of the last event, derived in the reducer. Optional,
  so turns restored from `localStorage` by an older build still render.
- `fla.ui.v1` gains the agents view beside the rail's collapsed flag; both are kept when either changes.
- Supersedes spec 011 AC5 ("say nothing once the answer has started") and, for turns reduced from
  events, AC4 ("back to thinking when the result comes back"): after a result the line says the
  generic *working*, because nothing proves the model is reasoning (§5). A turn with no record of
  order keeps the old content-based answer.

## Open questions (clarify before planning)

- [x] Fold default — **collapsed from the start**, threshold 3 (owner, 2026-10-15).
- [x] Live line during writing — **visible to the end, at the foot** (owner, 2026-10-15).
- [x] Voice overlay — **chat only**; voice deferred (owner, 2026-10-15).
- [x] Persist Cards/List — yes, in the UI chrome key, not in Preferences (a browser fact about its
      own furniture, like the rail).

## Out of scope / deferred

- Folding in the voice overlay.
- Separating preamble sentences that arrive across legs with no space between them
  ("notes.I'll check") — a rendering question of its own, observed while writing this spec.
