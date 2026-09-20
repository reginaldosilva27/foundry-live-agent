# Spec: The app on a narrow screen

| | |
|---|---|
| **ID** | 047-narrow-screen |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-20 |
| **Clarified** | 2026-09-20 |

## Problem / motivation

The stylesheet declares two breakpoints. At 1100px the trace panel becomes an overlay, which works.
At 760px it does exactly two things: the shell collapses to one column, and

```css
.sidebar { display: none; }
```

That is the entire narrow-screen story, and it is not a layout — it is a deletion. The rail is the
only place the app's navigation exists, so hiding it removes **the only way to reach five of the
seven screens**.

Measured in a browser at 390px — an ordinary phone width — on the chat:

| | |
|---|---|
| `document.body.scrollWidth` | **594** against a 390px viewport |
| sideways scroll | **204px**, because `html` scrolls even though `body` sets `overflow-x: hidden` |
| the rail | `display: none` |
| controls a person can see | **six**: the skip link, Voice, Traces, the agent chip, the mic and Send |
| of those, off the right edge | **two** — Voice and Traces, reachable only by scrolling sideways |
| screens reachable | **one** |

`/agents`, `/compare`, `/history`, `/about` and `/preferences` have no control pointing at them.
Neither does the command palette, whose only button lives in the rail; `⌘K` still works, which is no
help on a phone. Typing a question and reading the answer works. Everything else the app does is
gone, without saying so.

Two things make this worse than "cramped". `display: none` removes the rail from the **accessibility
tree**, so a screen-reader user at a narrow viewport loses navigation entirely rather than finding it
collapsed. And `a11y.test.tsx` walks the app at jsdom's default width, so the pass that exists
precisely to stop controls losing their names has never looked at the width where they lose their
existence.

This is not a request for a mobile product. It is that the app claims a breakpoint it does not
implement, and the honest options are to implement one or to say the app has a minimum width.

## Goals

- **Every screen the app has is reachable at every width it renders at**, or the app says plainly
  that it does not render at that width.
- **Nothing sits off the edge of the window.** A control a person cannot see is a control they do
  not have.
- **One navigation, not two.** Whatever appears on a narrow screen routes through the same handlers
  the rail already calls (§4) — a second way to choose an agent that behaves slightly differently is
  the drift spec 025 already refused once.
- **The accessibility pass covers the narrow width too**, so this cannot silently rot again.

## Non-goals

- **No mobile product.** No touch gestures, no swipe, no install prompt, no separate route set. This
  is the same app at a smaller size.
- **No redesign of any screen's content.** What a screen shows is settled by its own spec; this is
  about reaching it and fitting it.
- **No new capability.** Nothing becomes possible on a phone that is not possible on a laptop.
- **Not voice.** Whether a spoken session is usable on a phone is a question about microphones and
  audio routing, not about layout.
- No change to the `AgentEvent` set (§9), no BFF contract change, and no new route.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Below the narrow breakpoint the navigation is still there**, reached from a control in the header
rather than from a rail that is always open. It offers what the rail offers — the screens, the
palette, a new session — and it routes through the same handlers, so choosing an agent from a narrow
screen starts a new conversation exactly as it does from the rail.

**The header fits.** At the widths this app is used at, it currently wants ~594px and gets 390. What
gives way, and in what order, is the same question spec 004's fix answered for 900px and must now
answer one step further down — with the same rule: a control never shrinks, because a control that
shrinks is a target that moves.

**Nothing is hidden without a way back.** A control that does not fit moves into the menu; it does
not disappear. The difference matters because the current behaviour is indistinguishable from the
feature not existing.

**The trace panel is already an overlay** below 1100px and stays one.

**If a width is genuinely not supported, the app says so** rather than rendering a broken screen —
and which widths those are is a decision, not a discovery.

## Acceptance criteria

1. **AC1** — At the narrow widths this spec names, every screen in the route table is reachable
   through a visible control, without a keyboard.
2. **AC2** — At those widths, `document.body.scrollWidth` equals the viewport width: nothing renders
   past the right edge, asserted.
3. **AC3** — The navigation offered on a narrow screen calls the **same** handlers as the rail; no
   second implementation of choosing an agent, opening a conversation, or starting a session (§4,
   asserted by the handlers being shared rather than by inspection).
4. **AC4** — No interactive control is removed from the accessibility tree at a narrow width in
   order to make the layout fit; a control that does not fit is relocated, not deleted.
5. **AC5** — `a11y.test.tsx` walks the app at a narrow width as well as the default, and every
   interactive control still has an accessible name.
