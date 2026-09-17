# Spec: The keyboard — shortcuts and a command palette

| | |
|---|---|
| **ID** | 025-keyboard |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

Every action in this app costs a trip to the mouse. Focusing the composer, closing the trace panel,
collapsing the rail, switching agent, opening a stored conversation — all of them are a pointer
journey across a three-column layout, and the person doing them most is the one demonstrating the
app to a room while talking.

There is also a discovery problem that shortcuts alone do not solve. Spec 021 moved the agents
listing onto its own screen and spec 022 put favourites in the rail, which is right, but it means
the ten agents, the stored conversations, the language switch and the voice session now live in four
different places. A single field that reaches all of them is both the fast path and the map.

The accessibility base is already good — `:focus-visible` on every control, `aria-live` on the
status line, a focus trap for modals — so this is about speed, not about making the app operable.

## Goals

- **The hands stay on the keyboard** for the actions taken most: ask, stop, close, navigate.
- **One field reaches everything** the app can do, searchable by name.
- The shortcuts are **discoverable** — a reader who never reads documentation finds them.
- Nothing here changes what the app decides; every command is an action a person chose (§8).

## Non-goals

- **No customisable key bindings.** One set, documented.
- **No commands that ask the model anything.** The palette navigates and configures; it never
  composes a prompt, never picks a tool, never re-runs a turn on its own.
- **No global capture.** Shortcuts do not fire while the reader is typing in a field, except the
  ones that are explicitly about the field.
- No change to the `AgentEvent` set (§9) or to any BFF endpoint.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Shortcuts.** A small set, each one standing for something the reader already does with the mouse:
focus the composer; close the topmost overlay; collapse and expand the rail; open the palette; move
the trace panel between turns; start a new conversation. The exact keys are the plan's business,
but two rules hold: nothing overrides a browser default the reader relies on, and every shortcut has
a visible control that does the same thing, so the keyboard is never the only way.

**The palette.** One field over the app, opened by a shortcut and by a control in the rail. Typing
filters a flat list of what the app can do right now, grouped by kind: **agents** (from the listing,
with their selectability and reason, exactly as the agents screen renders them), **conversations**
(this browser's record), **actions** (new conversation, start voice, open trace, toggle rail,
switch language). Arrow keys move, Enter runs, Escape closes.

**The palette shows what is true.** An agent this build cannot drive appears in the palette and
cannot be run, carrying its reason — the same rule as the agents screen and the rail (019, 022).
Voice appears greyed when the deployment has no Voice Live. The palette never offers something that
would fail on Enter.

**Discovery.** Controls that have a shortcut say so in their tooltip. The palette lists its own
shortcut. There is no separate cheat-sheet screen to maintain.

## Acceptance criteria

1. **AC1** — Each shortcut performs its action when the app has focus and no text field is focused.
2. **AC2** — No shortcut fires while a text field is focused, except the ones defined as
   field-scoped.
3. **AC3** — Every shortcut's action is also reachable by an on-screen control.
4. **AC4** — The palette opens by shortcut and by its rail control, and closes on Escape, restoring
   focus to where it was.
5. **AC5** — Typing filters across agents, conversations and actions; the list is navigable by arrow
   keys and run by Enter.
6. **AC6** — Choosing an agent in the palette selects it and starts a new conversation (019 AC7),
   from either view.
7. **AC7** — Choosing a conversation in the palette restores it exactly as the rail does (021).
8. **AC8** — An agent that is not `selectable` renders in the palette with its reason and cannot be
   run; an action that is unavailable (voice disabled) renders unavailable.
9. **AC9** — The palette traps focus while open and returns it on close (existing modal-focus
   behaviour, extended).
10. **AC10** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged. |
| **Key bindings** | New cross-cutting surface. One table is the source of truth; the palette, the tooltips and the handler all read it (§4). A second list of keys anywhere is the §4 violation. |
| **Selectability** | Still the BFF's (`HARNESS_FOR_KIND`). The palette renders `selectable` / `reason` as given — it does not re-derive them (§4). |
| **Docs** | `docs/development-workflow.md` or the README — wherever the app's controls are described. |

## Clarified decisions (2026-09-17)

- **Both halves ship together.** Shortcuts are speed and the palette is discovery; they are two
  halves of one problem, and shipping the keys without the surface that teaches them would leave the
  feature undiscoverable by exactly the readers it is for.
- **No chord that the browser reserves.** `⌘⇧N` was proposed and rejected during planning: it is a
  new incognito window, captured above the page, and a binding the app cannot actually prevent is
  worse than no binding. The rule from the goals is now a test, not an intention. Actions that need
  no chord use a **single letter, and only when no text field has focus** — which is also what makes
  `/` safe.
- **The palette opens the trace panel; it does not list traces.** Spec 024 shipped, so a trace has an
  address and the palette could enumerate them. It will not: the turns of a conversation are already
  on screen with a trace control each, and a second list of them would be a second way to say the
  same thing. One action, on the turn the panel is already following.
- **The rail keeps its language switch.** The palette gains language as an action, but removing the
  visible control would put a bilingual app's only language affordance behind a keyboard shortcut —
  which fails §7's intent even while satisfying its letter.
- **Conversations are matched by title only, for now.** Searching message text is spec 027's index,
  and building a second one here would be the §4 failure. When 027 lands, the palette reads *its*
  matcher rather than growing one.

## Open questions (clarify before planning)

*None — resolved above.*

## Out of scope / deferred

- Customisable bindings; a settings screen for keys.
- Slash commands inside the composer — that is a composer feature and a different argument.
- A palette entry that runs a tool (spec 042 owns that, and it has a §8 discussion of its own).
