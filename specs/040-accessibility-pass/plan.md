# Plan: The keyboard and screen-reader pass

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

A pass, not a feature. Six concrete changes and two tests that stop them decaying.

1. **A skip link** as the first focusable element in `App`, moving focus to the conversation.
2. **`document.documentElement.lang`** follows the interface language, set where the language is
   owned rather than in a component that happens to render early.
3. **A completion announcement.** One polite live region in `App`, holding a short sentence when a
   turn settles. Deliberately not the answer: the streaming text must never be announced token by
   token, which is what putting `aria-live` on the answer would do.
4. **Focus into the trace panel** when it is opened by a control, and back to the opener on close.
5. **Decorative graphics** get `aria-hidden`, with their information already present as text.
6. **Names on the icon-only controls** that lack them.

**Two tests carry the spec's value:**

- `a11y.test.tsx` renders the app and asserts every interactive control has a non-empty accessible
  name. This is AC8, and it is what makes the pass not decay.
- `contrast.test.ts` computes the semantic text-on-surface pairs against **both** palettes. Real
  arithmetic on the tokens, so it is a measurement (§5) — and it is not a conformance claim.

## Affected files

- `frontend/src/App.tsx` — skip link, `lang`, the live region, focus on trace open.
- `frontend/src/a11y.test.tsx` (new) — the naming guard.
- `frontend/src/styles/contrast.test.ts` (new) — the measurement.
- Components missing a name or an `aria-hidden`, as the guard finds them.
- `frontend/src/i18n/strings.ts`, `frontend/src/styles/app.css`.
- `docs/design-system.md` — the focus and live-region behaviours.

## i18n (§7)

`a11y.skipToConversation` · `a11y.answerReady` · `a11y.announcements`.

## Test strategy (§2 — TDD)

| AC | Test |
|---|---|
| AC1 | the first focusable element is the skip link, and it targets the conversation |
| AC2 | every interactive control is reachable; no positive `tabindex` anywhere |
| AC3 | opening the trace panel moves focus into it; closing restores the opener |
| AC4 | the payload reader traps focus (existing `useModalFocus`, asserted where it is used) |
| AC5 | a settled turn announces; a streaming answer is not in a live region |
| AC6 | an error renders in a live region |
| AC7 | `lang` matches the interface language and follows a change |
| AC8 | every interactive control in the rendered app has a name |
| AC9 | decorative graphics are `aria-hidden`, and their value exists as text |
| AC11 | contrast, computed, in both themes |
