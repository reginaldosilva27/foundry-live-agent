# Spec: The shell, elaborated — navigation, an agents screen, answer actions, local history

| | |
|---|---|
| **ID** | 021-ui-shell |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

The screen works and says true things. It is also **flat**, and flatness is now costing us.

Spec 019 put the project's agents in the sidebar, in the space the session list used to occupy.
That space was sized for a note admitting there was no history; it is not sized for a real listing
read from a real Foundry project. At 900px the list clips mid-row — `dataagent` is cut in half by
the language switch — and each agent is three lines of plain text with no mark, no model, and no
indication of which harness would drive it. The one surface built to show what the project contains
is the surface least able to show it.

Three more gaps come from the same cause — the shell has exactly one view and no navigation:

- **A finished answer is a dead end.** It carries a meta line and nothing else. There is no way to
  copy it, take it out of the browser, or hand it to someone — which is what a reader does with an
  answer they are using to learn something.
- **Which agent will answer is only visible 900px away**, in the sidebar, while the reader's eyes
  and cursor are in the composer. The one decision this app exists to make visible is the one the
  composer stays silent about.
- **Every reload throws the session away.** Honest in Phase 1, when the app genuinely had nowhere
  to put it. That was a statement about the *browser*, not about Foundry: the conversation itself
  lives in Foundry, keyed by an id this app already holds and already sends back on every turn. We
  have been discarding our pointer to a conversation the platform still has.

Spec 020 makes this urgent for the same reason 019 was urgent. Two agents answering side by side
needs a shell that can hold two columns, a way to name who is in each one, and somewhere for the
comparison to live once it is over. Building that inside the current single-view shell means
building it twice.

The reference for the structure is a working product the author uses, shown to me as two
screenshots and **not vendored here** — it is somebody else's UI: a rail with real navigation,
agents as cards, an action bar under each answer, the answering agent named in the composer, and
history down the left. We take its **structure and density** — and none of its skin. The Dataside brand still holds: ink sidebar, Poppins, `#0074FF`,
SVG icons, no emoji, no illustration.

## Goals

- **Navigation.** The shell has more than one view, and a rail that says which one you are in and
  lets you collapse it out of the way.
- **An agents screen that can breathe** — the project's agents as cards with mark, kind, version,
  status, model and harness, searchable, in the main column instead of a clipped sidebar list.
- **An answer you can take with you** — copy it, download the turn as Markdown, open its trace.
- **The answering agent named where the question is typed**, and switchable there.
- **A conversation that survives a reload** — this browser remembers the transcript it already
  drew and the Foundry conversation id it was given, so the next message continues that
  conversation instead of starting a new one.
- **Honesty about every one of those** (§5): local history says it is local, an agent that cannot
  be chosen says why, and a browser that refuses storage is told about, not worked around silently.

## Non-goals

- **No new BFF endpoint, no change to any request or response body.** `POST /chat` keeps taking
  exactly `message · conversation_id · agent`, and `GET /agents` and `GET /config` are untouched.
  This spec is a change to the app around the agent, not to what it says to Foundry.
- **No change to the `AgentEvent` set (§9).**
- **No agent loop entering the app (§8).** In particular a conversation's title is **derived from
  the first thing the person typed** — the app never asks a model to name a thread, because that
  would be this app running its own inference, which is the whole thing §8 forbids.
- **No history sent back to the model.** The stored transcript is a drawing the browser keeps of
  events it already received. Foundry holds the conversation; the request body stays a single turn.
- **No side-by-side.** That is spec 020, which lands in this shell.
- **No creating, editing or deploying agents** (019's non-goal, unchanged).
- **No thumbs up / thumbs down.** The reference has them; we have nowhere to send feedback, and a
  button that only sets a local boolean is a drawing of a feature (§5).
- **No server-side or cross-device history**, no export of a whole session, no search inside
  history. One conversation, one Markdown file, one browser.
- **No theme switch.** The app stays on the Dataside palette it is built in.

## User-facing behavior

All new prose ships `{ en, pt }` (§7). Agent names, model ids, version numbers and tool names are
**data** and stay verbatim.

### The rail

The left column keeps its ink ground and gains structure: the brand mark, a **New session** action,
and a navigation group of two items with SVG icons — **Chat** and **Agents** — where the current
one is marked. Below it, **History**. At the foot, the model / gateway / transport lines that are
there today.

A control collapses the column to an icon-only rail. Collapsed, every item keeps its accessible
name, and the choice is remembered in this browser — the one kind of state a browser should keep
about itself.

**Where the agents live now.** The sidebar keeps only the agent that is *answering*; the full
listing moves to the Agents screen, which is where a listing of that size belongs. This is the
reference's own split — a short favourites strip beside a full screen — and it is what frees the
sidebar's vertical space for history.

### The Agents screen

The main column shows either the conversation or the agents screen. The agents screen lists every
agent in the project as a card carrying: a **monogram mark** built from the agent's own name (two
letters on a brand tint — generated, never an uploaded picture and never an emoji), the name, the
kind, `v<n> · <status>`, the model, and the **harness badge** naming what would drive it. The card
for the agent that is answering says so.

