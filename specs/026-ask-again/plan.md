# Plan: Asking again — repeat and edit a question

> The HOW. Written after `spec.md` is `clarified`.

## Approach

Small, and the smallness is the point: repeating a question is *sending that text again*, so the
implementation has to be one call into the path a typed message already takes. Anything cleverer
would be a second way to start a turn, and a second way is how "the app never asks on its own"
stops being true.

**Repeat** joins `AnswerActions` beside copy, download and trace. It calls the same `onSend` the
composer calls, with the question `Conversation` already resolves for the export (`questionFor`).
That function exists and is exercised; reusing it means the exported question and the repeated
question can never disagree (§4).

**Edit** sits on the question rather than the answer, so `MessageBubble` grows a control. It does not
send: it puts the text in the composer and focuses it — which is the `focusComposer` command spec 025
already built, through the ref `App` already holds. Nothing new is needed to move focus.

**The mark.** A repeated turn needs to say so, because both turns stay on screen and otherwise the
second reads as a second question. The message gains `repeatOf`, and the agent that answered it —
which may not be the agent that answered the first, and saying so is the whole point of naming it.

The honest constraint: `AgentMessage` is what `useAgentStream` mints, so `send` grows an optional
`repeat` argument carrying the origin turn's id and the agent. That is the only shape change, and it
travels nowhere: the `POST /chat` body stays `message · conversation_id · agent`, asserted by spec
021's existing test.

**AC9 is the load-bearing test and it is a structural one**, not a behavioural one. "Nothing repeats
without a person acting" cannot be proven by a test that does not repeat; it is proven by scanning
the sources for a `send(` call reachable from a turn's completion or failure. The scan is crude and
that is acceptable — its job is to fail loudly if someone later adds an automatic retry, which is
the one regression this spec must not allow.

**Rejected:** a `repeat` that re-posts the stored events (it would be a screenshot, not a question);
branching the conversation (spec non-goal, and it forks state Foundry owns); an "edit in place" that
rewrites the original message, which would make the screen disagree with the conversation Foundry
holds.

## Affected files

- `frontend/src/hooks/useAgentStream.ts` — `send` takes an optional origin; `AgentMessage` carries
  `repeatOf`.
- `frontend/src/components/AnswerActions.tsx` — the repeat control, and the blocked reason.
- `frontend/src/components/MessageBubble.tsx` — the edit control.
- `frontend/src/panes/Conversation.tsx` — passes the question down, renders the repeat mark, and
  wires edit to the composer.
- `frontend/src/App.tsx` — `onEdit` fills and focuses the composer; passes `blocked` down.
- `frontend/src/panes/Composer.tsx` — accepts a value it can be given from outside.
- `frontend/src/components/Icon.tsx` — `RepeatIcon` (`PencilIcon` already exists, from the history
  rename).
- `frontend/src/i18n/strings.ts` — the strings below.
- `frontend/src/styles/app.css` — the mark, and the edit control on a question.
- `docs/how-it-works/function-call-round-trip.md` — why a person repeating is not the app looping.

## Contract / data model changes (constitution §4)

**No BFF change.** No endpoint, no request field, no event (§9). A repeat is an ordinary
`POST /chat`, and the request body is unchanged — spec 021's three-field assertion still holds and is
extended to run after a repeat.

`repeatOf` is frontend message state. It is stored with the conversation (spec 021 keeps `messages`
as they were drawn) and carried into the Markdown export, because an export that omits "this was
asked twice" describes a conversation that did not happen.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `answer.repeat` | Ask again | Perguntar de novo |
| `question.edit` | Edit this question | Editar esta pergunta |
| `turn.repeatOf` | Asked again · {agent} | Perguntado de novo · {agent} |

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | a finished turn's actions include repeat, with an accessible name | `components/AnswerActions.test.tsx` |
| AC2 | repeat sends the same text on the same `conversation_id` | `App.repeat.test.tsx` |
| AC3 | the repeated turn is appended; the original stays rendered | `App.repeat.test.tsx` |
| AC4 | the repeated turn renders its mark, naming the answering agent | `panes/Conversation.test.tsx` |
| AC5 | edit places the question in the composer, focused, sending nothing | `App.repeat.test.tsx` |
| AC6 | sending from an edit is an ordinary send, original untouched | `App.repeat.test.tsx` |
| AC7 | repeat is offered on a stopped turn and on an errored one | `components/AnswerActions.test.tsx` |
| AC8 | a blocked conversation renders both controls unavailable with its reason | `components/AnswerActions.test.tsx`, `App.repeat.test.tsx` |
| AC9 | no `send` is reachable from a turn's completion, failure or empty result | `state/noAutoRepeat.test.ts` (source scan) |
| AC10 | both controls are unavailable while streaming | `components/AnswerActions.test.tsx` |
| AC11 | en + pt; both controls are SVG icons | `i18n/strings.test.ts`, `brand.test.ts` (existing) |

## Risks / trade-offs

- **AC9's scan is crude.** It cannot prove the absence of automatic sending in general; it can fail
  loudly when someone adds the obvious version of it. Stated here so nobody reads a green scan as a
  proof it is not.
- **Two turns for one question** is the honest rendering and it makes the column longer. The
  alternative — replacing the first — would make the screen disagree with the conversation Foundry
  holds, which is worse.
- **`send` grows an argument.** Every caller is in this repository and the compiler finds them, but
  it is the second change to that signature in three specs (019 added `agent`). If a third arrives,
  it becomes an options object rather than a fourth positional.
