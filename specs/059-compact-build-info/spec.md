# Spec: Compact build information

| | |
|---|---|
| **ID** | 059-compact-build-info |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-10-12 |

## Problem / motivation

The replay banner and technical sidebar footer dominate a quiet chat. The user asked to move
these facts into an information icon and keep voice only in the chat composer.

## Goals

- Disclose build facts on demand without concealing that a demo is a replay.
- Remove redundant header voice chrome without changing composer voice behavior.

## Non-goals

New backend behavior, recordings, contracts, storage, palette changes or live Azure calls.

## User-facing behavior

An information icon is reachable on every screen. Beside it, a compact persistent Replay badge
labels a demo even with the disclosure closed. The disclosure contains the same recording date,
replay explanation, recording chooser, model, gateway routing and SSE transport facts. Its close
control and Escape return focus to the opener; keyboard focus stays inside while open. All labels
ship in English and Portuguese. The header has Events and Traces, but not Voice; the composer
retains its existing voice entry and configuration-dependent availability.

This explicitly revisits spec 050 AC5's non-dismissable **banner** design: the persistent label
cannot be dismissed, while details may close. Spec 050 AC6/AC7's chooser and explanation remain.
Constitution §5's obvious demo label remains visible on every screen, never hidden only in info.

## Acceptance criteria

1. **AC1** — Closed info shows no large replay banner or model/gateway/SSE footer prose. A demo
   always shows its Replay badge on every screen; a live build never shows one.
2. **AC2** — Opening info shows the unchanged replay explanation/date and complete recording
   catalogue. Choosing a recording still selects the next replay; unknown codes stay verbatim.
3. **AC3** — Info shows model, gateway and SSE facts from their existing sources. Loading and
   unavailable configuration remain distinct; opening info makes no additional request.
4. **AC4** — The named info control works by mouse and keyboard; the dialog traps focus and
   closes by its named control or Escape, restoring opener focus. EN/PT both work.
5. **AC5** — Header Voice is absent while composer voice remains, with unchanged availability.
   Events/Traces and navigation, tools, preferences and language controls remain reachable.
6. **AC6** — Closed and open info fit 320px, 390px and 1440px, light and dark, without page
   overflow. The persistent demo badge remains visible at every width.

## Contract / data impact

No public API, AgentEvent, storage or config changes. Existing demo state/catalogue and config
remain the only sources; bilingual strings and related documentation move with the UI (§4/§7).

## Open questions (clarify before planning)

None. User-directed scope and coordinator-confirmed persistent label resolve the design.

## Out of scope / deferred

Live voice validation and hosted continuity guarantees remain outside this UI change.