Spec 019's rules survive the move intact, because they are the honest half: **every agent is
listed, including the ones this build cannot run**, dimmed, not clickable, carrying its own reason.
The reason still arrives from the BFF as a *code* and is said here in the reader's language.

A search field filters the cards by name. Nothing matching says so in one line rather than showing
an empty grid. Choosing a card selects that agent, starts a new conversation (019 AC7, unchanged)
and returns to the chat.

### Under a finished answer

A finished agent turn gains a row of icon actions above its meta line:

| Action | What it does |
|---|---|
| **Copy** | Puts the answer's text on the clipboard; the control confirms for a moment, then returns |
| **Download** | Saves the turn as a Markdown file: the question, the answer, the calls it made, and the model / tokens / latency footer |
| **Trace** | Opens the trace panel on that turn — the same thing *view trace* does, now also an icon |

The row is absent while the turn streams. A turn that ended in an error keeps **Trace** and loses
the two that have nothing to act on.

### The composer

The composer names who is about to answer: the monogram and name of the selected agent, or of the
BFF's configured one when nothing has been chosen. That chip opens a menu of the agents this build
can drive; choosing one switches — starting a new conversation, exactly as choosing on the agents
screen does — and the menu closes on `Escape`, returning focus to the chip. A last entry in the
menu opens the full agents screen.

### History, in this browser

When a turn finishes, the conversation is written to this browser's storage: its Foundry
`conversation_id`, the agent that held it, the transcript already on screen, a timestamp, and a
title taken from the first thing the person typed (trimmed to fit). The sidebar lists them
newest-first under **Today / Last 7 days / Older**, and says — once, quietly — that they live in
this browser and are not the Foundry conversation store.

Reopening one restores the transcript **and the conversation id**, so the next message continues
that Foundry conversation rather than opening a new one. It also restores the agent it was held
with; if that agent is gone from the project or is no longer selectable, the conversation opens
readable and refuses the next turn with the reason, rather than quietly answering as somebody else.

A conversation can be renamed and deleted. **New session** starts an empty one and deletes nothing.
A browser that refuses storage — a private window, a cleared or blocked origin — gets the app it
has today: everything works, nothing is kept, and the sidebar says history is unavailable here.

This retires design note **M9** (`docs/design-system.md`), which parked the mock's session list on
the grounds that there was nowhere to persist to. There is somewhere now, and it is smaller and
more local than the mock implied — the note becomes a record of what we actually built.

## Acceptance criteria

**The rail**

1. **AC1** — The sidebar renders a navigation group with **Chat** and **Agents**; exactly one is
   marked current, and activating each one shows that view in the main column.
2. **AC2** — Activating the collapse control puts the sidebar in a collapsed state in which every
   navigation item still exposes its accessible name; the collapsed/expanded choice is read back
   from browser storage on the next mount.
3. **AC3** — With the sidebar collapsed or expanded, the footer still reports model, gateway and
   transport; when `GET /config` failed it says so rather than rendering blanks.

**The Agents screen**

4. **AC4** — Given a listing of agents, the agents screen renders one card per agent carrying its
   monogram, name, kind, `v<version> · <status>`, model and harness badge; an agent with
   `selectable: false` renders dimmed, is not activatable, and carries its translated reason.
5. **AC5** — Typing in the search field narrows the cards to those whose name contains the query,
   case-insensitively; a query matching nothing renders one "no agents match" line and no grid.
6. **AC6** — Activating a selectable card selects that agent, resets the conversation, and returns
   the main column to the chat view.
7. **AC7** — When the listing failed, the agents screen renders the translated error code and names
   the configured agent as the one still answering (019 AC3/AC9, on the new surface).
8. **AC8** — The sidebar shows the answering agent and does **not** render the full agent list.

**Answer actions**

9. **AC9** — A streaming turn renders no action row; the same turn once `done` renders Copy,
   Download and Trace.
10. **AC10** — Activating Copy writes the turn's answer text to the clipboard and the control
    reports success, reverting after a moment.
