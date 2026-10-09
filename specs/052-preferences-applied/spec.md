# Spec: Preferences that reach the application

| | |
|---|---|
| **ID** | 052-preferences-applied |
| **Status** | done |
| **Author** | Copilot |
| **Date** | 2026-10-09 |

## Problem / motivation

Issue #29 found that spec 036's stored preferences do not reach the application.
Language is re-detected, reasoning opens regardless of the preference, and activity
ignores its default. The reading checkbox also promises a feature deliberately parked
by spec 008 on 2026-09-16. This spec reconciles that promise without rewriting history.

## Goals

- Existing language and reasoning choices affect the screen and survive reload.
- Defaults do not erase deliberate interaction with a turn or panel.
- The screen does not offer spoken-answer reading while that feature is parked.

## Non-goals

New options, redesign, mobile/focus work (#34), new requests, service changes, or
reactivating spoken answers. Voice Live remains independent and unchanged.

## User-facing behavior

Language chosen in the rail, preferences, or command palette is the same browser-kept
choice, used by the strings and the document language. Without a choice, detection stays.
Reasoning uses its existing default, but a reader's explicit open/close wins while the card is mounted.
Reopening a screen remounts its cards with the current default; no per-turn choice is persisted.
Activity stays visible inline; its unsupported expansion checkbox is absent.
The reading and activity checkboxes are absent in both languages; old stored values are retained
but do not authorize speech. This narrowly supersedes spec 036's reading and activity-control promises,
not its other preferences or the historical decision to park spec 008.

## Acceptance criteria

1. **AC1** — Choosing either language in Preferences changes application strings and document
   language immediately and after reload, regardless of browser language.
2. **AC2** — Rail and palette language choices persist through the same preference; without
   a stored language, browser detection remains unchanged.
3. **AC3** — Reasoning follows the preference in chat and comparison, immediately and after
   reload; deliberately toggling a turn overrides its default across subsequent renders.
4. **AC4** — No activity expansion checkbox is offered in either language. Activity remains
   visible inline; stored activity values do not open Traces or hide calls.
5. **AC5** — Neither App nor Preferences offers a reading checkbox in English or Portuguese;
   even a stored true reading value and configured speech issue no speech request. Other
   preference changes preserve that stored value.
6. **AC6** — With storage unavailable, choices still affect the current session without throwing.

## Contract / data impact

No network or AgentEvent change. Browser storage remains compatible and no data is deleted.
The existing preferences store remains the single source of truth. Old specs retain their
historical decisions; current docs and this spec record the reconciliation. No new strings.

## Open questions (clarify before planning)

None. The coordinator confirmed on 2026-10-09 that activity stays inline and has no
expansion semantics; do not reinterpret this preference as Traces or add a disclosure.

## Out of scope / deferred

Reactivating reading needs a separate deliberate decision; stored data is not authorization.
The coordinator resolved this conservatively on 2026-10-09 while the user was unavailable.
