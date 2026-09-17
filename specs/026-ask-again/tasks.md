# Tasks: Asking again — repeat and edit a question

> Red → green → refactor. Each implementation task is preceded by the test that fails first.

## The guard, first

- [x] **T1 — test**: no `send` is reachable from a turn's completion, failure or empty result (AC9)
- [x] **T2 — implement**: whatever T1 shows is needed (expected: nothing — the assertion is the point)

## Repeat

- [x] **T3 — test**: a finished turn's actions include repeat, with an accessible name (AC1)
- [x] **T4 — test**: it is offered on a stopped turn and on an errored one (AC7)
- [x] **T5 — test**: it is unavailable while streaming, and when the conversation is blocked (AC8, AC10)
- [x] **T6 — implement**: the control in `AnswerActions`, `RepeatIcon`
- [x] **T7 — test**: repeat sends the same text on the same `conversation_id`, appended (AC2, AC3)
- [x] **T8 — implement**: `send`'s optional origin; `repeatOf` on the message

## The mark

- [x] **T9 — test**: a repeated turn renders its mark, naming the agent that answered it (AC4)
- [x] **T10 — implement**: the mark in `Conversation`
- [x] **T11 — test**: the mark survives into the Markdown export
- [x] **T12 — implement**: `exportTurn.ts`

## Edit

- [x] **T13 — test**: edit places the question in the composer, focused, and sends nothing (AC5)
- [x] **T14 — implement**: the control on `MessageBubble`; the composer accepts a given value
- [x] **T15 — test**: sending from an edit is an ordinary send, original untouched (AC6)
- [x] **T16 — implement**: whatever T15 shows is needed

## Cross-cutting

- [x] **T17 — i18n**: the three strings in `en` + `pt` (AC11)
- [x] **T18 — styles**: the mark, and the edit control on a question
- [x] **T19 — docs**: `docs/how-it-works/function-call-round-trip.md` — a person repeating is not a loop

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean · tests green · build passes
- [x] Docs updated in the same change (§4)
- [x] All new user-facing text exists in `en` **and** `pt` (§7)
- [x] `spec.md` status updated to `done`
