# Spec: A home screen that holds together, and a rail that reads at both widths

| | |
|---|---|
| **ID** | 068-rail-and-home-polish |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-11-14 |
| **Clarified** | 2026-11-14 |

## Problem / motivation

The owner looked at the running app and said: *"na tela inicial tem muito espaço sobrando, o chat
parece que está encurtado; quando fecha a barra lateral fica feio, a barra lateral aberta também não
está tão visual"*. Three screenshots, three findings, each measured in a browser at 1440×900:

- **The home screen breaks in two.** The greeting and the agent's examples centre themselves in
  whatever height the column has left, while the composer stays docked at the bottom. At 1440×900
  that leaves a ~180px empty band between the last example card and the composer, and the two
  blocks don't line up either — the examples are 720px wide and the composer is 760px.
- **The collapsed rail is broken, not just plain.** The conversation search stays on screen as an
  empty 32px circle. The brand mark and the expand control squeeze side by side into 48px. The
  answering agent and the favourites draw as near-identical `FL` marks with nothing between them
  and the navigation. The whole foot disappears, so theme, About and Preferences can't be reached
  without expanding. And **four controls have no accessible name** when collapsed (New session,
  the answering agent and each favourite — observed in the accessibility tree). Spec 021's AC2
  promised that labels leave the layout but stay in the accessibility tree. That held for the
  three navigation items and nowhere else, and jsdom applies no stylesheet, so no test could see
  it.
- **The expanded rail has no structure below the favourites.** The search field sits right under
  the last favourite with no heading and no space. The footer's *What this build is* and
  *Preferences* are set in monospace, so they read as debug output rather than navigation.
  Conversation titles cut off at about 60% of the row (*"Qual é a palavra-có…"*), because the
  invisible rename and delete buttons keep their space.

## Goals

- When the chat is empty on a desktop-sized window, the greeting, the examples and the composer
  read as **one centred block**.
- The reading column, the composer and the home block share **one width**, a little wider than
  today.
- The collapsed rail is a tidy column of marks. Every one of them has an accessible name and a
  tooltip, the stray search field is gone, and there is a pinned foot with theme, About and
  Preferences.
- The expanded rail has a visible *Conversations* section, and its footer is styled as navigation.

## Non-goals

- **No new colours, fonts or tokens.** Values still come only from the vendored
  `public/ds/colors_and_type.css` (spec 036). The `designer` skill was used for layout and spacing
  only.
- **No rail width change.** 248px and 64px stay, and so does the 1542px drawer breakpoint derived
  from them.
- **No behaviour change.** The same routes, actions and handlers. No backend, contract,
  `AgentEvent`, `POST /chat` or storage change.
- **No reordering of the home screen.** The examples stay above the composer, as today.
- **No language switch in the collapsed rail.** A two-option toggle has no meaningful single mark.
  Expanding the rail is one press away.
- **No change to the narrow overlay rail (spec 047)** beyond what it inherits from the expanded
  styling.

## User-facing behavior

**Empty chat, desktop.** On a window at least 761px wide and 640px tall, the chip, greeting,
subtitle, examples and composer form one block, centred vertically in the main column. If the
window is too short for all of it, the greeting area scrolls before any of the composer is lost.
On a phone-sized or short window, and as soon as a conversation has a turn, the composer docks at
the bottom exactly as before. The Playground's columns are unaffected.

**One width.** The reading column, the composer and the home block are all 800px wide at most,
up from 760px for the column and composer and 720px for the home block.

**Collapsed rail (64px).** Top to bottom:

1. The brand mark, with the expand control under it.
2. New session as a round mark, then Chat, Agents and Playground as square marks of one size.
3. A divider, then the answering agent's mark. The favourites follow, except the one already
   answering, which would otherwise be drawn twice.
4. No search field and no history.
5. A pinned foot with three marks: *What this build is*, *Preferences* and the theme switch.

Every mark has an accessible name and a hover tooltip.

**Expanded rail.**

- When at least one conversation is kept, a **Conversations** / **Conversas** heading sits above
  the search field (the string already exists).
- The search field spans the row width and has breathing room above it.
- Conversation titles use the whole row. Rename and delete appear over the row's end on hover
  or focus.
- In the footer, *What this build is* and *Preferences* are rows with an icon, in the rail's sans
  type, at the same inset as the navigation rows.
- Language is one segmented control, with the theme switch beside it. The footer stays outside
  the scrolling region, and *What this build is* stays reachable when the config failed.

## Acceptance criteria

1. **AC1** — Given an empty chat on a window at least 761px wide and 640px tall, the main column
   places the greeting block directly above the composer, with equal flexible space above the
   block and below the composer. The block's row sizes to its content before the spacers take
   any space, so a short window scrolls the greeting block before the composer shrinks.
2. **AC2** — Given a narrower or shorter window, or a conversation with at least one turn, the
   column keeps its docked layout (header · conversation · composer). The centring applies only
   when the empty conversation is a **direct** child of the main column, so the Playground's
   nested `Conversation` columns never match.
