# Tasks: Choosing the voice on the screen

- [x] **T1 — test**: what a deployment offers, and the default first (AC1, AC2).
- [x] **T2 — implement**: `voicelive_voices`, `offered_voices`, `session_config_for`.
- [x] **T3 — test**: the BFF refuses an unoffered voice; no instructions; VAD unchanged (AC6–AC8).
- [x] **T4 — implement**: the optional `voice` on `POST /voice/session` and `/config`.
- [x] **T5 — test**: the chooser preselects, falls back when the stored voice is gone, and says it
      is local (AC4, AC9).
- [x] **T6 — implement**: `VoicePicker`, threaded to `startVoice` and stored in preferences.
- [x] **T7 — i18n/styles**, **T8 — docs/sync**, **T9 — spec** flip to `done`.

## Definition of done

- [x] Every acceptance criterion maps to a passing test, or is deferred with its reason recorded
- [x] Lint clean · Tests green · `verify-gates` green
