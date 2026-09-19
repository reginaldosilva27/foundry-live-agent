# Plan: What the voice session is doing, while it does it

> The HOW, written after `spec.md` reached `clarified` (2026-09-19). The clarify step shrank this
> spec considerably by reading the code: the channel already delivers everything, and specs 012 and
> 015 already render most of it.

## Approach

Three small additions to `VoiceOverlay`, and one deferral.

1. **Elapsed while running.** The chat's live line already ticks (spec 015); the overlay's rows do
   not. `useElapsed` is the existing hook, so the voice activity area uses it for the call that is
   running. When it finishes `ToolRow` keeps showing the duration it already shows.
2. **The reasoning summary**, when the session produced one, through the same `ReasoningCard` the
   chat uses (§4). Absent renders nothing — not an empty card.
3. **Guards**, because AC7 and AC9 are claims that decay: the overlay issues no request, and
   nothing it holds is written to storage.

**Deferred:** interruption. Not for want of an opinion — for want of a measurement.

## Affected files

- `frontend/src/panes/VoiceOverlay.tsx` — elapsed, reasoning.
- `frontend/src/panes/VoiceOverlay.test.tsx` — the new cases and the two guards.
- `frontend/src/i18n/strings.ts`, `frontend/src/styles/app.css`.
- `docs/REFERENCES.md` — the interruption open item.
- `docs/how-it-works/voice-live-lifecycle.md` — what the screen shows during a session.

Not touched: `backend/`, `ai/`, `contract.py`.

## Test strategy (§2 — TDD)

| AC | Test |
|---|---|
| AC1/AC2 | transcript lines render for both speakers, newest last in the log and newest first on screen |
| AC3/AC11 | a running call shows advancing elapsed; a finished one shows its duration |
| AC4 | a failed call renders as failed, distinct from one that returned |
| AC6 | the rows are `ToolRow`, the same component the chat uses |
| AC7 | no control in the overlay issues a request |
| AC9 | nothing the overlay holds reaches storage |
| AC12 | reasoning renders when present, and nothing when absent |
| AC8 | spec 007's replay tests, unchanged and still passing |
