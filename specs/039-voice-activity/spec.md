# Spec: What the voice session is doing, while it does it

| | |
|---|---|
| **ID** | 039-voice-activity |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |
| **Clarified** | 2026-09-19 |

## Problem / motivation

Voice mode is where this project shows the most and the app shows the least. During a session the
overlay reports that it is live and how long it has been running. Everything else — what was
transcribed, which tool ran, how long it took, what came back — exists only after the session ends,
when spec 007 replays the conversation into the chat.

That gap is felt precisely where the project made a deliberate decision about it. Spec 016 added a
spoken preamble because a tool round trip is silent and the listener assumes the app has broken. The
preamble is the right fix for the *listener*. It is not a fix for the person demonstrating, who is
standing in front of a room saying "it is searching Learn right now" with nothing on the screen to
corroborate it.

The events exist: a voice session's function calls route to the server's control channel, and the BFF
already answers them and knows what it ran.

## Goals

- **The live session shows its activity**: what was heard, what is being said, which tool is running
  and how long it took.
- The overlay stays **watchable from across a room** — this is the surface most often projected.
- Nothing shown here changes what the session does (§8).

## Non-goals

- **No control over the turn.** No "cancel this tool", no editing a transcript, no re-running
  anything from the overlay.
- **No prompting through the overlay.** `instructions` is unsupported with a custom agent, and §8's
  single bounded exception — one system context item saying the conversation is spoken (spec 017) —
  is spent. Nothing here adds to it.
- **No duplication of the replay.** Spec 007 owns what lands in the chat afterwards; this owns what
  is visible during.
- No change to the `AgentEvent` set (§9) unless an open question below forces it, in which case this
  becomes a §9 change and the spec says so explicitly before any code.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**This is a UI change, not a contract change.** The first open question decided the shape of the
spec and the answer is the good one: `useVoiceSession` already exposes `transcript` and a live
`turn`, because the data channel carries what was said and the BFF's session events carry what the
agent did. **No new `AgentEvent`** (§9), no new endpoint.

**Much of this already exists**, built by specs 012 and 015, and saying so is more useful than
re-specifying it: the overlay already renders the running transcript newest-first and already
renders the session's tool calls through the chat's own `ToolRow`, which already distinguishes
running from finished from failed. What is missing is smaller than the draft assumed — the elapsed
time of a call while it runs, and the reasoning summary when there is one.

**Interruption is deferred, and the reason is recorded.** Barge-in is configured (spec 012's
`interrupt_response`), but **no recorded session contains an event for it** — checked across every
`voice-live-*` fixture. Inferring it from an agent turn that stopped producing audio would be
drawing a conclusion we did not measure (§5), so AC5 becomes an open item in `docs/REFERENCES.md`
with how to close it, rather than a guess shipped as a feature.

**The overlay stays an overlay.** A layout with the chat visible behind it is what someone
comparing spoken and typed answers wants, and it is a redesign — spec 020's reserved `/compare`
address is where that belongs, not here.

**The overlay grows an activity area**: the running transcript of both sides as it arrives, and the
tool rows for the session's calls — the same rows the chat uses, so a reader learns one vocabulary
(§4).

**A running tool is visibly running**, with its elapsed time, the way spec 015's live status line
already works for typed turns. When it finishes, its duration stays.

**It is legible at distance**: larger than the chat's rows, high contrast, and no information that
only reads on a laptop screen at arm's length.

**Interrupting** — barge-in, which spec 012 configured — is visible: the reader can see that the
agent's turn was cut short rather than finished, because on audio alone those sound identical.

**A failing tool during voice** shows its failure. The agent is instructed to say what failed, and
the screen agreeing with the audio is what makes the demo trustworthy.

**When the session ends**, the replay into the chat is unchanged (spec 007). The overlay's content is
not a second record and is not stored.

## Acceptance criteria

1. **AC1** — During a live session, transcribed user speech renders as it arrives.
2. **AC2** — The agent's spoken text renders as it arrives.
3. **AC3** — A tool call during the session renders a row with its name; while running it shows
   elapsed time; when finished it shows its duration.
4. **AC4** — A tool that errored renders as failed, distinct from one that returned.
5. **AC5** — ~~An interrupted agent turn renders as interrupted~~ — **deferred**: no recorded
   session carries an event for barge-in, and inferring it from silence would be a measurement we
   did not make (§5). Recorded in `docs/REFERENCES.md` with how to close it.
6. **AC6** — The rows use the same components as the chat's activity panel (§4).
7. **AC7** — Nothing in the overlay sends anything to the session: no request is issued from any
   control added here (asserted — the §8 guard).
8. **AC8** — Ending the session replays into the chat exactly as it does today (spec 007's tests,
   unchanged and still passing).
9. **AC9** — The overlay's content is not persisted to browser storage.
10. **AC10** — Every new string ships `en` + `pt`.
11. **AC11** — A tool running during a session shows elapsed time that advances, and the finished
    row keeps its duration.
12. **AC12** — A reasoning summary produced during a session renders; one that is absent renders
    nothing rather than an empty card.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | **Unchanged (§9)** — settled at clarify by reading the code rather than assuming. `useVoiceSession` already exposes `transcript` and a live `turn`; the vocabulary is sufficient. |
| **`GET /voice/session/{id}/events`** | Unchanged. It already carries the agent's activity, which is what spec 007's replay is built from. |
| **Shared components** | The tool row, the duration bar and the live status line are shared with the chat, not copied (§4). Their larger presentation is styling. |
| **Docs** | `docs/how-it-works/` — the Voice Live session lifecycle page gains what the screen now shows. |

## Out of scope / deferred

- Any control over the running session beyond ending it.
- Storing the live activity separately from spec 007's replay.
- A transcript export distinct from the conversation export (spec 027).
- Rendering interruption — deferred for want of a measurement, not of an opinion.
- A side-by-side layout of spoken and typed answers — that is spec 020's reserved address.
