# Spec: Replay isolation

| | |
|---|---|
| **ID** | 051-replay-isolation |
| **Status** | done |
| **Author** | Copilot |
| **Date** | 2026-10-09 |

## Problem / motivation
Issue #32: a replay playground inherits Tavily credentials and can spend money even though the
reader chose a no-Azure demo. Populated speech settings can also enable live services in a replay.

## Goals
- Reproducible local educational replay independent of inherited service credentials.
- Keep deliberate live-tool teaching on the separate live application path.

## Non-goals
Production hardening, new tools, hosted replay, provisioning, and a new setup framework.

## User-facing behavior
The existing replay banner remains. Search returns the existing `search_unavailable` result;
clock and local knowledge still execute. EN/PT setup documentation distinguishes replay from live.

## Acceptance criteria
1. **AC1** — With an inherited Tavily key, replay playground search returns `search_unavailable`
   without making a provider request; the parent's environment is unchanged.
2. **AC2** — A live application's search still uses its configured provider while replay search
   stays isolated, including concurrent requests. Clock and local knowledge still work in replay.
3. **AC3** — With inherited Speech/Voice settings and promotion enabled, replay reports speech
   and voice disabled and refuses promotion; recorded chat still satisfies AgentEvent.

## Contract / data impact
No AgentEvent or API shape change. Replay search is always unavailable; live search is unchanged.
The existing registry remains the single tool/provider binding. No new user-facing prose in APIs.

## Open questions (clarify before planning)
None. Issue #32 and the explicit execution request resolve the boundary: live teaching stays separate.

## Out of scope / deferred
Live Azure/hosted/voice validation belongs to the later roadmap lessons, not replay readiness.