3. **AC3** — `--chat-width` is **800px** and is the one width of `.conversation__inner`,
   `.composer` and `.empty`. This supersedes the 760px pinned by specs 055 and 058.
4. **AC4** — Given the rail collapsed, New session, the answering agent, every favourite, *What
   this build is*, *Preferences* and the theme switch each carry an `aria-label` and a `title`.
   Their name no longer depends on text the stylesheet hides.
5. **AC5** — Given the rail collapsed:
   - the conversation search and the history are not displayed;
   - the brand row stacks the mark above the expand control;
   - New session is a circle, and the three navigation items share one square size.
6. **AC6** — Given the rail collapsed, the foot stays displayed with the theme switch, *What this
   build is* and *Preferences* as marks of the same square size, and the language switch is not
   displayed.
7. **AC7** — Given the rail collapsed, a divider separates the navigation from the agent marks,
   and a favourite that is the answering agent is not displayed a second time.
8. **AC8** — Given the rail expanded and at least one kept conversation, a *Conversations*
   heading (`history.conversations`, en + pt) is rendered above the search field. With none kept,
   neither the heading nor the field renders.
9. **AC9** — Given the rail expanded, *What this build is* and *Preferences* each render an icon
   and use the rail's sans type with the navigation rows' inset. The language options sit inside
   one segmented track. The footer, the language switch and the theme switch stay outside
   `.sidebar__scroll`.
11. **AC11** — Given the rail expanded, a kept conversation's title uses the row's full width. The
    rename and delete actions overlay the end of the row only while it is hovered or focused, and
    while hidden they take no clicks, so a click near the end of a title can never land on an
    invisible *delete*. They stay reachable by keyboard. The conversation on screen is highlighted
    the way the current view is, and a focused row is painted like a hovered one, so the actions
    never sit on top of the title's text.
12. **AC12** — Given a voice failure while the chat is empty on a desktop window, the error renders
    under the composer, never in the spacer above the greeting. Its track is zero high while
    there is no error.
10. **AC10** — The existing guards stay green: no colour literal, no unknown token, rail contrast
    in both themes, focus ring, base rules before breakpoints, the 320px floor, and a11y names.
    Painted evidence comes from a browser (see *Evidence*).
11. **AC11** — Given the rail expanded, a kept conversation's title uses the row's full width. The
    rename and delete actions overlay the end of the row only while it is hovered or focused, and
    while hidden they take no clicks, so a click near the end of a title can never land on an
    invisible *delete*. They stay reachable by keyboard. The conversation on screen is highlighted
    the way the current view is, and a focused row is painted like a hovered one, so the actions
    never sit on top of the title's text.
12. **AC12** — Given a voice failure while the chat is empty on a desktop window, the error renders
    under the composer, never in the spacer above the greeting. Its track is zero high while
    there is no error.
10. **AC10** — The existing guards stay green: no colour literal, no unknown token, rail contrast
    in both themes, focus ring, base rules before breakpoints, the 320px floor, and a11y names.
    Browser evidence at 390 and 1440 in light and dark, with the rail open and collapsed, comes
    from the credential-free demo.

## Evidence (2026-11-14)

Two servers were used, and nothing was sent through the live one.

- **Credential-free demo** (`app.demo`, :8100/:5199):
  - a replayed turn at 1440×900 in dark, with the composer re-docked at 800px and the open
    conversation highlighted in the rail;
  - `/playground` in light. Its column renders no `Conversation` before the first question, so it
    is unaffected.
  - the empty chat at 390×844 in light;
  - the collapsed rail at 1440×900 in dark, where the accessibility tree names every control
    (four were nameless before).
- **Local dev server** (:5173, live BFF, rendering only, no turn sent):
  - the empty chat at 1440×900 in light and dark, with the rail expanded and collapsed;
  - a hovered history row;
  - the short-window track sizes: at 1440×700 the rows are `60 48 336 188 48`, and at 900×660
    they are `60 0 392 188 0`, so the block scrolls internally and the composer stays whole;
  - a probe `.error-card` landing under the composer, with a 0px track without it;
  - 390×844 in dark, with the rail overlay open.
- **Found while checking, and fixed here.** The closed narrow rail kept its `box-shadow`
  off-canvas, which bled a grey strip down the left edge of the phone screen. It has a regression
  test.

## Contract / data impact

None. `app.css` is the visual source of truth. `Sidebar.tsx` gains attributes and one heading, and
`Icon.tsx` gains one icon. No string is added: `history.conversations` already exists in en and pt.

## Open questions (clarify before planning)

None. Each was settled by the owner's screenshots, or by a default recorded here that they can
veto:

- *"o chat parece que está encurtado"* is read as the split home screen plus a narrow column. The
  fix is the centred block and a **modest** widening to 800px. Going fluid was rejected, because
  760px already sits at the upper end of a comfortable line of prose.
- The examples stay above the composer. Moving them below would mean reordering the DOM across
  `Conversation` and `App` for a taste call the owner didn't make.

## Out of scope / deferred

- A hover-to-reveal expand control over the brand mark (the pattern some chat apps use). Two
  visible controls are simpler and need no pointer to discover.
- Showing the conversation history as marks in the collapsed rail.
