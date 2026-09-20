# The Voice Live session lifecycle

The same agent, the same two function tools, a completely different transport — and the application
gains no second brain to make it work. That is the whole point of this page.

Everything here was **observed against the live service on 2026-09-15** by
[`ai/scripts/spike_voice.py`](../../ai/scripts/spike_voice.py), and the captures are committed under
[`ai/tests/fixtures/recorded/`](../../ai/tests/fixtures/recorded/). Three of the findings contradict
the published documentation; they are called out below, because a reader who trusts the docs over
this page will build something that does not connect.

## Three channels

```
                    ┌──────────── BFF (holds the credential) ────────────┐
browser ─POST /voice/session (SDP offer)──>│  control WebSocket ──> Voice Live
        <─────────── SDP answer ───────────│    · rtc.call.sdp.create / .created
        <──GET /voice/session/{id}/events──│    · function calls ──> tool_executor
        ◄════════ WebRTC audio (RTP) ══════╪═══════════════════════════> Voice Live
        ◄═══ data channel: transcripts ════╪═══════════════════════════> Voice Live
```

| Channel | Between | Carries |
|---|---|---|
| Control WebSocket | **BFF** ↔ Voice Live | SDP exchange, session config, **function calls** |
| WebRTC media (RTP) | browser ↔ Voice Live | audio, both directions |
| Data channel `voice-live-events` | browser ↔ Voice Live | VAD edges, transcripts, response lifecycle |

Two consequences worth stating plainly:

- **No Azure credential reaches the browser.** It never mints one, never holds one, never sees one.
  The only thing it sends is its own SDP offer.
- **The BFF is not in the latency path of anything a person hears.** Audio is peer-to-peer. The
  server is on the path of tool calls only, which is where it has to be, because that is where the
  tools are.

## Attaching to the agent

```
wss://<resource>.services.ai.azure.com/voice-live/realtime/calls
  ?api-version=2026-01-01-preview
  &agent_name=foundry-live-agent
  &agent_project_name=<project>
```

> **Contradiction 1 — the parameter names.** The agents quickstart documents `agent_name` +
> `project_name`. The service rejects that pair with:
>
> ```
> "Missing required agent project name"
> ```
>
> The second parameter is **`agent_project_name`**. The error names a missing *value*, not a wrong
> *key*, which is what makes this cost an afternoon. The hyphenated `agent-name` /
> `agent-project-name` pair also works. The older `agent_id` + `project_id` is rejected outright:
> *"Classic foundry agent is not supported in API version 2026-04-10 and above."*

> **Contradiction 2 — there is no single api-version.** The WebRTC control route
> `/voice-live/realtime/calls` exists **only** on `2026-01-01-preview` — 404 on `2026-04-10` and
> `2026-07-15`, 401 on `2026-06-01-preview`. The plain WebSocket route `/voice-live/realtime` works
> on all four. So the settings carry **two** api-versions, one per endpoint. Collapsing them into a
> single `VOICELIVE_API_VERSION` silently breaks whichever path it was not chosen for.

Entra ID only — key authentication is unsupported in agent mode, which suits this repository's
"no secrets anywhere" rule rather than fighting it. Scope: `https://ai.azure.com/.default`.

## The handshake

The browser builds an offer, the BFF relays it, Voice Live answers:

```jsonc
// BFF -> Voice Live
{ "type": "rtc.call.sdp.create", "sdp_offer": "v=0\r\no=- …" }

// Voice Live -> BFF
{ "type": "rtc.call.sdp.created", "rtc_call_id": "37869044-…", "sdp_answer": "v=0\r\no=str0m…" }
```

> **Contradiction 3 — the field is `sdp_offer`.** `sdp`, `offer`, `call.sdp` and every other obvious
> spelling are refused with `rtc.call.error` / `missing_sdp` — *"SDP offer is required"* — which,
> again, reads as a missing value rather than a wrong key.

`session.created` arrives alongside it and confirms the attachment:

