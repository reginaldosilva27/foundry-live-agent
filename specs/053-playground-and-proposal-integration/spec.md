# Spec: Playground and proposal integration

| | |
|---|---|
| **ID** | 053-playground-and-proposal-integration |
| **Status** | done |
| **Date** | 2026-10-09 |

## Problem / motivation
Issue #30: asynchronous tools leave the playground without a selection, failures look empty,
and spec 041's proposal editor has no entrance from the agent detail.

## Goals / non-goals
Complete the existing surfaces, not new execution or editing capabilities. No generated argument
form, definition save, model request, backend change, speech or activity preferences.

## User-facing behavior
Loading, failure and empty are distinct. The first available tool is shown only without a valid
selection; a user's valid selection survives data changes. Agent detail reads proposal eligibility
from the BFF when configured, never from a frontend list of owned names. Only a readable build
 definition offers an editor. Drift and shared-core impact precede editing; output is a diff only.
All prose ships en/pt. Existing URLs remain unchanged.

## Acceptance criteria
1. **AC1** — Delayed tool arrival selects the first tool and shows its schema and raw JSON field.
2. **AC2** — Loading, HTTP/network failure and successful empty listing render distinct states.
3. **AC3** — A valid user selection survives listing refresh; an invalid selection falls back to the first available tool.
4. **AC4** — Enabled agent detail offers a proposal only after the BFF returns a readable definition; absent/false flag and non-owned agents offer no editor.
5. **AC5** — Entering the editor displays build provenance, drift and shared impact before editing, in en/pt with named controls.
6. **AC6** — Producing a diff sends only instructions to the proposal endpoint; no write, model or chat request occurs. Leaving/switching agents discards editor state.

## Contract / data impact
No API, AgentEvent or storage change. Existing definition and tools endpoints remain the truth.
Direct documentation: development workflow and function round-trip guide.

## Open questions (clarify)
None. Requirements confirmed by issue #30 and specs 041/042; no new product decision.
