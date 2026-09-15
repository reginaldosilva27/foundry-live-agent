# Tasks: The voice conversation lands in the chat

> Red → green → refactor. Boxes checked as they land.

## Tasks

- [x] **T1 — test**: `voiceMessages` over a two-exchange log returns four messages in order (AC1),
      attributes a tool to the answer that followed it (AC2), returns `[]` for an empty log (AC4),
      and opens the block with a session divider carrying the duration (AC5).
- [x] **T2 — implement**: `frontend/src/state/voiceLog.ts`.
- [x] **T3 — implement**: `useVoiceSession` keeps the ordered log and derives `transcript`/`turn`
      from it; `stop()` returns `{ log, seconds }`. The existing voice tests must stay green
      unedited — that is the proof the overlay did not change.
- [x] **T4 — test**: ending a session puts the conversation in the chat, and a message typed after
      it lands below (AC3, AC5 rendered).
- [x] **T5 — implement**: `append` on `useAgentStream`, the wiring in `App`, the divider in
      `Conversation`.
- [x] **T6 — test**: `layout.test.ts` asserts the transcript scrolls within the card (AC6).
- [x] **T7 — implement**: the CSS rule.
- [x] **T8 — i18n**: none needed after all — the divider reuses `voice.title` and a language-independent `mm:ss` clock, which `formatClock` now owns for both surfaces (§4).
- [x] **T9 — docs**: `docs/how-it-works/voice-live-lifecycle.md`, `CHANGELOG.md`, `specs/README.md`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] All new user-facing text exists in en **and** pt
- [x] `spec.md` status updated to `done`
