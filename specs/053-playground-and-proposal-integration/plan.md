# Plan: Playground and proposal integration

## Approach
Track tool loading/failure in App and reject non-success HTTP responses. Derive the effective
selection from the current list, retaining the user's choice while valid. Read definition eligibility
on agent detail only with can_propose; cancellation prevents stale reads from crossing agents.
Mount the existing editor on an explicit detail action, keyed by agent. No ownership mirror.

## Affected files
- App.tsx and App.integration.test.tsx — integration and regressions.
- panes/Playground.tsx and tests — listing selection and states.
- panes/AgentDetail.tsx — proposal entry/read states and existing editor composition.
- i18n/strings.ts — bilingual listing and proposal read states.
- docs/development-workflow.md and docs/how-it-works/function-call-round-trip.md — entry and states.

## Contract / i18n impact
No contract/data changes. BFF definition endpoint determines ownership. New state prose is en/pt.

## Test strategy
| AC | Test |
|---|---|
| AC1–2 | App delayed tools, successful empty, HTTP and network failure |
| AC3 | Playground rerender preserves selection and falls back on removal |
| AC4 | App enabled, disabled/absent, not-owned and definition failure |
| AC5 | App bilingual editor provenance/drift/shared impact |
| AC6 | App proposal request and switching-agent/reset; existing editor tests |

## Risks / trade-offs
Eligibility costs a read per inspected agent only when enabled; no added backend field or name list.
Unmount cancellation must prevent stale responses. No Azure live calls; local recorded demo smoke.
