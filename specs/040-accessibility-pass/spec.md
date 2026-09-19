# Spec: The keyboard and screen-reader pass

| | |
|---|---|
| **ID** | 040-accessibility-pass |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |
| **Clarified** | 2026-09-19 |

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

**How the naming rule is asserted without becoming brittle.** Not a checklist in a doc, and not a
per-component test that has to be remembered. The app is **rendered**, every interactive element is
collected, and each is required to have a non-empty accessible name — `aria-label`, `title`, or its
own text. It fails only when a control genuinely has none, which is the only thing it is meant to
catch, and it catches a control added three specs from now.

**The trace panel takes focus**, because a reader asked for it. That is the distinction: a surface
the reader opened should receive focus, and one that appeared as a side effect should not steal it.
Closing returns focus to the control that opened it.

**The announcement says the answer is ready, and nothing more.** Not the turn's shape — "three
tools, twelve seconds" is on screen already, and reading it into the queue makes the one moment
that needed a word into a paragraph. The streaming text itself is never announced token by token.

**Contrast is measured, in both palettes.** Spec 036 shipped the second one first, which is the
order that makes this possible: the semantic text-on-surface pairs are computed against both
themes' surfaces in a test, so this is a measurement rather than a claim (§5). It is still not a
conformance statement — it is these pairs, at this ratio, asserted.

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
11. **AC11** — The semantic text-on-surface pairs meet 4.5:1 in **both** themes, computed in a test
    rather than asserted in prose.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **Test surface** | The value of this spec is that it does not decay. AC8 in particular must be an assertion over the rendered app, so a control added later without a name fails CI — a checklist in a doc would be the §4 failure of the same fact in two places. |
| **Docs** | `docs/design-system.md` — the focus and live-region behaviours join the layout contract. |

## Out of scope / deferred

- A formal conformance audit or a published accessibility statement.
- Voice-over-specific behaviour tuning beyond the listed criteria.
- Any redesign.
