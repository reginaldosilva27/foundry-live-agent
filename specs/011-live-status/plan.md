# Plan: The turn says what is happening right now

> The HOW. Written after `spec.md` reached `clarified` on 2026-09-15.

## Approach

**One pure function, `turnStatus(turn)`**, in `state/turn.ts` beside the reducer it reads. It
returns `{ kind: 'idle' | 'thinking' | 'calling' | 'answering' | 'settled', name? }`, and every
acceptance criterion is a case of it — which means the whole spec is unit-testable without
rendering anything. The component is then a `switch`.

It replaces the ad-hoc `pending()` predicate currently living inside `Conversation.tsx`: that
predicate answers "has nothing arrived yet", which is one of the five states this returns.

**Priority is part of the function, not of the caller**: a running call wins over reasoning, and
answer text wins over both. Encoding it once is what keeps the line honest when three things are
true at the same time.

## Affected files

- `frontend/src/state/turn.ts` — `turnStatus`.
- `frontend/src/state/turn.test.ts` — AC1-AC6, as pure cases.
- `frontend/src/panes/Conversation.tsx` — renders the line from it; drops `pending()`.
- `frontend/src/panes/Conversation.test.tsx` — the rendered line, and that it disappears.
- `frontend/src/i18n/strings.ts` — two keys (below).
- `frontend/src/styles/app.css` — the tool name in the line.
- `CHANGELOG.md`, `specs/README.md`.

## Contract / data model changes (constitution §4)

None.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `turn.thinking` | `Thinking` | `Pensando` |
| `turn.calling` | `Calling` | `Chamando` |

`turn.pending` ("The agent is working" / "O agente está trabalhando") is reused for the idle state.
The tool's name is a wire token and is not translated — it renders in mono, like everywhere else.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 — nothing yet | `turnStatus` of an empty streaming turn | `state/turn.test.ts` |
| AC2 — thinking | reasoning, no running call | `state/turn.test.ts` |
| AC3 — calling, by name | a call with no result | `state/turn.test.ts` |
| AC4 — back to thinking | the result arrives | `state/turn.test.ts` |
| AC5 — gone once text starts | text present | `state/turn.test.ts`, `panes/Conversation.test.tsx` |
| AC6 — gone once settled | status done / error | `state/turn.test.ts` |

## Risks / trade-offs

- Two tools called in one leg: the line names the first still running rather than listing both.
  Listing them is noise for the one line this spec is about, and the rows below already show every
  call.
