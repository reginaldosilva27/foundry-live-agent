# Spec: Contextual inspection and honest comparison

| | |
|---|---|
| **ID** | 056-contextual-inspection-comparison |
| **Status** | done |
| **Author** | Copilot App |
| **Date** | 2026-10-10 |

## Problem / motivation
Issue #41: learners cannot distinguish absent recordings from an empty capture or filter,
and comparison controls can hide asymmetric context. Readiness must report observations,
not imply a healthy service merely because no turn is running.

## Goals
- Reachable, contextual inspection and distinct event states.
- Explicit local pair restart and safe agent selection during either stream.
- Observable readiness and truthful next actions, bilingual and keyboard accessible.

## Non-goals
No ranking, inference, new events, backend calls, storage schema changes, remote deletion,
paid probes, or claim that a hosted agent preserves multi-turn context.

## User-facing behavior
Events has a visible mouse/keyboard entry. The inspector names its turn and answering agent,
with previous/next controls. Missing retention, empty capture, and an empty filter have different
messages. Comparison explains independent contexts and asymmetric changes. Restart clears both
columns and their remote pointers, keeps chosen agents, and leaves single chat/history alone.
Restart and agent changes are blocked while either comparison stream runs; stop remains available.
Readiness reports loading configuration/listing, unavailable information, streaming, or idle.
Failures retain the reported error and offer manual next steps without diagnosing the service.
All prose ships in English and Portuguese, using existing focus, mobile and theme patterns.

## Acceptance criteria
1. **AC1** — Absent retained events, a captured empty stream, and an empty filter result render
   distinct messages, including restored turns. Changing turn clears stale payload/filter state.
2. **AC2** — Events opens by mouse and keyboard, identifies the selected turn and its agent,
   and navigates older/newer turns without making a request.
3. **AC3** — Comparison explains independent contexts without ranking or promising continuity;
   explicit restart clears both message arrays and pointers only, keeps agents and unrelated chat/history,
   and the next two requests carry no old conversation pointer.
4. **AC4** — While either comparison streams, restart and both agent changes are refused;
   stop is available. Normal chat selection remains unchanged after comparison settles.
5. **AC5** — Status reports observable loading, unavailable, streaming or idle facts, including
   comparison streams; failures show reported detail and truthful manual next actions.
6. **AC6** — Integration tests cover EN/PT, keyboard access, pair request independence and reset;
   credential-free replay browser verification covers themes and 320px, without fabricated service fixtures.

## Contract / data impact
None: AgentEvent, backend and storage contracts stay unchanged. Only ephemeral UI context and
local pair reset; there is no remote reset/delete/memory request. Existing normalized recordings
remain the replay evidence. No API integration is introduced (§8–§10).

## Open questions (clarify before planning)
None. Coordinator resolved reset scope and streaming locks before delegation. These are conservative
roadmap choices, not a user aesthetic selection. Spec 056 was globally reserved; 054 belongs to a
published sibling, 055 is the base, and 057 is reserved elsewhere. Hosted continuity remains unknown
(issue #35 / PR #50); local pointer reset is not a service guarantee.

## Out of scope / deferred
Hosted continuity repair; service health probes; remote deletion or history removal.
