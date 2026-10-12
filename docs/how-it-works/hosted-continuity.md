# Hosted multi-turn continuity: unresolved investigation (#35)

**Investigated 2026-10-10. Continuity is not repaired by this change.** No live Azure request was
made. This records a regression and the service evidence needed before choosing a repair.

## The identifiers are not interchangeable

`POST /chat` accepts `message`, `conversation_id` and `agent`. The BFF passes the conversation
pointer to the adapter. The hosted stream factory instead reads `response_id` and, if present,
sends it as `previous_response_id`. The hosted normalizer returns a response ID, but returns a
conversation ID only when the upstream completion includes `conversation`.

Both committed hosted recordings (`langgraph-hosted-function-20260916.jsonl` and
`langgraph-hosted-learn-20260916.jsonl` under `ai/tests/fixtures/recorded/`) have the following
completion fields:

| Field | Recorded value | Meaning supported by the evidence |
|---|---|---|
| `id` | `caresp_0000` | Response identifier; emitted as `response_id` |
| `conversation` | absent | No conversation pointer to return to the browser |
| `previous_response_id` | absent | These recordings do not demonstrate a chained turn |
| `agent_session_id` | `id_0001` | Sandbox identifier; not emitted by the normalized contract |

These anonymized IDs are **not usable live handles**. The normalized stream emits `trace_ids` and
`done` with `response_id`, but no `conversation_id`. A browser using the available conversation
pointer therefore sends `null` on the next turn. Even a supplied `conversation_id` is currently
ignored by the hosted factory. Tool settlement *within one turn* does not establish continuity
*between turns*.

## What the current official documentation says

The [dated reference ledger](../REFERENCES.md#hosted-multi-turn-continuity-35--read-2026-10-10)
links the official sources. They distinguish three mechanisms:

- `previous_response_id` chains response history; it does not implicitly reuse a sandbox.
- `conversation` uses a platform-owned conversation created through the hosted OpenAI-compatible
  conversations endpoint, and can associate a stable sandbox.
- `agent_session_id` reuses sandbox/filesystem state; it is **not message-history continuity**.

The LangChain hosted-agent guide documents protocol-managed history replay without a checkpointer.
That does not prove this deployment's conversation creation response, binding or completion fields.
Adding app-owned history or a LangGraph checkpointer would not repair the BFF pointer mismatch and
would violate this application's platform-owned-state boundary.

## Reproduce locally, without Azure

From a development environment with the existing backend and AI dev dependencies installed:

```bash
cd backend
pytest -q tests/test_hosted_continuity.py
```

`test_actual_local_http_two_turn_replay` binds its own ephemeral loopback port, serves the actual
BFF with Uvicorn, and sends two sequential HTTP requests with `urllib.request`. Only the upstream
HTTP transport and credential acquisition are replaced: HTTPX returns the committed recording
and the credential is a local dummy. The helper is stopped and joined in `finally`; it does not
use port 5173 or leave a server running.

The assertions record this exchange:

| Request | BFF input | Outgoing hosted body |
|---|---|---|
| First | `{"message":"First loopback probe"}` | `{"input":"First loopback probe","stream":true}` |
| Second | `{"message":"Second loopback probe","conversation_id":null}` | `{"input":"Second loopback probe","stream":true}` |

Both HTTP responses must be 200 and both streams must pass the existing `AgentEvent` stream
validator. The first stream has `response_id: caresp_0000` and no conversation pointer. **The same
recorded answer is replayed twice regardless of the question.** This verifies request wiring and
identifier loss over local HTTP, not that Foundry remembers a prior turn.

The continuity expectation was run unmarked first and failed with
`AssertionError: First recorded hosted response has no conversation ID` (1 failed, 2 passed).
It is now a **strict expected failure**, explicitly tied to #35, alongside passing characterization
tests. Green test execution with that xfail is not a repaired continuity acceptance criterion; an
unexpected pass fails the suite so the marker must be revisited when evidence changes.

## Local validation results (2026-10-10)

Commands below used the worktree's Python development environment (`.venv/bin` on `PATH`):

| Command (from its layer directory) | Result |
|---|---|
| Backend: `pytest -q tests/test_hosted_continuity.py tests/test_harness_factory.py tests/test_chat_lifecycle.py` | 19 passed, 1 strict xfailed; includes the actual loopback HTTP exchange above |
| Backend: `ruff check . && ruff format --check . && pytest -q` | Lint/format passed; 305 passed, 1 strict xfailed |
| AI: `ruff check . && pytest -q` | Lint passed; 267 passed, 5 skipped |
| Frontend: `npm run lint && npm test && npm run build` | Passed; 1056 tests; existing ref-access lint warnings and bundle-size warnings |
| Infra: guarded Bicep build/lint | Clean skip: `infra/main.bicep` absent |

AI skips are two modules requiring optional hosted-agent dependencies and three gated real Tavily
integration tests. Frontend dependencies were restored with `npm ci` after lint reported missing
`oxlint`; dependency manifests were not changed. Installation reported 8 dependency audit findings
(2 low, 6 high), not addressed by this investigation. All owned HTTP helpers stopped. No public
schema, AgentEvent, user-facing strings or agent-guidance rules changed; no new spec is required
for this bug investigation. The unresolved continuity xfail remains explicitly outside the passed
characterization checks.

## Explicit unblock conditions

Before implementing a supported repair:

1. Obtain explicit permission for any metered/live Azure probes. None is authorized here.
2. Verify and record the current deployed hosted conversation creation request and returned ID,
   its binding on responses, and the completed SSE fields. Documentation establishes an option;
   the existing recordings do not verify it for this deployment.
3. Record two sequential BFF requests and a second answer that actually uses a first-turn fact,
   under the deployed host version. Record request pointers, returned identifiers and provenance,
   with secrets removed. Do not manufacture a completion carrying a conversation ID.
4. Resolve pointer behavior when the person changes agents; do not silently convert a response ID
   or sandbox ID into a conversation ID.
5. If a public request/response schema must change to carry a response pointer, write a new spec
   before code. Otherwise drive verified hosted conversation creation/forwarding with a failing
   regression, preserving the three-field chat request, nine events and platform-owned history.

No factory behavior, event schema, agent loop, model memory or checkpointer changes are included.
Issue #35 remains open; this investigation supplies the missing evidence boundary, not a fix.