```jsonc
{
  "agent": { "type": "agent", "name": "foundry-live-agent" },
  "voice": { "name": "en-US-AvaNeural", "type": "azure-standard" },
  "turn_detection": { "type": "server_vad", "interrupt_response": true }
}
```

**Barge-in is on by default.** `interrupt_response: true` is what stops the agent mid-sentence when
you talk over it. It is a server-side default this project depends on rather than sets, so a test
asserts it against the recorded frame instead of assuming it holds.

## A tool call during a conversation

This is the part that matters. Mid-sentence, the agent decides it needs the time in São Paulo:

```jsonc
// Voice Live -> BFF, on the control channel
{
  "type": "response.function_call_arguments.done",
  "call_id": "call_0004",
  "name": "get_current_datetime",
  "arguments": "{\"timezone\":\"America/Sao_Paulo\"}"
}

// BFF -> Voice Live, after running it through the SAME tool_executor the chat uses
{ "type": "conversation.item.create",
  "item": { "type": "function_call_output", "call_id": "call_0004", "output": "{…}" } }
{ "type": "response.create" }
```

Three things about that exchange:

1. **The BFF chose nothing.** Foundry picked the tool and the arguments; `tool_executor.execute`
   resolved the name through the registry and called it. A test asserts the voice path and the chat
   path are literally the same function object — not two implementations that happen to agree.
2. **The voice frame is better shaped than the text one.** It carries `name` *and* `call_id`
   together. The Responses API sends `name: null` on the equivalent event and forces a read of the
   completed output item (see [streaming-events.md](streaming-events.md)).
3. **`response.create` is not optional.** Submitting the output alone leaves the agent silent: it
   resumes only when asked to. The symptom of forgetting it is an agent that stops talking
   mid-answer, which reads as a crash.

An unanswered call is the same failure as in text, with a worse symptom: Voice Live waits, and the
user hears nothing and assumes the app broke. So every collected call is answered — with an error
payload if the tool failed, because an error the agent can *say out loud* beats silence.

## What the browser sees

Tool activity reaches the UI as the **existing** `AgentEvent`s — `tool_call`, `tool_result`,
`mcp_call`, `usage` — over `GET /voice/session/{id}/events`. The voice overlay renders them with the
same `ToolCard` the chat uses. The `AgentEvent` set did not grow for voice, and that was a design
goal rather than a happy accident: transcripts, which would have needed new event types, arrive at
the browser directly on the data channel instead of being relayed.

## How the session is configured

The voice, the turn detector and the input-audio options travel **inside** `rtc.call.sdp.create`,
next to the SDP offer — the shape the WebRTC documentation shows — so the session is configured
before a word is spoken rather than one round trip later:

```json
{ "type": "rtc.call.sdp.create", "sdp_offer": "v=0…",
  "session": {
    "voice": { "name": "pt-BR-Thalita:DragonHDLatestNeural", "type": "azure-standard" },
    "turn_detection": { "type": "azure_semantic_vad_multilingual",
                        "interrupt_response": true, "remove_filler_words": true },
    "input_audio_noise_reduction": { "type": "azure_deep_noise_suppression" } } }
```

Three things about that block are worth knowing (spec 012):

- **Barge-in is only configurable on the azure semantic detectors.** `interrupt_response` does not
  exist on the default `server_vad`, so until this the interruption spec 006 promised was whatever
  the service happened to do.
- **`instructions` is never sent.** It is documented as unsupported with a custom agent, and it is
  the one field that would quietly replace the agent this project is built around.
- **`modalities` is stated, not assumed.** The service's default varies — the committed fixtures
  show `["text"]` in one session and `["audio", "text"]` in another — and a text-only session is a
  transcript with no sound.
- **The voice is the HD tier, and that is a listening decision** (spec 016). `azure-standard`
  covers both tiers; HD costs first-audio latency and buys naturalness in Portuguese.
  `VOICELIVE_VOICE` switches back to `pt-BR-Luana:MAI-Voice-2-Flash` in one line.
- **Blank configuration sends nothing.** With every `VOICELIVE_*` variable empty the frame is just
  `type` and `sdp_offer`, exactly as the recorded fixtures captured it.

