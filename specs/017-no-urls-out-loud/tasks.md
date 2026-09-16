# Tasks: A spoken answer does not read URLs out loud

> The order below is the order it actually happened, including the attempt that failed. Kept rather
> than tidied away: the failure is the reason the design is what it is (§5).

## Attempt 1 — the agent definition (abandoned, deliberately recorded)

- [x] **T1 — test first**: a rule in the shipped definition, conditional on the spoken case.
- [x] **T2 — implement + apply**: agent version **7**.
- [x] **T3 — record**: a live voice turn. **URL read aloud anyway — the approach failed.**
- [x] **T4 — diagnose**: asked the agent, over real audio in and out, whether it was hearing or
      reading. *"Estou trocando texto escrito com você."* The modality is invisible to the model,
      so no wording could have worked.
- [x] **T5 — revert**: rule removed; agent version **8** carries the same instructions as 6.

## Attempt 2 — the session says what the agent cannot see

- [x] **T6 — probe**: does Voice Live accept a `role: system` conversation item with a custom
      agent, where `instructions` is refused? **Yes**, and the URL disappears from the answer.
- [x] **T7 — decide**: §8 forbade this in its own words, so it went to the maintainer, who chose
      this over dropping citations everywhere (2026-09-16).
- [x] **T8 — amend the constitution**: the bounded exception, its rationale and its limits, plus
      `CLAUDE.md` ↔ `AGENTS.md` in the same change (§6).
- [x] **T9 — test first (AC1, AC2)**: the frame's shape and its §8 boundary
      (`ai/tests/test_voice_events.py`), and that the BFF sends it on negotiate
      (`backend/tests/test_voice.py`).
- [x] **T10 — implement**: `spoken_context_item()` in `ai/harness/_shared/voice_events.py`; sent
      from `VoiceSession.negotiate`.
- [x] **T11 — record (AC3, AC5, AC6)**: a live voice turn driven by **real audio** — no URL, the
      answer intact, spec 016's preamble still first.
- [x] **T12 — record the control (AC7)**: the same turn with the item removed — the URL returns.
- [x] **T13 — record (AC4)**: the same question in text — the written citations are still there.
- [x] **T14 — docs (§4)**: fixtures README, `docs/REFERENCES.md` (the cascade, the modality finding,
      the HD voice naming and the pt-BR gap), `voice-live-lifecycle.md`, `CHANGELOG.md`, index row.
- [x] **T15 — gates**: backend · ai · frontend (Node 24) · infra.

## Definition of done

- [x] Every acceptance criterion maps to a passing test against a committed recording
- [x] Lint clean · tests green · build passes
- [x] The applied agent version is recorded (**8**)
- [x] Constitution amended in the same change, twins in sync (§6)
- [x] `spec.md` status updated to `done`
- [ ] **One spoken turn in the real app** — the WebRTC control channel is the one path no fixture
      covers, and it is the maintainer's click, not this spec's claim (§5)