6. **AC6** — The wide layout is unchanged: the existing suites pass untouched, and the rail behaves
   exactly as it does today above the breakpoint.
7. **AC7** — Every new string ships `en` + `pt`.
8. **AC8** — The rendered page is walked in a browser at the named widths, in both themes, and the
   result is recorded with its date (§5).

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **Routes** | Unchanged. `route.ts` stays the single source of the scheme (spec 024); nothing here adds an address or a screen. |
| **Navigation handlers** | The rail's `onView`, `onSelectAgent`, `onOpenConversation`, `onNewSession` and `onOpenPalette` are the single source of what navigation *does* (§4). Whatever renders them on a narrow screen must call them, not reimplement them. |
| **i18n (§7)** | Any label the new control needs, in both languages. |
| **Docs** | `docs/design-system.md` — the breakpoints and what each one does, which is currently written nowhere. |

## Clarified decisions

Taken 2026-09-20 with the user. Q4 and Q5 were resolved by measuring rather than by asking.

| # | Question | Decision |
|---|---|---|
| 1 | How does navigation come back? | **The rail itself becomes an overlay**, opened from a control in the header, over the conversation, with a backdrop. No new component: the same `Sidebar`, the same handlers, the same translations — which makes AC3 true by construction rather than by review. It is also the pattern the trace panel already uses below 1100px, so the app ends with **one** answer to "a side panel on a narrow screen" instead of two. |
| 2 | What is the floor? | **320px.** The narrowest phone viewport still in use. The tests assert 320, 390 and 760. Below 320 the app renders as best it can and promises nothing — a "your screen is too small" screen would be another thing to translate and maintain for a case that barely happens. |
| 3 | What gives way in the header? | At 320px the header has **280px** of usable width and currently wants **614**. The menu control, the truncating agent name, the status dot and the two controls as icons come to ~273 with gaps, which fits. So: **Voice and Traces become icon-only**, keeping their accessible names through `aria-label` (AC4 — relocated or re-rendered, never deleted); the "Microsoft Foundry" pill is dropped at this width, where it had already collapsed to a meaningless single letter; and **the harness badge moves into the rail overlay's footer**, beside the model and the gateway line, which is the same family of fact — *what this build is made of*. Spec 004's AC9 therefore still holds at every width, one tap away instead of on screen. |
| 4 | Does `/compare` render at this width? | **Yes, unchanged.** Measured: its head and picker already fit at 390 (the 594px overflow came from the shared header), and the columns already stack below 1100. Stacked, one question still reaches both agents at the same moment and both sets of figures survive — it degrades the *view*, not the measurement, so nothing is special-cased. |
| 5 | Does the a11y walk parameterise over widths? | **Neither, in the end — and the decision was wrong as stated.** jsdom applies no stylesheet, so a "320px" case in `a11y.test.tsx` would render exactly what the 1440px case renders: a width parameter there asserts nothing. What the walk gained instead is the *state* the breakpoint switches on — the app with the navigation open over the conversation — which is where this spec's new controls live. The widths themselves are measured in a browser and recorded below (AC8). Corrected during implementation rather than quietly implemented as agreed. |

## The sweep, measured (AC8)

Walked in a real browser on **2026-09-20**, at each named width, on the chat with the navigation
both closed and open.

| | 320px | 390px | 760px |
|---|---|---|---|
| `documentElement.scrollWidth` | **320** | **390** | **760** |
| sideways scroll | none | none | none |
| visible controls, all named | 52 | 52 | 52 |
| the menu control | present | present | present |

Before, at 390px: `scrollWidth` **594** against a 390px viewport, **204px** of sideways scroll, the
rail `display: none`, **six** controls visible and **two of those off the right edge**, and exactly
**one** of the seven screens reachable.

Two things the browser found that no test had:

- **The base rule for the menu control was declared after the breakpoint that shows it**, so the
  control was invisible at every width. A media query adds no specificity, and this is the *third*
  time the same trap bit while writing specs 020, 046 and 047 — so it is now a test of its own:
  every selector a breakpoint overrides must already have been declared above it. Verified by
  moving the rule back and watching it fail.
- **The rail's two footer links ran together** — "What this build is**Preferences**" — because as
  an overlay the rail is 300px rather than 248px and they stopped wrapping. Caused by this change,
  fixed here.

## Out of scope / deferred

- Touch affordances, gestures, and anything that only makes sense with a finger.
- Voice on a phone.
- Print styles.
- Any change to what a screen shows once you are on it.
