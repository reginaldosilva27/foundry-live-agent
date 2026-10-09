# Plan: Bounded tool-output settlement

## Approach

Keep the injected stream factory and existing function_call_output protocol unchanged. Snapshot
max_turns per turn; iterate over N execution legs and at most one settlement leg. Before executing
pending calls, check whether this is settlement; if so, emit the existing turn_limit_exceeded error
and return. Settlement with no calls follows the ordinary completion/usage path. Non-positive N
makes no request. This is a protocol loop driven by Foundry's requests, not an agent loop (§8).

## Affected files

- `ai/harness/prompt_agent/adapter.py` — finite execution/settlement budget.
- `ai/tests/test_prompt_adapter.py` — capture submissions; final-leg, multi-tool, failure and bound.
- `ai/tests/test_recorded_turn.py` — recorded two-tool replay at N=1 with submission assertions.
- `ai/harness/prompt_agent/README.md` — link the budget tutorial.
- `docs/how-it-works/function-call-round-trip.md` — honest guarantees and cap semantics.
- `specs/README.md` — spec index.

## Contract / data model changes (constitution §4)

No event/schema/SDK/API changes or new Foundry details. max_turns is an adapter property, not a
browser/deployment field; N execution legs now permit at most N+1 requests. Existing recorded
protocol and documentation remain authoritative; no new service probe is necessary (§10).

## i18n strings (constitution §7)

No new frontend prose. Errors remain diagnostic protocol messages in the existing error card.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1–AC2 | final execution leg, parameterised 1/3 legs and 1/2 calls | test_prompt_adapter.py |
| AC3 | persistent requests, settlement refuses execution | test_prompt_adapter.py |
| AC4 | settlement submission failure; existing happy/error/concurrency tests | test_prompt_adapter.py |
| AC5 | recorded multi-tool turn with max_turns=1 and captured submissions | test_recorded_turn.py |
| AC6 | zero/negative budget makes no factory calls | test_prompt_adapter.py |

## Risks / trade-offs

Maximum upstream calls increase from 8 to 9; documented, bounded, no extra call on ordinary turns.
Settlement can generate new requests: these remain pending upstream, with no local side effect and
an explicit error. Local tool_result is not a receipt. Cancellation/transport failure cannot ensure
submission; no retry/cancellation operation is guessed. Budget does not impose a time/event limit
on one upstream stream or a tool execution; that separate pre-existing concern is not this issue.
