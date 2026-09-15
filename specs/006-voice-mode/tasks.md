# Tasks: Voice mode

> Red → green → refactor. Each implement task is preceded by the test that must fail first.
> The spike came first and is already done — nothing below was designed from documentation alone.

## Pass 0 — observation (done before planning)

- [x] **T0** — `ai/scripts/spike_voice.py`: answered **O-2** (WebRTC agent mode: yes), **O-6** (two
      different api-versions, one per endpoint), **O-5** (eastus2 serves it), the real attachment
      parameter names, and that function calls reach the control channel. Findings in
      `docs/REFERENCES.md`; two fixtures committed

## Pass 1 — the mapping (`ai/`)

- [x] **T1 — RED**: `ai/tests/test_voice_events.py` — replays both recorded fixtures (AC2, AC9)
- [x] **T2 — GREEN**: `ai/harness/_shared/voice_events.py` — `attachment_query()` +
      `normalise_voice()`

## Pass 2 — the control channel (`backend/`)

- [x] **T3 — RED**: `backend/tests/test_voice.py` — SDP exchange, no credential in the response (AC1)
- [x] **T4 — GREEN**: `backend/app/voice_session.py` + `routers/voice.py` + settings + `websockets`
- [x] **T5 — RED**: the function-call round trip and its events (AC3, AC4, AC5)
- [x] **T6 — GREEN**: the receive loop, executing through the **existing** `tool_executor`
- [x] **T7 — RED/GREEN**: lifecycle — `DELETE` closes, shutdown closes, the cap holds (AC6)
- [x] **T8 — RED/GREEN**: §8 — the voice module names no tool (AC11), extending the existing test

## Pass 3 — the browser (`frontend/`)

- [x] **T9 — RED**: `src/voice/session.test.ts` — negotiate, mute, and the three failures (AC7, AC8)
- [x] **T10 — GREEN**: `src/voice/session.ts` + `src/hooks/useVoiceSession.ts`
- [x] **T11 — GREEN**: `VoiceOverlay`, the header and composer affordances, the CSS
- [x] **T12 — i18n**: the strings from `plan.md`, `{ en, pt }` (AC10)

## Pass 4 — close it out

- [x] **T13 — docs (§4)**: `docs/how-it-works/voice-live-lifecycle.md`, `docs/architecture.md`,
      `.env.example`, `README` ↔ `README.pt-BR`
- [x] **T14 — gates**: `backend/` · `ai/` · `frontend/` green (AC12)
- [x] **T15 — driven end to end, 2026-09-15.** What was actually verified, and what was not:
      - **Verified against the live service.** `POST /voice/session` with a real Chromium SDP offer
        returned **HTTP 200** and an SDP answer carrying an audio m-line and ICE candidates. The
        response body had exactly two keys — `session_id` and `sdp_answer` — and no credential.
        `DELETE` returned 204, and a second `DELETE` returned 404.
      - **Verified in a browser.** The app was driven through Playwright: the Voice pill is enabled
        from `GET /config`, the overlay opens, the session reached `listening`, the level bars
        animate, and **two transcript lines rendered** — one attributed to the speaker, one to the
        agent — arriving on the WebRTC data channel. `docs/assets/screenshot-voice.png` is that run.
      - **NOT verified: that a human hears the agent through speakers.** The browser was headless
        and used a synthetic audio device. Audio *playback* by a person remains unchecked, and is
        recorded as unchecked rather than implied by the green suite (§5).
      - **NOT verified: barge-in by actually interrupting.** `interrupt_response: true` is asserted
        against the recorded `session.created`, which proves the setting, not the experience.

## Definition of done

- [x] Every acceptance criterion maps to a passing test
- [x] Lint clean · tests green (122 ai, 43 backend, 63 frontend) · build passes
- [x] Docs updated in the same change (§4) — `voice-live-lifecycle.md`, `architecture.md`,
      `REFERENCES.md`, `.env.example`, both READMEs, and `CLAUDE.md` ↔ `AGENTS.md` (§6)
- [x] Every new string in en **and** pt (§7)
- [x] `spec.md` status updated to `done`

## One thing the plan got wrong

`plan.md` said the SSE endpoint would be covered by an HTTP client reading a few events and walking
away. It cannot be: a voice session's event stream has no terminal, `TestClient` blocks on closing a
generator that never returns, and httpx's `ASGITransport` buffers a whole response before handing it
over. The event *content* is therefore asserted against the session object, and the SSE layer is
asserted separately against a session that has already ended and so streams a finite body. Recorded
here rather than quietly reshaped, because the seam moved.
