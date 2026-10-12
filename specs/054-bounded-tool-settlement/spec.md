# Spec: Bounded tool-output settlement

| | |
|---|---|
| **ID** | 054-bounded-tool-settlement |
| **Status** | done |
| **Author** | Reginaldo Silva / Copilot |
| **Date** | 2026-10-09 |

## Problem / motivation

Issue #31: the last permitted leg executes function tools and displays their results, but the
turn limit stops before those outputs travel upstream. A result on screen is not proof that
Foundry received it. An unbounded extension would replace this defect with an unbounded bill.

## Goals

- Submit every executed tool's output, including every call in the final execution leg.
- State a finite protocol budget and distinguish execution from upstream submission.
- Preserve ordinary turns and the platform's ownership of tool choice (§8).

## Non-goals

- Guaranteed completion of a pathological agent or recovery from transport failure/cancellation.
- New events, API calls, cancellation APIs, automatic retries, or fabricated recordings (§9–§10).

## User-facing behavior

Ordinary turns retain their existing events. A turn that previously stopped before sending its
last outputs may now finish normally. If Foundry asks for more tools after the execution budget,
the existing error event states that the new requests were not executed or answered. Existing
error presentation is unchanged; no new UI strings are introduced (§7).

## Acceptance criteria

1. **AC1** — With budget N=1 and a function call on the first leg, its executed output is submitted
   on the same conversation in a second leg; a completed answer terminates once with done.
2. **AC2** — Multiple calls in the last execution leg are each executed once and submitted together
   with exactly their call ids and outputs, without replaying the user message.
3. **AC3** — At most N+1 upstream requests occur: N execution legs plus one settlement leg. New
   requests on settlement are visible but never executed; one explicit turn_limit_exceeded error
   says their outputs were not supplied. No settlement request recursively earns another leg.
4. **AC4** — Ordinary turns, tool failures, summed usage, and stream failures preserve existing
   behavior. Submission failure is a terminal error, never claimed as successful delivery.
5. **AC5** — Existing recorded multi-tool turns replay with N=1, submitting the final outputs and
   ending in one done with usage accumulated across both legs. No recording is modified.
6. **AC6** — A non-positive execution budget makes no upstream request and ends in one limit error.

## Contract / data impact

The prompt adapter remains the single source of truth for its budget. max_turns still defaults to
8, but counts execution legs; the maximum request count becomes 9. The event set, POST /chat,
conversation shape, and tool schemas do not change. The harness README and round-trip tutorial
must document the bound and distinguish local results from upstream receipt (§4–§5).

## Open questions (clarify before planning)

None. The delegated task authorizes an explicit bounded-budget decision. Chosen: one settlement
leg after N execution legs, with no execution on settlement. Keeping a strict N-request cap would
refuse execution on the Nth leg instead; it would not settle the stated N=1 final-leg regression.

## Out of scope / deferred

Remote calls requested on settlement remain unanswered, explicitly reported. No verified cancel
operation is introduced to claim otherwise. Interrupted or failed submissions may also leave
remote pending calls; delivery cannot be promised when the transport fails.
