# Plan: Every turn knows what day it is

> The HOW. Written after `spec.md` is `clarified`. Decisions here must respect every
> principle in `.specify/constitution.md`; if one must bend, amend the constitution
> first and note it.

## Approach

One sentence of fact, built in one place, sent in two shapes:

- **The sentence** — `Current date and time: Saturday, 14 November 2026, 22:30 (America/Sao_Paulo,
  UTC-03:00).` — is built by one function in `ai/harness/_shared/current_moment.py`, from the
  server clock and the declared timezone. The clock is a parameter so the tests can pin it.
- **Text turns** — the chat route builds the turn's messages as `[moment, user]`. The moment is a
  Responses `developer` message. Building it at the **message** level, not in the stream factory, is
  what keeps AC5: the factory runs once per leg, and the leg that answers a tool call must carry only
  `function_call_output` items.
- **Voice** — `VoiceSession.negotiate` sends a second `conversation.item.create` right after spec
  017's spoken-conversation item, with the same sentence. Once per session: a call that crosses
  midnight keeps the date it opened with, and `get_current_datetime` is still there.
- **The hosted agent** — its graph used to prepend its own instructions only when the history held
  **no** system message. LangChain maps a `developer` message to a `SystemMessage`, so the moment
  item would have silently replaced the hosted agent's instructions. The graph now puts its own
  instructions first unless they are already there.

**Alternatives rejected.**

- *A sentence in the agent's instructions* — instructions are static; a date cannot live there.
- *`instructions` on the request* — Foundry refuses it beside `agent_reference` (*"Not allowed when
  agent is specified"*).
- *Only telling the agent to call `get_current_datetime` first* — the instruction already exists
  and was ignored in the very turn that motivated this; it also costs a silent round trip in voice.
- *The browser's timezone* — a fourth field on `POST /chat` (non-goal).

## Affected files

- `ai/harness/_shared/current_moment.py` — **new**: `DEFAULT_TIMEZONE`, `current_moment_text`,
  `current_moment_item` (the Responses `developer` item).
- `ai/harness/_shared/voice_events.py` — `current_moment_frame`: the Voice Live
  `conversation.item.create` carrying the same text.
- `ai/harness/langgraph/agent/graph.py` — own instructions first, whatever else the history holds.
- `backend/app/settings.py` — `agent_timezone` from `AGENT_TIMEZONE`, refused at load if unknown.
- `backend/app/routers/chat.py` — `turn_messages(message, timezone)`; typed items (see Risks).
- `backend/app/voice_session.py`, `backend/app/routers/voice.py` — the session takes the timezone
  and sends the moment frame when it opens.
- `.env.example` — `AGENT_TIMEZONE`.
- `.specify/constitution.md` — §8 second exception + amendments-table row.
- `CLAUDE.md` ↔ `AGENTS.md` (§6), `README.md` ↔ `README.pt-BR.md` (§7),
  `docs/how-it-works/voice-live-lifecycle.md`, `docs/REFERENCES.md`,
  `frontend/src/components/VoicePicker.tsx` (comment), `backend/tests/test_voice_choice.py`
  (docstring) — every place that called spec 017's exception *single* or *spent*.
- `specs/README.md` — index row.

## Contract / data model changes (constitution §4)

- **Source of truth for the sentence:** `current_moment_text`. The text item and the voice frame both
  call it; nothing else formats a date for the model.
- **Source of truth for the default timezone:** `DEFAULT_TIMEZONE`, read by `Settings`.
- `POST /chat`, `GET /config`, `AgentEvent` (§9) and `agent_core.yaml`: **unchanged**.

## i18n strings (constitution §7 — only if the project is bilingual)

n/a — no user-facing string. The sentence is for the model, in English like the instructions.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | the route hands the harness `[moment, user]`, the message unchanged | `backend/tests/test_current_moment.py` |
| AC2 | pinned clock → the exact sentence; default is `America/Sao_Paulo` | `ai/tests/test_current_moment.py` |
| AC3 | `load_settings` refuses an unknown zone, naming `AGENT_TIMEZONE` | `backend/tests/test_current_moment.py` |
| AC4 | one sentence, no registry tool name, no second-person instruction | `ai/tests/test_current_moment.py` |
| AC5 | a tool round trip: leg 1 opens with the moment, leg 2 is only outputs | `backend/tests/test_current_moment.py` |
| AC6 | a history holding a developer `SystemMessage` still reaches the model with the agent's instructions first | `ai/tests/test_hosted_graph.py` |
| AC7 | `negotiate` sends exactly two context items, the second the moment | `backend/tests/test_current_moment.py` |
| AC8 | already pinned: `ChatRequest` fields and `App.routing.test.tsx` | `backend/tests/test_current_moment.py` + existing |
| AC9 | live probe, recorded in `docs/REFERENCES.md` | manual |

## Risks / trade-offs

- **An untyped second input item is refused.** Observed 2026-11-14: `[{"role": "developer", …},
  {"role": "user", …}]` → `400 invalid_value`, `param: input[1]`, type `''`. With
  `"type": "message"` on both, accepted. So every item the route builds carries its type.
- **Hosted deploy order.** The deployed container has the old graph. A BFF sending the moment item
  to it before the redeploy would strip the hosted agent's instructions. The redeploy goes first; it
  is an outward action and waits for the owner.
- **The hosted endpoint has only ever been driven with a plain string.** Two messages switch
  `_as_input` to an item list. Unverified until the redeploy; probed then, recorded.
- **The voice frame is unverified live.** Same shape as spec 017's item, which the service accepts;
  confirmed on the first real call and recorded.
- **Items accumulate.** Each turn adds one `developer` item to the Foundry conversation (and the
  hosted history). That is a timestamp per turn — arguably useful — and a few dozen tokens.
