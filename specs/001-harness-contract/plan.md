# Plan: Harness contract

| | |
|---|---|
| **Spec** | [spec.md](spec.md) |
| **Status** | done |

## Approach

Plain Python 3.12. `TypedDict` for the wire shape (these events become JSON on an SSE stream, so a
dict-shaped type is the honest representation), a small hand-written validator, and a Protocol for
the adapter. **No pydantic** — the whole schema is nine records; a dependency would cost more than it
saves, and `TypedDict` gives static checking for free.

The design splits into three pieces with different jobs:

| Piece | Job |
|---|---|
| **The types** | What an event *is*. Static, for editors and type checkers. |
| **`validate_event`** | Whether one object *is* a valid event. Per-event, cheap, called at the boundary. |
| **`check_stream`** | Whether a *sequence* is a valid stream. The invariants — AC4–AC8. |

The third is the interesting one. Per-event validation catches typos; the invariants catch the bugs
that actually hurt: a stream that never terminates, a tool call nobody answered, a `done` with no
response id for the trace drawer to use.

## Affected files

| File | What |
|---|---|
| `ai/pyproject.toml` | New — ruff + pytest config for the layer |
| `ai/harness/_shared/contract.py` | New — the contract (§9's source of truth) |
| `ai/harness/_shared/__init__.py`, `ai/harness/__init__.py` | New — packages |
| `ai/tests/conformance.py` | New — the adapter-agnostic suite (AC10) |
| `ai/tests/test_contract.py` | New — tests for the validator and the checker |
| `ai/tests/fixtures/recorded/README.md` | New — explains what lands here in spec 002 |

## Contract / data impact

**Creates** the §9 contract. Nothing consumes it yet, so there is no mirror to move — that obligation
starts with spec 002. `docs/how-it-works/streaming-events.md` stays a stub until spec 002 can
describe the real Foundry event names it maps from (§10: no guessing).

## i18n impact

None. The contract is protocol, not user-facing text — `type` values stay plain strings (§7).

## Test strategy

Genuine red → green: the tests are written first and fail on a missing module, then the contract makes
them pass.

| AC | Test |
|---|---|
| AC1 | `test_rejects_unknown_event_type`, `test_accepts_all_nine_types` |
| AC2 | `test_rejects_missing_required_field`, `test_rejects_unknown_field` |
| AC3 | `test_rejects_wrong_field_type` |
| AC4 | `test_stream_must_terminate`, `test_nothing_after_terminal`, `test_not_both_terminals` |
| AC5 | `test_unanswered_app_tool_call_fails`, `test_unanswered_is_ok_when_stream_errors`, `test_foundry_executed_call_needs_no_result` |
| AC6 | `test_duplicate_call_id_fails` |
| AC7 | `test_usage_at_most_once`, `test_usage_before_terminal` |
| AC8 | `test_done_requires_trace_ids`, `test_error_does_not_require_trace_ids` |
| AC9 | `test_protocol_isinstance_requires_all_methods` |
| AC10 | `test_conformance_suite_runs_against_any_adapter` |

### On fixtures — the honesty problem, stated plainly

Constitution §5 forbids fabricated data presented as real. A recorded fixture is a claim about how
Foundry behaves; there is no live agent yet, so **any "recording" written in this spec would be a
lie**, and worse, a lie that later shapes the normaliser.

So the split is:

- `ai/tests/fixtures/recorded/` — **empty**, with a README. Real recordings arrive in spec 002.
- The event sequences inside `test_contract.py` are **inline test inputs for the checker**, named as
  such. They assert what our validator does, not what Foundry does. That is ordinary unit testing,
  not a fixture, and the file says so.

The conformance suite (AC10) is built to take *any* adapter, so in spec 002 it runs against a replay
adapter fed by real recordings, and later against the LangGraph adapter — unedited. That is the whole
point of writing it now.

## Risks

- **Guessing the event set wrong.** The nine types come from the brief, not from observing a Foundry
  stream. Spec 002's spike (O-1) may reveal something the vocabulary can't express — for example
  MCP tool *approval* requests, if `require_approval: "never"` turns out to be rejected (O-3).
  Mitigation: that would be a §9 contract change with its own spec, which is exactly the process
  working rather than failing.
- **Over-constraining.** AC8 (a `done` stream must carry `trace_ids`) is a real constraint on every
  future adapter. It is deliberate — without a response id the trace drawer has nothing — but if a
  harness genuinely cannot produce one, the invariant is what forces that conversation into the open.
