# Spec: A focus ring by default, not by remembering

| | |
|---|---|
| **ID** | 048-focus-by-default |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-20 |
| **Clarified** | 2026-09-20 |

## Problem / motivation

Spec 040 gave the app a focus ring and wrote down why: the user-agent ring is "all but invisible"
against several of this app's backgrounds, so one rule states it once. The rule is an **allowlist**,
and its own comment describes the trap it was about to fall into — a control added later inherits a
ring "by belonging to the list rather than by remembering to style it".

Belonging to the list *is* remembering. Counted today: **62** control classes are rendered by the
components; **27** are in the list; **34** are not. Several were added by specs written this week,
including two of my own — `.header__menu` (047) and `.compare__select` (020). The list is the same
shape of drift spec 046 found on `--fg-4`, where an exemption written for five selectors had
accumulated sixty-four.

**This is a quality gap, not a conformance failure, and the difference is worth stating plainly.**
Measured in the dark theme:

| | ring | against its surface |
|---|---|---|
| `.sidebar__about` — not in the list | browser default, `auto 1px #005FCC` | **3.51:1** |
| `.sidebar__nav-item` — in the list | `solid 2px #338FFF` | **6.51:1** |

3.51:1 clears WCAG 1.4.11's 3:1, so a control outside the list is *indicated*, not unindicated. What
it gets is a 1px dark-blue ring on a near-black rail where its neighbour gets 2px of light blue —
which is precisely the "all but invisible" case spec 040 wrote the rule for, reappearing in the
controls the rule forgot.

Two earlier suspicions did **not** survive measurement and are recorded so nobody re-raises them:
five text inputs set `outline: none`, but four of them sit in wrappers carrying `:focus-within` —
the correct pattern for a composed field. Only `.palette__field` has no indicator, and it is focused
automatically when the palette opens, so the focus location is not in doubt.

## Goals

- **A control cannot ship without a focus indicator**, because there is no list to be left off.
- **The indicator suits the surface it is drawn on**, without a second list to keep in step.
- **What legitimately has no ring says so by name**, with the reason written where the exception is.
- No control loses an indicator it has today.

## Non-goals

- **No new visual language.** Same ring, same width, same offset, same two colours. This changes
  *which* elements get the existing treatment, not what the treatment is.
- **Not the rest of WCAG 1.4.11.** Borders, the chart's series fills and other non-text contrast stay
  where spec 046 left them: out of scope, unmeasured, and said to be.
- **No change to focus order, focus trapping, or what takes focus when** — spec 040 and
  `useModalFocus` own that, and nothing here touches it.
- No change to the `AgentEvent` set (§9), no contract change, no new string.

## User-facing behavior

Nothing gains or loses a control, and no prose is added — **no new strings**, which §7 therefore has
nothing to carry.

**Every element that can take keyboard focus draws the ring**, so tabbing through the app is
uniform: the same 2px, the same offset, the same colour for the surface it is on. Thirty-four
controls that were getting the browser's thinner, darker default now match the twenty-seven that
were not.

**Two things keep no ring, and say why.** The call reader's and the voice overlay's scrims take
focus when they open so the modal can trap it; they are focus targets of last resort rather than
controls, which is the reason already written beside them. The main column is the skip link's
destination and would otherwise draw a ring around the whole conversation.

## Acceptance criteria

1. **AC1** — Every interactive control the app renders draws the app's focus indicator, asserted
   without a list of selectors to maintain.
2. **AC2** — An element that draws no ring is named in one place, with its reason, and only the
   documented exceptions appear there.
3. **AC3** — The indicator's colour suits its surface — the deep surfaces get the lighter step —
   decided by where the element is, not by which selector it has.
4. **AC4** — No control that has an indicator today loses one.
5. **AC5** — The ring meets 3:1 against the surface it is drawn on, in both themes, computed.
6. **AC6** — The existing suites pass unchanged, including spec 040's walk.
7. **AC7** — The rendered page is tabbed through in a browser, both themes, and the result recorded
   with its date (§5).

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **The focus rule** | `app.css` is its single source. The two allowlists collapse into one default plus a surface rule plus a named exception list; nothing else in the app may state a focus outline. |
| **i18n (§7)** | Nothing. No new user-facing string. |
| **Docs** | `docs/design-system.md` — the focus rule, beside the breakpoints and the palette notes. |

## Clarified decisions

Taken 2026-09-20 with the user. The colour question and the exception list were settled by reading
the stylesheet rather than by asking.

| # | Question | Decision |
|---|---|---|
| 1 | What gets a ring by default? | **Everything that can take focus**, with exceptions by name. The alternative — listing the interactive element *types* — is the same allowlist in a new costume: a `[tabindex="0"]` or an unlisted `role` is born without a ring and the drift restarts, more slowly. |
| 2 | How does the colour follow the surface? | **By ancestor, not by selector.** Today a second list of sixteen selectors names the controls that sit on ink. Those controls are exactly the descendants of the rail and the trace panel, so one rule per deep surface replaces the list and a new control inside either inherits the right colour by being there. |
| 3 | What legitimately has no ring? | The two scrims — `useModalFocus` focuses them on open so the modal can trap focus, and the reason is already written beside them — and **`.main`**, which is the skip link's target and would otherwise ring the entire conversation column. Both are named in one place, which is what AC2 asserts. |
| 4 | Is `.palette__field` a defect? | **No.** It sets `outline: none` and has no wrapper ring, but it is focused automatically when the palette opens: the field *is* where focus went, and nothing else in the dialog is focusable until you move. Left as it is, recorded here so the measurement is not repeated. |
| 5 | Do the four `:focus-within` wrappers change? | **No.** A composed field indicating focus on its wrapper is the correct pattern, and they already meet the bar. The default rule must not double them up. |

## The sweep, measured (AC7)

**2026-09-20**, dark theme, tabbing with a real keyboard rather than focusing elements from script —
which matters, because `:focus-visible` does not match a button focused programmatically, and two
earlier passes reported controls as unindicated for that reason alone.

| stops walked | ring present | below 3:1 |
|---|---|---|
| 6 (the rail region) | **6 of 6**, 2px | **0** |

Every stop reported `:focus-visible` true and a 2px ring at **5.67:1** — the lighter step, which is
what the rail redeclares `--fg-focus` to. The header and composer controls were checked per element
with the offset correction below; the token maths for both themes is asserted in
`contrast.test.ts` rather than walked.

**One correction worth recording, because it nearly became a reported defect.** The first
measurement compared the ring with the control's **own fill** and reported `.skip-link` at 1.39:1
and `.sidebar__new` at 1.83:1 — a blue ring on a blue button. That is the wrong surface: with
`outline-offset: 2px` the ring is painted *outside* the control, on whatever is behind it, where
the same two measure **4.17:1** and **5.67:1**. A focus indicator has to be measured against what
it is actually drawn on.

**What the sweep did not cover**: every screen, and the light theme's rendered page. The token pairs
cover both themes computationally; a full per-screen walk is the same trade spec 040 made, and is
not claimed here.

## Out of scope / deferred

- Non-text contrast beyond the focus ring (WCAG 1.4.11) — still where spec 046 left it.
- Focus order and focus trapping.
- `prefers-contrast` and forced-colours modes.
