# Plan: Voice mode

| | |
|---|---|
| **Spec** | [spec.md](spec.md) |
| **Status** | done |

## Approach

Three channels, and the whole design follows from which channel carries what.

```
                    ┌──────────────── BFF (holds the credential) ────────────────┐
browser ──POST /voice/session (SDP offer)──>│ control WebSocket ──> Voice Live   │
        <──────────────── SDP answer ───────│   · rtc.call.sdp.create/created    │
                                            │   · function calls  ──> tool_executor
        <──GET /voice/session/{id}/events───│   · AgentEvents (tool_call/result) │
        ◄═══════ WebRTC audio (RTP) ════════╪════════════════════════════════════> Voice Live
        ◄═══ data channel: transcripts ═════╪════════════════════════════════════> Voice Live
```

- **Audio and transcripts never touch our server.** They are peer-to-peer. The BFF is not in the
  latency path for anything a human hears.
- **The control channel is server-side**, which is what keeps the credential out of the browser.
  Voice Live routes function calls there precisely so a backend can answer them.
- **Tool activity re-enters through the existing `AgentEvent` stream**, so the Agent activity panel
  has no voice-specific branch and the §9 contract does not change.

### Alternatives considered

| Option | Why not |
|---|---|
| `POST /voice/token`, browser connects directly (the original brief) | Puts an Azure credential in the browser. Rejected in PLAN.md as D-2 before any code. |
| Server-side WebSocket relay of audio | Audio transits our process: worse latency, real bandwidth cost, and it teaches the wrong thing. This was the fallback if O-2 came back "no". It came back **yes**, so it is not built. |
| Route transcripts through the BFF as new `AgentEvent`s | Would amend the §9 contract to carry something the browser can already receive directly. The contract stays nine events. |

### The two api-versions

Observed, and the single most surprising finding: **the two endpoints need different
`api-version`s.** `/voice-live/realtime/calls` (WebRTC control) exists **only** on
`2026-01-01-preview`; `/voice-live/realtime` (plain WebSocket) works on all four published values.
Settings therefore carry **two** api-versions, each named for its endpoint, with the observation
written next to them. One shared `VOICELIVE_API_VERSION` would silently break the WebRTC path.

## Affected files

**`ai/` — the Foundry-facing mapping**

- `ai/harness/_shared/voice_events.py` — **new.** Voice Live control frames → `AgentEvent`, plus
  `attachment_query()` building the `agent_name` / `agent_project_name` pair. Lives in `_shared/`
  rather than under `prompt_agent/`: a session attaches to an agent *by name*, so a hosted-agent
  harness would use this unchanged.
- `ai/tests/test_voice_events.py` — **new.** Replays the recorded control-channel fixtures.
- `ai/tests/fixtures/recorded/voice-live-{tool-call,webrtc-handshake}-20260915.jsonl` — **new**,
  already captured.
- `ai/scripts/spike_voice.py` — **new**, already written; kept, because the next person to hit a
  Voice Live api-version change will want it.

**`backend/` — the control channel and the round trip**

- `backend/app/voice_session.py` — **new.** Owns one control WebSocket: connect, SDP exchange,
  receive loop, execute function calls through `tool_executor.execute`, submit outputs, publish
  `AgentEvent`s to a per-session queue. **No tool names appear here** (§8).
- `backend/app/routers/voice.py` — **new.** `POST /voice/session`, `GET /voice/session/{id}/events`,
  `DELETE /voice/session/{id}`.
- `backend/app/settings.py` — two Voice Live api-versions, the endpoint, and `voice_enabled`.
- `backend/app/main.py` — register the router; close open sessions on shutdown.
- `backend/app/routers/config.py` — report `voice` so the frontend can enable the button from the
  server's actual capability rather than from a build flag.
- `backend/pyproject.toml` — `websockets>=13`.

**`frontend/` — the browser half**

- `src/voice/session.ts` — **new.** `getUserMedia` → `RTCPeerConnection` → offer → `POST` → answer.
  Native APIs, no SDK: the flow is short and the point is to show it.
- `src/hooks/useVoiceSession.ts` — **new.** State machine: `idle → requesting → connecting → live →
  ended | error`.
- `src/panes/VoiceOverlay.tsx` — **new.** The overlay from the design: scrim, dark card, level bars,
  transcript, timer, `Mute` / `End session`.
- `src/panes/Header.tsx`, `src/panes/Composer.tsx` — enable the affordances that have been disabled
  since spec 004.
- `src/i18n/strings.ts` — the new strings, `{ en, pt }`.
- `src/styles/app.css` — overlay, level bars, the `vbar` keyframe named in the design.

**docs**

- `docs/how-it-works/voice-live-lifecycle.md` — the stub becomes the page.
- `docs/REFERENCES.md` — the spike findings (done as part of the spike).
- `docs/architecture.md` — the voice path.
- `.env.example` — the two api-versions.

