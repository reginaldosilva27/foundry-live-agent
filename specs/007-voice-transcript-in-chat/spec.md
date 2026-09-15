# Spec: The voice conversation lands in the chat

| | |
|---|---|
| **ID** | 007-voice-transcript-in-chat |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-15 |

## Problem / motivation

A voice session is currently unreadable and then lost. The overlay's transcript column is a narrow
dark card over the whole app; a long answer — and the agent gives long answers — scrolls past the
tool cards, overlaps the controls, and cannot be scrolled back to comfortably. Worse, when the
session ends it all disappears: spec 006 declared "no transcript persistence" as a non-goal, and
took that literally enough that the conversation does not even survive into the page you are
looking at.

The chat column already solves every one of those problems. It is wide, it scrolls, it renders
markdown, and it renders exactly the same tool cards from exactly the same `AgentEvent`s. The voice
conversation has no reason to be a second, worse reading surface.

There is also an argument the repository wants to make: a turn spoken and a turn typed are **the
same turn**, from the same agent version, through the same tools. Ending a voice session and seeing
it sitting in the chat next to the typed turns is that claim, demonstrated rather than asserted.

## Goals

- When a voice session ends, everything it produced appears in the chat: what was said, what the
  agent answered, and every tool and MCP call it made, in order.
- The transcript stays readable during the session too — the overlay is not made worse by this.
- Voice turns and typed turns are rendered by the **same** components, from the same events.
- A voice turn is visibly a voice turn; nothing claims it was typed.

## Non-goals

- No persistence across page reloads. Nothing in this release persists a conversation, and this
  spec does not change that (spec 004, M9).
- No audio playback of past turns, and no stored audio.
- No change to the Voice Live session lifecycle, the WebRTC handshake, or the tool round trip.
- No trace data for voice turns — still spec 005's surface.

## User-facing behavior

During a session the overlay works as it does today. On **End session**, the overlay closes and the
conversation it produced is appended to the chat column, below whatever was already there: the
user's utterances as user messages, the agent's as agent turns, each carrying the activity cards it
generated. The chat marks them as spoken, and any new prose ships `en` + `pt` (§7).

A session that produced nothing appends nothing.

## Clarified decisions (2026-09-15)

- **Faithful turns, in arrival order.** The voice session is recorded as **one ordered log** rather
  than two piles, and the chat is derived from it: an utterance by the user becomes a user message;
  an utterance by the agent becomes an agent turn carrying the tool and MCP calls that arrived
  since the previous agent utterance. Without the single log there is no truthful way to say which
  answer a tool belonged to, and AC2 would be a decoration.
- **On End session, not live.** The chat receives the conversation when the session ends.
- **The overlay stays the live surface** and is not restructured; only its transcript region is
  fixed so it scrolls within itself instead of over the controls (AC6).
- **One divider, not a badge per turn.** A "Voice session" line with the duration opens the block;
  the turns inside are rendered exactly like typed ones, which is the claim the spec exists to
  make. The divider reuses the existing `voice.title` string rather than adding a synonym (§4).

## Acceptance criteria

1. **AC1** — Given a voice session that produced two user utterances and two agent answers, when
   the session ends, then the chat contains those four messages in the order they occurred.
2. **AC2** — Given a voice turn that called `get_current_datetime`, when it lands in the chat, then
   it carries the same tool card the typed path renders, with the same executor attribution.
3. **AC3** — Given a voice session that ended, when the user then types a message, then the typed
   turn appears **after** the voice turns, in one continuous conversation.
4. **AC4** — Given a voice session that produced no transcript, when it ends, then the chat is
   unchanged.
5. **AC5** — Given a voice session that landed in the chat, when it is rendered, then a session
   divider opens the block, naming it and its duration in the reader's language.
6. **AC6** — Given a voice session in progress, when the overlay renders a long answer, then the
   transcript region scrolls within its own bounds and never overlaps the controls.

## Contract / data impact

None to `ai/harness/_shared/contract.py` — this consumes the events that already exist, on both
sides. The chat's message list gains a way to say a turn was spoken; that type is the frontend's
own (`frontend/src/hooks/useAgentStream.ts`) and is not part of the §9 contract.

## Open questions (clarify before planning)

None — all resolved above on 2026-09-15.

## Out of scope / deferred

- Re-opening a voice session and continuing the same Foundry conversation.
- Exporting a transcript.
- Showing the conversation in the chat **live**, while the session runs. Decided against for now;
  the ordered log this spec introduces is what a later spec would need, so nothing is wasted.
- Tool calls that arrive after the agent's last utterance are attributed to no answer. They land in
  a trailing turn with no text rather than being glued to the previous answer, because gluing them
  there would be a claim the log does not support (§5).