11. **AC11** — Activating Download produces a Markdown document containing the user's question, the
    answer text, every tool and MCP call the turn made, and a footer with model, token counts and
    latency.
12. **AC12** — Activating Trace opens the trace panel on that turn.
13. **AC13** — A turn that ended in `error` renders Trace and renders neither Copy nor Download.

**The composer chip**

14. **AC14** — The composer names the selected agent; with nothing selected it names the agent from
    `GET /config`; with neither available it renders no chip rather than an empty one.
15. **AC15** — Activating the chip opens a menu listing only selectable agents; choosing one selects
    it and resets the conversation; `Escape` closes the menu and returns focus to the chip.

**History**

16. **AC16** — When a turn reaches `done`, the conversation is written to storage with its
    conversation id, agent name, title derived from the first user message, timestamp and
    transcript; the sidebar lists it under the right time group, newest first.
17. **AC17** — Reopening a stored conversation restores its messages, and the next message sent
    carries that conversation's `conversation_id` in the request body.
18. **AC18** — Reopening a conversation whose agent is absent from the listing, or not selectable,
    renders the transcript, refuses the next turn, and says why in the reader's language.
19. **AC19** — A stored conversation can be renamed, and deleting one removes it from storage and
    from the list; **New session** clears the view and removes nothing.
20. **AC20** — With browser storage unavailable (reads and writes throwing), the app renders and
    streams a turn exactly as it does today, and the sidebar states that history is unavailable in
    this browser.
21. **AC21** — No request the app sends carries stored transcript: a turn sent from a restored
    conversation has a body of exactly `message`, `conversation_id` and `agent` (§8).
22. **AC22** — Storage holds at most 25 conversations; writing the 26th drops the oldest.

**Gates that apply to the whole change**

23. **AC23** — Every string added by this spec exists in `en` and `pt`, and no component contains
    prose (existing i18n tests, extended).
24. **AC24** — No emoji or Unicode glyph icon ships: monograms are letters from the agent's own
    name on a brand tint, and every icon is SVG (existing brand test, extended).
25. **AC25** — At 1280×800 and 1440×900 the sidebar's history region and the agents grid each
    scroll within themselves, and no region clips another (the defect this spec opens on).

## Contract / data impact

| | |
|---|---|
| **`AgentEvent` (§9)** | Unchanged. No event added, removed or reshaped. |
| **BFF HTTP surface** | Unchanged. `POST /chat` keeps `message · conversation_id · agent`; `GET /agents` and `GET /config` are read exactly as they are today. |
| **New persisted data** | A versioned localStorage record per browser: conversations (id, agent, title, timestamp, transcript) and the sidebar's collapsed flag. Its shape has **one** source of truth in the frontend and is described in the plan; nothing server-side reads it. |
| **`HARNESS_FOR_KIND`** | Still the BFF's, still the only place kind → harness is decided (019). The cards render `selectable` / `reason` / `harness` as given; no copy of that rule enters TypeScript (§4). |
| **Docs that must move in the same commit (§4, §6)** | `docs/design-system.md` — retire note **M9** and record the rail / cards / action row / chip as the layout contract; `docs/architecture.md` — say that the browser keeps a local render cache and a conversation pointer, and that Foundry remains the conversation's owner; `CLAUDE.md` ↔ `AGENTS.md` if any rule changes; `specs/README.md` index. |
| **Bilingual (§7)** | Every new string ships `{ en, pt }` in `frontend/src/i18n/strings.ts`. |

## Open questions (clarify before planning)

*Resolved with the author on 2026-09-16 (four decisions, recorded here rather than lost in chat):*

- Structure from the reference screenshots, skin from the Dataside DS — icons, cards, density,
  hierarchy and generated monogram marks are in; light theme, illustrated avatars and emoji are out.
- History is **local to the browser**, and reopening resumes the Foundry conversation by its id.
- This spec lands **before** spec 020, so side-by-side is built into the new shell, not retrofitted.
- The sidebar keeps the answering agent only; the full listing lives on the Agents screen.

## Out of scope / deferred

- Feedback controls (thumbs, flags) — nowhere to send them (§5).
- Search *inside* history, tags, pinning, multi-select, bulk delete.
- Exporting a whole session, or any format other than Markdown.
- Model-written conversation titles (§8 — the app does not run inference of its own).
- Cross-device or server-side history; a "resume on another machine" story.
- Tabs on the agents screen (the reference's *Workspace / Mine / Teams*) — this project has one
  project and no such grouping to show (§5).
