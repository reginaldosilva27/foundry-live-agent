# Plan: The voice session is configured

> The HOW. Written after `spec.md` reached `clarified` on 2026-09-15.

## Approach

**One pure builder, one call site.** `voice_session_config(...)` in
`ai/harness/_shared/voice_events.py` — where every other Voice Live frame shape already lives —
turns settings into the `session` object. `VoiceSession.negotiate` attaches it to the
`rtc.call.sdp.create` frame it already sends. Being pure, every acceptance criterion is a unit test
over a dict; the replay tests then prove the negotiation still works end to end.

**Omission is a feature.** Each field is included only when configured, and a blank configuration
produces `{}` — in which case the frame goes out exactly as it does today (AC6). That is what lets
an operator opt out, and it keeps the recorded fixtures meaningful: nothing about the existing
replay changes unless configuration asks for it.

**`instructions` is never sent**, and a test asserts its absence rather than trusting the author —
the doc says it is unsupported with a custom agent, and it is the one field whose accidental
inclusion would silently replace the agent this project is about.

## Affected files

- `ai/harness/_shared/voice_events.py` — `voice_session_config`.
- `ai/tests/test_voice_events.py` — AC1-AC6 as pure cases.
- `backend/app/settings.py` — `voicelive_voice`, `voicelive_vad`, `voicelive_input_language`, and a
  `voice_session` property that builds the dict once.
- `backend/app/voice_session.py` — `VoiceSession(..., session_config=...)`; the frame carries it.
- `backend/app/routers/voice.py` — passes the settings through.
- `backend/tests/test_voice.py` — the negotiated frame, and the replay unchanged (AC7).
- `.env.example`, `README.md`, `README.pt-BR.md`, `docs/REFERENCES.md`,
  `docs/how-it-works/voice-live-lifecycle.md`, `CHANGELOG.md`, `specs/README.md`,
  `specs/006-voice-mode/spec.md` (the superseded non-goal).

## Contract / data model changes (constitution §4)

None to `AgentEvent`. New configuration whose source of truth is `backend/app/settings.py`.

## References read for this plan (constitution §10)

| What | URL | Taken from it |
|---|---|---|
| Voice Live with WebRTC | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc | The session object is carried **inside** `rtc.call.sdp.create` alongside `sdp_offer` — sample shows `session: { modalities, instructions, voice, turn_detection }`. After negotiation the control channel stays open for `session.update`. Read 2026-09-15. |
| How to use Voice Live | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to | `voice` = `{ name, type: azure-standard \| azure-custom, temperature?, rate? }`; `turn_detection.type` `azure_semantic_vad` / `azure_semantic_vad_multilingual` with `remove_filler_words` and `interrupt_response` (barge-in, default true) — **`interrupt_response` only exists on those types**; `input_audio_noise_reduction: { type: azure_deep_noise_suppression }`; `input_audio_transcription: { model: azure-speech, language }`; **`instructions` is not supported with a custom agent**; HD voices are limited to a region list that includes `eastus`. Read 2026-09-15. |

## i18n strings (constitution §7)

None — nothing user-facing is added.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 — the voice, typed `azure-standard` | `voice_session_config(voice=…)` | `ai/tests/test_voice_events.py` |
| AC2 — semantic turn detection | the default config | `ai/tests/test_voice_events.py` |
| AC3 — noise suppression | the default config | `ai/tests/test_voice_events.py` |
| AC4 — language present / absent | with and without | `ai/tests/test_voice_events.py` |
| AC5 — never `instructions` | assert the key is absent | `ai/tests/test_voice_events.py` |
| AC6 — blank config opts out | `{}`, and the frame unchanged | `ai/tests/test_voice_events.py`, `backend/tests/test_voice.py` |
| AC7 — the replay still works | the existing recorded-frame tests, unedited | `backend/tests/test_voice.py` |

## Risks / trade-offs

- **Not verified against the live service.** The shapes come from the docs above; the recorded
  fixtures predate this change, so the replay proves our end, not Foundry's acceptance. Until a
  real session runs, `docs/REFERENCES.md` says exactly that (§5).
- A wrong voice name is rejected by the service at negotiation, surfacing as the `502` the router
  already returns for `rtc.call.error`. That is the right failure: loud, at connect.
