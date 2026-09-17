# Spec: The keyboard and screen-reader pass

| | |
|---|---|
| **ID** | 040-accessibility-pass |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

The foundations are good and were built deliberately: `:focus-visible` on every interactive control
and never `:focus`, so a mouse press draws no ring; `aria-live` on the line that says what the agent
is doing; a focus trap for modals; `aria-current` on the rail's navigation; accessible names kept on
controls whose labels leave the layout when the rail collapses; `prefers-reduced-motion` honoured in
three places.

What is missing is everything that only appears when the app is operated end to end without a mouse.
A streaming answer announces its status line but never announces that it finished. Focus order
across three columns has never been walked. The trace panel opens and it is not established where
focus goes or what a screen reader is told. There is no skip link past the rail, which is the first
thing between the keyboard and the composer on every load. And the app is bilingual while the
document's language is set once.

This is a pass, not a feature: a walk through the app with the pointer unplugged, fixing what that
finds.

## Goals

- **The app is fully operable from the keyboard**, in a focus order that matches the reading order.
- **A screen reader is told what changed**, particularly when a turn finishes.
- The **language the page declares matches the language it is showing**.
- The result is **checked by tests**, not by a one-time audit that decays.

## Non-goals

- **No redesign.** Contrast and focus treatments may change; layout and visual identity do not.
- **No new features.** Every fix serves something the app already does.
- **No claim of formal conformance.** This spec improves specific, listed behaviours; it does not
  assert a WCAG level, which would be a claim we have not measured (§5).
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**A skip link** is the first focusable element, moving focus past the rail to the conversation.

**Focus order** runs rail → main column → trace panel, matching the visual order, at every width.

**Opening the trace panel** moves focus into it and names it; closing returns focus to the control
that opened it. The same for the payload reader and any other overlay (the existing modal-focus hook,
applied everywhere).

**A finishing turn is announced.** Today the live line says what is happening and then falls silent
when the answer arrives — which for a sighted reader is correct, because the answer is visible, and
for a screen-reader user is the moment the app goes quiet with no explanation. A polite announcement
says the answer is ready, without reading the whole answer into the queue as it streams.

**Errors are announced** as they appear.

**The document's language attribute follows the interface language**, changing when the reader
switches, so a screen reader pronounces the interface correctly.

**Every control has a name that says what it does**, including the icon-only ones — the star, the
copy, the download, the mic, the send and stop, the collapse.

**The activity rows, the tool bars and the trace numbers** are readable in a linear reading order: a
duration bar is decorative and the number beside it is the information.

## Acceptance criteria

1. **AC1** — A skip link is the first focusable element and moves focus to the conversation.
2. **AC2** — Tabbing through the app reaches every interactive control, in rail → main → panel order,
   with no keyboard trap outside a modal.
3. **AC3** — Opening the trace panel moves focus into it; closing returns focus to the opener.
4. **AC4** — The payload reader traps focus while open and returns it on close.
5. **AC5** — A turn finishing produces a polite announcement; the streaming answer text itself is not
   announced token by token.
6. **AC6** — An error renders into a live region and is announced.
7. **AC7** — The document's `lang` matches the interface language and updates when it changes.
8. **AC8** — Every interactive control has a non-empty accessible name (asserted across the rendered
   app, not per component).
9. **AC9** — Decorative graphics — duration bars, the avatar, the pending dots — are hidden from
   assistive technology, and their information is available as text.
10. **AC10** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **Test surface** | The value of this spec is that it does not decay. AC8 in particular must be an assertion over the rendered app, so a control added later without a name fails CI — a checklist in a doc would be the §4 failure of the same fact in two places. |
| **Docs** | `docs/design-system.md` — the focus and live-region behaviours join the layout contract. |

## Open questions (clarify before planning)

- [ ] How is AC8 asserted without becoming a test that fails on every legitimate change?
- [ ] Does the trace panel take focus on open, or only announce itself? Taking focus is right for a
      panel the reader asked for and wrong for one that opened as a side effect.
- [ ] What exactly does the completion announcement say — "answer ready", or something carrying the
      turn's shape (three tools, twelve seconds)?
- [ ] Is contrast measured as part of this pass, and against which palette, given spec 036 adds a
      second one? These two specs are coupled and the order matters.

## Out of scope / deferred

- A formal conformance audit or a published accessibility statement.
- Voice-over-specific behaviour tuning beyond the listed criteria.
- Any redesign.
