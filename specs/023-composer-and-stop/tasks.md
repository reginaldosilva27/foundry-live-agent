# Tasks: The composer, and stopping a turn

> Red → green → refactor. Each implementation task is preceded by the test that fails first.

## Stopping a turn

- [x] **T1 — test**: `stopTurn` moves a `streaming` turn to `stopped` and keeps its text, activities
      and reasoning; it is a no-op on a `done` or `error` turn (AC6)
- [x] **T2 — implement**: `TurnStatus` gains `'stopped'`; `stopTurn` and `isSettled` in `state/turn.ts`
- [x] **T3 — test**: events delivered after `stop()` are not applied to the turn (AC5)
- [x] **T4 — implement**: `AbortController` + `aborted` flag + loop guard + `stop()` in `useAgentStream`
- [x] **T5 — test**: an abort produces a `stopped` turn, not an `error` turn (AC7 at the state level)
- [x] **T6 — implement**: branch the `catch` on the abort flag rather than on the exception type
- [x] **T7 — test**: after a stop the next send carries the same `conversation_id` (AC8)
- [x] **T8 — refactor**: move the four `status !== 'streaming'` comparisons to `isSettled`

## The composer

- [x] **T9 — test**: Shift+Enter inserts a newline and does not submit; Enter submits (AC1)
- [x] **T10 — implement**: `<textarea>` with the keydown handling, IME composition respected
- [x] **T11 — test**: the field empties and returns to one line after a submit (AC3)
- [x] **T12 — implement**: auto-grow writing `scrollHeight` back, reset on submit
- [x] **T13 — test**: while streaming the control is stop with its own accessible name; otherwise
      send (AC4)
- [x] **T14 — implement**: the send ↔ stop swap, `StopIcon`
- [x] **T15 — test**: Escape in the composer neither stops the turn nor clears the field (AC9)
- [x] **T16 — implement**: whatever T15 shows is needed (expected: nothing — the assertion is the point)

## Rendering a stopped turn

- [x] **T17 — test**: a stopped turn renders distinctly from done and from error, and carries the
      line about the run (AC7)
- [x] **T18 — implement**: the stopped line in `Conversation`
- [x] **T19 — test**: a stopped turn offers the trace, and copy/download when it has text (AC10)
- [x] **T20 — implement**: whatever T19 shows is needed
- [x] **T21 — test**: a stopped turn is not spoken aloud (plan decision)
- [x] **T22 — implement**: `useSpokenAnswers` treats `stopped` as not-to-speak

## Cross-cutting

- [x] **T23 — i18n**: the four strings in `en` + `pt` (AC11)
- [x] **T24 — styles**: textarea growth and cap (`max-height: 40vh`), the stopped line, the stop button
- [x] **T25 — docs**: `docs/how-it-works/streaming-events.md` — what an abort does and does not do
- [x] **T26 — cap the height in CSS, assert the cap exists** (AC2, with the jsdom limit stated in the plan)

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean · tests green · build passes
- [x] Docs updated in the same change (§4)
- [x] All new user-facing text exists in `en` **and** `pt` (§7)
- [x] `spec.md` status updated to `done`
