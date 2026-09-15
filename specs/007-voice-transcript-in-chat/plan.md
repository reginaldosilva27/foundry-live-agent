# Plan: The voice conversation lands in the chat

> The HOW. Written after `spec.md` reached `clarified` on 2026-09-15.

## Approach

**One ordered log replaces two piles.** `useVoiceSession` currently keeps `transcript` (lines) and
`turn` (every activity of the whole session, accumulated) side by side, and nothing records which
came first. The hook starts keeping a single append-only `VoiceLogEntry[]`: an entry is either
something that was **said** (speaker + text, from the data channel) or an **event** (an
`AgentEvent`, from the BFF's SSE). The overlay's two views are then *derived* from that log, so the
overlay renders exactly as it does today and its tests keep passing.

**Turning the log into chat messages is a pure function.** `voiceMessages(log)` walks the entries
once: a user utterance becomes a `UserMessage`; an agent utterance becomes an `AgentMessage` whose
`Turn` is the events seen since the previous agent utterance, reduced with the **same** `reduceTurn`
the chat uses, with the utterance as its text and status `done`. Events left over at the end become
a trailing agent turn with no text, rather than being glued to the previous answer (§5). Being pure,
every acceptance criterion about ordering and attribution is testable without rendering anything.

**The chat gains a divider, not a new renderer.** `Message` gets a third variant — a voice-session
marker carrying its duration — and `Conversation` renders it as one line. The turns themselves go
through the existing components untouched, which is the argument the spec is making.

**Wiring.** `stop()` returns the session's log and duration instead of `void`; `App` converts and
appends. `useAgentStream` exposes `append(messages)` — it already owns the message list, and this
keeps a single list rather than a second one to merge at render time.

Alternatives rejected: keeping the two piles and attributing all activity to the last answer (cheap,
but attributes tools to the wrong utterance); a second message list merged in `Conversation` (two
sources of truth for one column, §4).

## Affected files

- `frontend/src/hooks/useVoiceSession.ts` — keep the ordered log; derive `transcript` and `turn`
  from it; `stop()` returns `{ log, seconds }`.
- `frontend/src/state/voiceLog.ts` *(new)* — `VoiceLogEntry`, `voiceMessages(log, seconds)`; pure.
- `frontend/src/state/voiceLog.test.ts` *(new)* — AC1-AC4, AC5's shape.
- `frontend/src/hooks/useAgentStream.ts` — `append(messages)`.
- `frontend/src/App.tsx` — on end of session, append what it produced.
- `frontend/src/panes/Conversation.tsx` — render the session divider.
- `frontend/src/i18n/strings.ts` — one new string (below).
- `frontend/src/styles/app.css` — the transcript scrolls within the card (AC6).
- `frontend/src/styles/layout.test.ts` — assert that rule exists (AC6).
- `frontend/src/App.test.tsx` — AC3 end to end.
- `docs/how-it-works/voice-live-lifecycle.md` — the session no longer evaporates; say where it goes.
- `specs/README.md`, `CHANGELOG.md` — status and entry.

## Contract / data model changes (constitution §4)

None to `ai/harness/_shared/contract.py`. Both streams already carry `AgentEvent`s and this spec
only consumes them. `VoiceLogEntry` and the divider variant are frontend types; their single source
of truth is `frontend/src/state/voiceLog.ts` and `frontend/src/hooks/useAgentStream.ts`.

## i18n strings (constitution §7)

| key / location | en | pt |
|---|---|---|
| `voice.sessionEnded` (divider) | `Voice session` *(reuses `voice.title`)* + duration | idem |
| `voice.sessionDuration` | `{n} in voice` | `{n} de voz` |

Only one new key: the divider's duration suffix. The name of the thing already exists as
`voice.title` and is reused rather than duplicated (§4).

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 — four messages, in order | `voiceMessages` over a log of two exchanges | `state/voiceLog.test.ts` |
| AC2 — tool card attributed to the right answer | a log where a tool sits between two answers | `state/voiceLog.test.ts` |
| AC3 — typed turn follows the voice turns | end to end: session ends, then send | `App.test.tsx` |
| AC4 — empty session appends nothing | `voiceMessages([])` is `[]` | `state/voiceLog.test.ts` |
| AC5 — divider names the session and duration | divider entry present and rendered | `state/voiceLog.test.ts`, `App.test.tsx` |
| AC6 — transcript scrolls within its bounds | the CSS rule exists | `styles/layout.test.ts` |

## Risks / trade-offs

- **jsdom cannot prove AC6**, only that the rule is declared — the same limitation `layout.test.ts`
  already names about the grid. A screenshot is the real evidence.
- A long session appends many messages at once; the chat's auto-scroll jumps to the end. Acceptable.
- `stop()` changing its return type touches the overlay's End button, which calls it directly.
