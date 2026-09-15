# Plan: Spoken answers in the text chat

> The HOW. Written after `spec.md` reached `clarified` on 2026-09-15.

## Approach

**The BFF synthesises; the browser plays.** A new `POST /speech` takes a piece of text and a
language and answers with MP3 bytes. The browser never holds a credential — the same rule the whole
project runs on — and the frontend needs no Azure SDK, only an `<audio>` element.

**REST, not the Speech SDK.** `azure-cognitiveservices-speech` ships native binaries and would be
the heaviest dependency in the repository, for one POST. The voice path already prefers the wire
over an SDK (`frontend/src/voice/session.ts` speaks raw WebRTC), and this follows it.

**The Entra shape is the part to get right** (§10, all from the two docs cited below): the Speech
REST API does *not* take a plain bearer token. The `Authorization` header carries
`Bearer aad#{resourceId}#{entraAccessToken}`, with the token acquired for the scope
`https://cognitiveservices.azure.com/.default` and the resource's **custom subdomain** host. That is
why `SPEECH_RESOURCE_ID` exists as configuration: without the ARM resource id there is no way to
build the header. The caller needs **Cognitive Services Speech User** on the resource.

**Sentence by sentence.** The frontend watches the answer as it streams, cuts it at sentence
boundaries, flattens the markdown, and sends each sentence to `/speech` as it closes. A queue plays
them in order, so the reader hears sentence one while sentence two is still being written. Both the
cutting and the flattening are pure functions, which is where the interesting tests are.

**Unconfigured is a first-class state.** With no `SPEECH_ENDPOINT`/`SPEECH_RESOURCE_ID`, `GET
/config` reports `speech.enabled: false`, the header does not offer the toggle, and `POST /speech`
answers `503` with the reason — the same shape voice already uses for a server without Voice Live.

**Honesty about what is verified** (§5): the request shape, the headers, the auth string and the
voice names come from the docs below and are exercised in tests against an injected synthesiser.
Whether the reference project's own Foundry resource answers on `…cognitiveservices.azure.com`
without a separate Speech resource is **not** assumed: the host is configuration, and the README
says to take it from the resource's *Keys and Endpoint* page. Until a real request is made against a
real resource, no claim is made that it was.

## Affected files

- `backend/app/settings.py` — `speech_endpoint`, `speech_resource_id`, `speech_voice_en`,
  `speech_voice_pt`, and `speech_enabled`.
- `backend/app/speech.py` *(new)* — build the SSML, build the `aad#` header, POST, return the bytes.
- `backend/app/routers/speech.py` *(new)* — `POST /speech`; `503` when unconfigured.
- `backend/app/routers/config.py` — report `speech.enabled`.
- `backend/app/main.py` — inject the synthesiser, the way `stream_factory` and `voice_connect` are.
- `backend/pyproject.toml` — `httpx` as a runtime dependency (it was only a test one).
- `backend/tests/test_speech.py` *(new)* — AC8, AC9, and the auth/SSML shape.
- `frontend/src/state/speech.ts` *(new)* — `nextSentences`, `flatten`; pure.
- `frontend/src/state/speech.test.ts` *(new)* — AC2's ordering rule, AC7.
- `frontend/src/speech/player.ts` *(new)* — the queue: fetch, play, stop. Audio injected.
- `frontend/src/speech/player.test.ts` *(new)* — AC2, AC3, AC4.
- `frontend/src/hooks/useSpokenAnswers.ts` *(new)* — watches the messages, feeds the player.
- `frontend/src/panes/Header.tsx`, `frontend/src/App.tsx` — the toggle and the wiring.
- `frontend/src/App.speech.test.tsx` *(new)* — AC1, AC5, AC6 end to end.
- `frontend/src/i18n/strings.ts` — the toggle's label and its stop control, `en` + `pt`.
- `.env.example`, `README.md`, `README.pt-BR.md`, `docs/REFERENCES.md`. *(`docs/architecture.md`
  is still the stub spec 003–006 left; filling it is its own job, not this spec's.)*

## Contract / data model changes (constitution §4)

`backend/app/settings.py` is the source of truth for the new configuration; `.env.example`,
`GET /config`, `frontend/src/config.ts` (`BffConfig`) and both READMEs move with it in this change.
`AgentEvent` does not change.

## References read for this plan (constitution §10)

| What | URL | Taken from it |
|---|---|---|
| Text to speech REST API | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech | `POST {endpoint}/cognitiveservices/v1`; required headers `Authorization`, `Content-Type: application/ssml+xml`, `X-Microsoft-OutputFormat`, `User-Agent`; body is SSML; streaming format `audio-24khz-48kbitrate-mono-mp3`; 10-minute audio cap; 401/415/429 meanings. Doc dated 2026-05-21, read 2026-09-15. |
| Microsoft Entra authentication | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-configure-azure-ad-auth | Token scope `https://cognitiveservices.azure.com/.default`; header value `aad#{resourceId}#{token}`; custom subdomain `https://{name}.cognitiveservices.azure.com` required; role **Cognitive Services Speech User**. Doc dated 2026-06-06, read 2026-09-15. |
| Language and voice support | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts | Voice short names `en-US-AvaMultilingualNeural` and `pt-BR-ThalitaMultilingualNeural`. Read 2026-09-15. |

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `header.speak` | `Speak` | `Falar` |
| `header.speakUnavailable` | `Speech is not configured on this server.` | `A fala não está configurada neste servidor.` |
| `speech.stop` | `Stop speaking` | `Parar de falar` |

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 — off means silent | no request to `/speech` while a turn streams | `App.speech.test.tsx` |
| AC2 — each sentence once, in order | `nextSentences` over a growing buffer; the player's order | `state/speech.test.ts`, `speech/player.test.ts` |
| AC3 — a new message stops the old speech | `stop()` on the player clears queue and playback | `speech/player.test.ts` |
| AC4 — stopping leaves the turn alone | the turn still renders after stop | `App.speech.test.tsx` |
| AC5 — the choice holds across turns | two turns, one toggle | `App.speech.test.tsx` |
| AC6 — an error is not read aloud | an error turn synthesises nothing | `App.speech.test.tsx` |
| AC7 — markdown is flattened | `flatten` over fences, emphasis, links | `state/speech.test.ts` |
| AC8 — the BFF answers with audio in that voice | injected synthesiser sees the right voice and SSML | `tests/test_speech.py` |
| AC9 — unconfigured refuses with a reason | `/config` says `false`; `POST /speech` is `503` | `tests/test_speech.py` |

## Risks / trade-offs

- **Latency and cost per sentence.** One request per sentence is more round trips than one per
  answer; the win is hearing the answer while it is still being written.
- **jsdom has no audio.** Playback is proven against an injected audio factory, not a speaker — the
  same limitation, stated the same way, as voice mode's "no test proves a human can hear it".
- **Sentence cutting is heuristic** in any language; abbreviations will occasionally split early.
- **The endpoint is unverified against the live resource** until someone runs it with real
  configuration. Nothing in the repository will claim otherwise.
