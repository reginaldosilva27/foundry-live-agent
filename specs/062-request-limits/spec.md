# Spec: Request limits on the two free-text inputs

| | |
|---|---|
| **ID** | 062-request-limits |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-10-15 |
| **Clarified** | 2026-10-15 — the owner delegated the open decisions to the assessment ("tome as decisões recomendadas") |

## Problem / motivation

The 2026-10-15 assessment sent a **300 KB** message to `POST /chat` on a live deployment. It was
accepted, forwarded to Foundry and billed: 17 seconds, tokens spent, no refusal anywhere. The BFF
has no sign-in (SECURITY.md), so the only thing between a script and the operator's model quota is
whatever the request schema refuses — and today it refuses only the empty string.
`POST /agents/{name}/definition/proposal` has the same shape: its `instructions` field is unbounded
and every request copies the definition tree and runs the validator on it.

The person in front of the composer should also learn about the bound **before** sending, not from
a generic "the BFF answered 422" card after it.

## Goals

- A message longer than a published bound is refused by the BFF **before** anything reaches
  Foundry.
- A proposed `instructions` text longer than its bound is refused before it is validated.
- The bound has **one** source of truth, the BFF, and the browser reads it from `GET /config`.
- The composer says, in `en` and `pt`, when the text is over the bound and does not send it.

## Non-goals

- **Rate limiting and concurrency caps.** They need an identity or a shared store to be honest
  across replicas; without sign-in, they belong to whatever the operator puts in front of the BFF
  (the same posture SECURITY.md already takes for authentication). Recorded there.
- Token counting. The bound is characters — what the composer can measure — not a claim about the
  model's context window (§10: no Foundry limit is asserted here).

## User-facing behavior

- Typing past the bound in the composer shows a short notice naming the bound; Send is disabled.
- A deployment whose `/config` publishes no bound (an older BFF) behaves as today.

## Acceptance criteria

1. **AC1** — Given `POST /chat` with a `message` longer than the bound, then the BFF answers 422
   and the stream factory is never called.
2. **AC2** — Given a `message` exactly at the bound, then it is accepted.
3. **AC3** — Given a proposal whose `instructions` is longer than its bound, then the BFF answers
   422 without running the validator.
4. **AC4** — `GET /config` carries `limits.message_chars`, equal to the bound the route enforces
   (one constant, asserted).
5. **AC5** — The About screen renders `limits` (the drift test covers the new key).
6. **AC6** — With text over the bound, the composer shows the notice in the interface language and
   Send is disabled; Enter does not send.
7. **AC7** — With no `limits` in `/config`, the composer neither shows the notice nor blocks.

## Contract / data impact

- `POST /chat` schema: `message` gains a maximum length. The three keys are unchanged.
- `GET /config` gains `limits: { message_chars, instructions_chars }` → `COVERED_CONFIG_KEYS`.
- Strings: one notice, `en` + `pt`.

## Open questions (clarify before planning)

- [x] The bound: **64,000 characters** for a message — a pasted log or Bicep file (spec 045's
  workaround) fits; a book does not. **32,000** for instructions. Both are this app's bounds, not
  claims about Foundry's.
- [x] Rate limiting: non-goal, operator's job (above).

## Out of scope / deferred

- Per-client throttling, once the app has an identity to throttle.
