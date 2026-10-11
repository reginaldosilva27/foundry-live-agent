# Plan: Unmapped event diagnostics

## Approach
A shared collector owns bounded counters and logging. Normalizers classify using their existing MAPPINGS-derived known sets. Adapters own one collector per turn and flush in finally, across prompt legs; offline normalise helpers do likewise. Low-level convert without a collector stays silent.

## Affected files
- ai/harness/_shared/event_diagnostics.py — collector, constants, structured logging.
- ai/harness/{prompt_agent,langgraph}/{events,adapter}.py — conversion and ownership.
- ai/tests/test_event_diagnostics.py — synthetic boundaries, privacy and lifecycle.
- docs/how-it-works/streaming-events.md and learning-journey twins — explanation.
- specs/README.md — index.

## Contract / data model changes (constitution §4)
None. MAPPINGS remains classification source of truth; collector constants own limits. No new Foundry fact or verified shape.

## i18n strings (constitution §7)
No interface strings; mirror learning text in Portuguese.

## Test strategy (constitution §2 — TDD)
| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | summary and silence | ai/tests/test_event_diagnostics.py |
| AC2 | cap, malformed values, saturation | same |
| AC3 | secret sentinel absent from every log field | same |
| AC4 | mapping classification and recorded parity | same + existing recorded tests |
| AC5 | multi-leg, early close, cancellation, failure | same + resource lifecycle tests |
| AC6 | labeled synthetic probes, recordings and docs review | same + docs |

## Risks / trade-offs
Aliases deliberately lose global correlation. Limits bound memory/log size, not stream time. Process kill can lose summaries. Existing non-diagnostic errors unchanged. No paid probes.