## Contract / data model changes (constitution §4)

**No `AgentEvent` change.** That is the headline. The events a voice session produces —
`tool_call`, `tool_result`, `mcp_call`, `error`, `done` — already exist and already render.

New configuration, single source of truth `backend/app/settings.py`, mirrored in `.env.example` and
reported by `GET /config`:

| Variable | Default | Note |
|---|---|---|
| `VOICELIVE_ENDPOINT` | derived from `FOUNDRY_PROJECT_ENDPOINT` | Voice Live never goes through the AI Gateway |
| `VOICELIVE_WEBRTC_API_VERSION` | `2026-01-01-preview` | **the only version with `/calls`** |
| `VOICELIVE_WS_API_VERSION` | `2026-04-10` | the plain WebSocket endpoint |

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `voice.title` | Voice session | Sessão de voz |
| `voice.start` | Start voice | Iniciar voz |
| `voice.connecting` | Connecting | Conectando |
| `voice.listening` | listening | ouvindo |
| `voice.muted` | muted | silenciado |
| `voice.mute` | Mute | Silenciar |
| `voice.unmute` | Unmute | Reativar |
| `voice.end` | End session | Encerrar sessão |
| `voice.transcriptEmpty` | Say something to begin. | Fale algo para começar. |
| `voice.toolRunning` | Agent activity | Atividade do agente |
| `voice.errorMicDenied` | Microphone permission was denied… | A permissão do microfone foi negada… |
| `voice.errorUnsupported` | This browser cannot open a WebRTC audio session. | Este navegador não consegue abrir uma sessão de áudio por WebRTC. |
| `voice.errorDisabled` | Voice is not configured on this server. | A voz não está configurada neste servidor. |
| `voice.errorFailed` | The voice session could not be established. Try again. | Não foi possível estabelecer a sessão de voz. Tente de novo. |
| `voice.dismissError` | Dismiss | Dispensar |

`header.voiceUnavailable` is **rewritten**, not added: it used to say voice arrives with a later
spec. It now says the server has no Voice Live configured, which is the only reason the button is
disabled any more.

## Test strategy (constitution §2 — TDD)

Every backend test runs against the **recorded** control-channel fixtures through a fake socket, so
the round trip is exercised with no credential and no microphone. The frontend fakes `getUserMedia`,
`RTCPeerConnection` and `fetch` at the boundary — the seam the browser owns — and asserts behaviour
above it.

| AC | Test | File |
|---|---|---|
| AC1 | `test_session_returns_an_answer_and_never_a_credential` | `backend/tests/test_voice.py` |
| AC2 | `test_the_session_attaches_to_the_configured_agent_by_name` · `test_the_documented_parameter_names_are_not_used` | `ai/tests/test_voice_events.py` |
| AC3 | `test_a_function_call_on_the_control_channel_is_executed_and_submitted` | `backend/tests/test_voice.py` |
| AC4 | `test_a_voice_tool_call_produces_the_same_events_as_a_text_one` | `backend/tests/test_voice.py` |
| AC5 | `test_every_call_is_answered_or_the_session_errors` | `backend/tests/test_voice.py` |
| AC6 | `test_deleting_a_session_closes_the_control_channel` | `backend/tests/test_voice.py` |
| AC7 | `useVoiceSession` negotiate/mute tests | `frontend/src/voice/session.test.ts` |
| AC8 | denied-permission · unsupported · failed-negotiation tests | `frontend/src/voice/session.test.ts` |
| AC9 | `test_barge_in_is_on` (asserted against the recorded `session.created`) | `ai/tests/test_voice_events.py` |
| AC10 | the existing `strings.test.ts` coverage tests | `frontend/src/i18n/strings.test.ts` |
| AC11 | the existing no-tool-name import tests, extended to the voice module | `backend/tests/test_routes.py` |
| AC12 | the gates | — |

## Risks / trade-offs

- **`2026-01-01-preview` is a preview api-version, and it is the only one that serves the WebRTC
  route.** If it is withdrawn, voice breaks. Mitigated by keeping `spike_voice.py` and by pinning
  the two versions separately and visibly rather than burying one constant.
- **Sessions are held in process memory**, so the BFF is single-replica for voice. Stated in the
  docs rather than solved: solving it means a session store, which is a different feature and not
  this repository's lesson. It matches the existing `MemorySaver`-style honesty elsewhere.
- **Audio itself is never asserted in CI.** No test proves a human can hear the agent. The tests
  prove the negotiation, the round trip and the events; the audio path is verified by hand and said
  to be, rather than implied by a green suite (§5).
- **A browser tab closed without `DELETE`** leaves a session until its idle timeout. Bounded by a
  server-side cap on concurrent sessions and a timeout, not by trusting the client.
