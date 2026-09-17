# Plan: The composer, and stopping a turn

> The HOW. Written after `spec.md` is `clarified`.

## Approach

Two changes that share a surface and nothing else, so they are built as two.

**Stopping** is an `AbortController` per send, held in a ref on `useAgentStream`, plus a `stop()` on
the hook's interface. Three details carry the weight:

1. **A stop is not an error.** `send`'s `catch` today synthesises an `error` event for any failure,
   to keep the rule that every turn ends in `done` or `error`. An abort must be told apart from a
   dead BFF — by a per-send `aborted` flag rather than by sniffing the exception, because
   `AbortError` is not the only way an aborted fetch can surface.
2. **AC5 needs a guard inside the read loop, not only the abort.** Frames already decoded in the
   current chunk would otherwise still be applied. The loop checks the flag before applying each
   event and breaks.
3. **`Turn` gains a fourth status.** `TurnStatus` becomes `'streaming' | 'done' | 'error' |
   'stopped'`, and a pure `stopTurn(turn)` in `state/turn.ts` performs the transition — only from
   `streaming`, so a late abort cannot un-finish a turn that already completed.

The fourth status is why this touches more files than it looks like it should. Several places ask
`status === 'streaming'` or `!== 'streaming'`, and each is really asking one of two different
questions. `turnStatus()` already answers correctly for `stopped` (anything not streaming is
`settled`). `Conversation` and `ActivityPanel` are asking "is it still running", and `'stopped'`
answers no — which is what we want everywhere except one place: `useSpokenAnswers`, which speaks a
settled answer aloud. **A stopped turn is not spoken.** The reader stopped it; reading it out is the
opposite of what they asked for. That is an explicit decision here, not an oversight, and it gets a
test.

**The composer** becomes a `<textarea>` that grows. The growth is the field's `scrollHeight` written
back to its own height on every change, capped in CSS. `Enter` submits, `Shift+Enter` does not —
handled on `keydown`, and IME composition is respected (`event.isComposing`), or the field becomes
unusable for anyone typing with an input method.

**The ceiling** (spec's deferred detail): `max-height: 40vh`, which on a laptop is roughly eight
lines and on a short window is never more than the column. A fixed line count would take half the
screen on a 13-inch display and look arbitrary on a 27-inch one. Past the cap the field scrolls
itself.

**Rejected:** a `contenteditable` composer (no reason to, and it brings paste sanitising with it);
a `stop` that also tries to cancel the Foundry run (no documented path — §10, and the spec's
non-goal); reusing the send button with a swapped handler but the same label (AC4 wants two
distinguishable controls, and a screen reader must not be told "send" when the control stops).

## Affected files

- `frontend/src/state/turn.ts` — `TurnStatus` gains `'stopped'`; new pure `stopTurn(turn)`; new
  `isSettled(turn)` so consumers stop spelling out `status !== 'streaming'` in four places (§4).
- `frontend/src/hooks/useAgentStream.ts` — `AbortController` ref, `aborted` flag, `stop()` on the
  interface, abort-versus-failure branch in `catch`, guard in the read loop.
- `frontend/src/panes/Composer.tsx` — `<textarea>`, auto-grow, `Enter`/`Shift+Enter`, send ↔ stop.
- `frontend/src/panes/Conversation.tsx` — the stopped line; `isSettled` in place of the two
  `status`-vs-`'streaming'` comparisons.
- `frontend/src/panes/ActivityPanel.tsx` — `isSettled`.
- `frontend/src/hooks/useSpokenAnswers.ts` — a stopped turn is not spoken.
- `frontend/src/components/Icon.tsx` — `StopIcon` (a square; SVG, no glyph — the brand test).
- `frontend/src/App.tsx` — passes `stop` and `streaming` to `Composer`.
- `frontend/src/i18n/strings.ts` — the four new strings below.
- `frontend/src/styles/app.css` — textarea growth and cap, the stopped line, the stop button.
- `docs/how-it-works/streaming-events.md` — what an abort does and does not do.

## Contract / data model changes (constitution §4)

**No contract change.** The `AgentEvent` set is untouched (§9); `POST /chat`'s request body is
untouched; no new endpoint. Stopping is a client abort of an HTTP response and is invisible to the
BFF beyond a dropped connection.

`TurnStatus` is internal frontend state, and `state/turn.ts` stays its single source of truth — the
new `isSettled` exists so that the question "has this turn finished" has one answer rather than four
inline comparisons.

Spec 021's stored record carries `messages`, so a stopped turn is stored with `status: 'stopped'`
and reopens as stopped. No storage migration: the field already exists and only its value set grows.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `composer.stop` | Stop | Parar |
| `turn.stopped` | Interrupted here. The run may still be finishing in Foundry. | Interrompido aqui. O run pode continuar no Foundry. |
| `turn.stoppedShort` | interrupted | interrompido |
| `composer.newline` | Shift + Enter for a new line | Shift + Enter para nova linha |

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | Shift+Enter inserts a newline and does not submit; Enter submits | `panes/Composer.test.tsx` (new) |
| AC2 | height grows with lines and stops at the cap | `panes/Composer.test.tsx` |
| AC3 | field empties and returns to one line after submit | `panes/Composer.test.tsx` |
| AC4 | stop control present while streaming with its own accessible name; send when not | `panes/Composer.test.tsx` |
| AC5 | events delivered after `stop()` are not applied | `hooks/useAgentStream.test.tsx` |
| AC6 | a stopped turn keeps the text, tool rows and reasoning already received | `state/turn.test.ts` + `hooks/useAgentStream.test.tsx` |
| AC7 | stopped renders distinctly from done and from error, with the line | `panes/Conversation.test.tsx` |
| AC8 | composer re-enabled; next send carries the same `conversation_id` | `hooks/useAgentStream.test.tsx` |
| AC9 | Escape in the composer neither stops nor clears | `panes/Composer.test.tsx` |
| AC10 | a stopped turn offers trace, and copy/download when it has text | `components/AnswerActions.test.tsx` |
| AC11 | en + pt for every new key; stop control is an SVG | `i18n/strings.test.ts`, `brand.test.ts` (existing, extended) |
| — (plan decision) | a stopped turn is not spoken | `hooks/useSpokenAnswers.test.tsx` |
| — (plan decision) | `stopTurn` on a `done` turn is a no-op | `state/turn.test.ts` |

## Risks / trade-offs

- **The run keeps going.** We stop listening; Foundry does not stop. The line says so (AC7) and the
  spec's non-goal records why we do not claim more (§5).
- **`scrollHeight` auto-grow in jsdom** reports 0, so AC2 cannot be asserted through real layout.
  The test asserts the mechanism — that the element's height is written from `scrollHeight` and that
  the cap is a stylesheet rule — rather than a rendered pixel height. Honest, and stated here so
  nobody later reads the test as proof of a visual result it cannot give.
- **IME composition**: submitting on `Enter` during composition would break typing in any language
  using an input method. Guarded, and worth a test.
- **Four call sites move to `isSettled`.** A behaviour-preserving refactor rides along with a
  behaviour change, which the working-style guidance warns about. It is in scope because leaving
  them would mean four places deciding independently what `'stopped'` means — the §4 failure this
  change exists to avoid.