## The gap while a tool runs

A function-call round trip is silent by construction: the model emits the call instead of speech,
and speech resumes when the output comes back. On screen that is four tool rows filling in; in the
ear it is a person who stopped talking. Nothing in this app can fix that — `instructions` is not
supported on a session with a custom agent, and a filler the BFF spoke would be the app putting
words in the agent's mouth (§8).

So the fix lives in the agent definition (spec 016): *before you call a tool that takes a moment,
say one short sentence about what you are about to look up.* Observed on agent version 6,
2026-09-16, and recorded in `ai/tests/fixtures/recorded/voice-live-preamble-20260916.jsonl`:

```
response.audio_transcript.delta   "Vou verificar isso na internet agora."
response.function_call_arguments.done   search_web({"query": "último jogo do Corinthians …"})
```

The model narrates **once per leg**, so a turn that searches again after reading the first result
opens the second leg with its own sentence. An instruction biases a model rather than compelling
it, which is why that ordering is asserted against a recording and not merely written down.

## The one thing the session tells the agent

The agent does not know it is speaking. Voice Live transcribes before the model and synthesizes
after it, so the model's input is a transcript and its output is text — and asked in as many words,
over a real audio turn, `gpt-5.5` answers *"Estou trocando texto escrito com você."*

That matters because a written answer should cite its sources and a spoken one must not: a voice
reads `https://www.sofascore.com/pt/football/team/corinthians/1957` slash by slash, to a listener
who cannot write it down. An instruction conditioned on the modality is conditioned on nothing.

So the session says it — one frame, right after the offer:

```json
{ "type": "conversation.item.create",
  "item": { "type": "message", "role": "system",
            "content": [{ "type": "input_text",
                          "text": "This conversation is spoken: the person is listening to you, not reading. …" }] } }
```

**This is the single bounded exception to §8** (constitution, amended 2026-09-16): a static fact
about the *transport*, sent once, naming no tool and reading nothing the model said. It exists
because `instructions` — the documented field for this — is unsupported with a custom agent, and
because §8's own test says yes: swap the harness and the conversation is still spoken.

The proof is a pair of recordings on the same agent version, differing only in this frame:
`voice-live-no-urls-20260916.jsonl` answers and stops; `voice-live-urls-spoken-20260916.jsonl`
reads the address out loud.

## What the overlay shows, and what it does not

During a session the card shows the conversation newest-first and **one line per tool call** — the
name, who executed it, how long it took. The arguments and the result are not shown: a
`lookup_knowledge` result is a page of JSON, and inside a 460px card over a live conversation it
buries the thing you are listening to. There is no trace panel beside a voice session, so that
detail is simply not offered during one; it reaches the chat when the session ends (spec 007).

The BFF logs what each session actually negotiated:

```
voice session negotiated: modalities=['audio', 'text'] voice=pt-BR-Thalita:DragonHDLatestNeural turn_detection=azure_semantic_vad_multilingual
```

That line is the difference between *the agent did not speak* and *the browser did not play* — the
two failures look identical from the outside, and a session that comes back `modalities=['text']`
is silent by design.

## Ending, and where the conversation goes

Two streams arrive during a session — what was said, on the data channel, and what the agent did,
as `AgentEvent`s over SSE — and the browser keeps them in **one ordered log**
(`frontend/src/state/voiceLog.ts`). Order is the only thing that says which answer a tool call
belonged to, so two separate lists would throw that away.

When the session ends, the log is replayed into the chat: user utterances as user messages, agent
utterances as turns carrying the calls that arrived since the previous utterance, under a divider
naming the session and its length. The turns are the chat's own components, unchanged — which is
the argument stated out loud: a turn spoken and a turn typed are the same turn (spec 007).

Calls that arrive after the agent's last utterance belong to no answer, so they land in a turn of
their own rather than being attached to one they did not produce (§5). Nothing survives a reload:
this release still persists no conversation anywhere.

`DELETE /voice/session/{id}` closes the control channel. A closed browser tab sends no `DELETE`, so
the server also caps concurrent sessions and closes everything on shutdown rather than trusting the
client to hang up.

