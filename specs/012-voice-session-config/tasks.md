# Tasks: The voice session is configured

> Red → green → refactor.

## Tasks

- [x] **T1 — test**: `voice_session_config` builds voice, turn detection, noise suppression and the
      optional language; omits what is blank; never emits `instructions`; returns `{}` when nothing
      is configured (AC1-AC6).
- [x] **T2 — implement**: `voice_session_config` in `ai/harness/_shared/voice_events.py`.
- [x] **T3 — test**: the negotiated `rtc.call.sdp.create` frame carries the session object, and
      carries nothing extra when the configuration is blank; the recorded replay still works (AC6, AC7).
- [x] **T4 — implement**: settings, `VoiceSession`, and the router wiring.
- [x] **T5 — docs**: `.env.example`, both READMEs, `docs/REFERENCES.md`,
      `docs/how-it-works/voice-live-lifecycle.md`, `CHANGELOG.md`, `specs/README.md`, and the
      superseded non-goal in spec 006.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] `spec.md` status updated to `done`
