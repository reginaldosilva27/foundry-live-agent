# Spec: Unmapped event diagnostics

| | |
|---|---|
| **ID** | 057-unmapped-event-diagnostics |
| **Status** | done |
| **Author** | Copilot App |
| **Date** | 2026-10-10 |

## Problem / motivation
Offline mapping coverage cannot reveal unexpected event types arriving during a live lesson (#39).

## Goals
Bounded server diagnostics identify which normalizer encountered unknown types without exposing upstream content.

## Non-goals
No endpoint, UI, AgentEvent change, new Foundry shape handling, or voice transport change.

## User-facing behavior
No interface changes. Learning documentation explains diagnostics in English and Portuguese.

## Acceptance criteria
1. **AC1** — Prompt and hosted turns report unknown occurrences in one structured server-log summary, identifying the normalizer. No unknown occurrences means no summary.
2. **AC2** — Retain at most 16 distinct valid type spellings of at most 96 ASCII characters internally, expose only turn-local opaque aliases and counts. Malformed values use one invalid_type count; over-cap types use an omitted-occurrences count, not a distinct-type claim. Every counter saturates at 1,000,000 with an explicit counts_saturated flag. Report truncated when occurrences are omitted or counts saturate.
3. **AC3** — No raw type spelling, payload, prompt, arguments, outputs, identifiers, secrets, or exception representations enter these diagnostics. Aliases cannot identify a type globally; investigation requires separately reviewed recordings.
4. **AC4** — Handled and intentionally ignored types share the existing mapping vocabulary and produce no diagnostics. Known stream behavior and AgentEvent stay unchanged; malformed/unknown types are tolerated.
5. **AC5** — Emit at most once across prompt round-trip legs and on normal completion, failure, early generator close, or cancellation after observation, without changing resource ownership or settlement.
6. **AC6** — Tests clearly distinguish synthetic boundary probes from recorded service evidence; replay existing recordings unchanged. Learning docs explain offline coverage, legitimate ignored types, aliases and limits.

## Contract / data impact
AgentEvent, GET /config, configuration and browser types are unchanged. Logs are server-only; Python logging is the destination. Mappings remain the classification source of truth.

## Open questions (clarify before planning)
None. Coordinator approved logging, prompt/hosted scope and opaque aliases on 2026-10-10; privacy takes priority over raw spelling recovery. Spec 055/056 are reserved outside this base; 057 is globally reserved.

## Out of scope / deferred
Paid live probes, new verified shapes, voice diagnostics, and issue #35's unverified failure shape.