**The cap alone was not enough, and made things worse rather than better.** Nothing removed a
session nobody ended, so four abandoned tabs filled `MAX_SESSIONS` and voice became unavailable on
that process until somebody restarted it — with four control channels still open to a service that
bills per second. Two things close that hole, and neither is a timer:

- **The activity stream is the liveness signal.** The browser holds
  `GET /voice/session/{id}/events` open for the whole call, so that stream unwinding *is* the tab
  going away. The session is released there. The trade-off is stated rather than hidden: a
  transient drop on that stream ends the call too, which is the safe direction to err in when the
  alternative is a meter running that nobody can see.
- **A finished session does not hold a slot.** Sessions whose control channel already died are
  dropped before the cap is checked, so a dead one can never keep a live one out.

Both are asserted in `backend/tests/test_voice_reaping.py`, which drives the streaming response's
own iterator: `httpx.ASGITransport` buffers a response whole, so neither it nor `TestClient` can
observe a client walking away from an endless stream.

**Sessions live in the BFF's process memory, so the BFF is single-replica for voice.** This is
stated rather than solved. Fixing it means a session store, which is a different feature and not
this repository's lesson — the same honesty the in-process conversation memory gets elsewhere (§5).

**No test in CI proves a human can hear the agent.** The tests prove the negotiation, the round trip
and the events, all against recorded frames. The audio path is verified by hand, and
[`specs/006-voice-mode/tasks.md`](../../specs/006-voice-mode/tasks.md) records that it was.

## What the screen shows during a session (spec 039)

The overlay renders the running transcript and the session's tool calls — through the **same**
`ToolRow` the chat uses, so a reader learns one vocabulary (§4). A call that is running shows
elapsed time; a finished one keeps the duration the event reported. Those are different numbers on
purpose: one is what we observed, the other is what happened.

Spec 016 added a spoken preamble because a tool round trip is silent and the listener assumes the
app has broken. That is the right fix for the listener. It is not a fix for the person standing in
front of a room saying "it is searching Learn right now" with nothing on screen to corroborate it —
which is what this adds.

**No contract change.** The data channel already carries what was said and the session events
already carry what the agent did; `useVoiceSession` exposes both live. Nothing here sends anything
to the session, and nothing it holds is written to storage — spec 007's replay is the record.

**Interruption is not shown**, because nothing observed says it happened. See the open item in
[`REFERENCES.md`](../REFERENCES.md).

## Choosing the voice (spec 043)

Spec 012 declared "no per-session choice in the UI" and was right to. The record of what followed is
the argument for revisiting it: the default voice changed three times in two days — multilingual
Thalita, then Luana Flash for latency, then Thalita DragonHD after the listening test 012 admitted
it had not run — and every one of those iterations needed an environment variable and a restart,
with no way to hear the alternatives back to back.

This revisits that one non-goal, **for the voice only**. Turn detection and noise suppression stay
deployment configuration, because a reader cannot evaluate them in one session.

```
VOICELIVE_VOICES=a,b,c   ──>  GET /config  ──>  chooser renders (2+ offered)
                                                 │
POST /voice/session { sdp, agent, voice }  <─────┘   refused if not offered
```

- **The deployment declares the list.** Not read from the service: which identifiers are valid on
  this api-version is a §10 question and no doc has been read for it.
- **The BFF refuses anything outside it**, rather than the UI merely not offering it. A list the
  browser could step outside of would not be a list.
- **Blank declares nothing**, no chooser renders, and the session behaves exactly as spec 012
  shipped it.
- **The choice is this browser's**, stored with the other preferences (spec 036), and the screen
  says so.
- **Read at start.** Changing it does not reconfigure a running session, which was negotiated with
  the voice it has.

**Nothing here says anything to the model.** `instructions` is unsupported with a custom agent, and
§8's single bounded exception — one context item stating the conversation is spoken (spec 017) — is
spent and stays spent. Changing the voice mid-call would be `session.update`, which spec 012 *noted*
as the mechanism and which nobody here has measured; it is deferred rather than guessed.

