# `_shared/` — the harness contract

Everything every harness shares. `contract.py` is the source of truth for **constitution §9**.

## The event vocabulary

Nine types, closed. A harness emits only these; the BFF and the frontend read only these.

| Event | Carries | Notes |
|---|---|---|
| `reasoning_summary` | `text` | A fragment of summarised chain of thought |
| `text_delta` | `text` | A fragment of the visible answer |
| `tool_call` | `call_id · name · arguments · executor` | **`executor` is the important field** — see below |
| `tool_result` | `call_id · name · output` (+ `duration_ms`, `error`) | Keyed back to its call |
| `mcp_call` | `server_label · name · arguments` (+ `output`, `error`) | Runs in Foundry, not here |
| `usage` | `input_tokens · output_tokens` (+ `reasoning_tokens`) | At most one per stream |
| `trace_ids` | `response_id` (+ `conversation_id`, `otel_trace_id`, `gateway_request_id`) | What the trace drawer queries |
| `error` | `message` (+ `code`) | Terminal |
| `done` | (+ `response_id`) | Terminal |

### `executor` is constitution §8 in the type system

`tool_call.executor` is `"app"` or `"foundry"`. `"app"` means **we** must run it and answer;
`"foundry"` means Foundry runs it and we only observe. Note what the field does *not* let anyone do:
choose which tool runs. The app executes; it never decides.

### `arguments` is a raw string, deliberately

Foundry emits arguments as a JSON string, delivered in fragments while streaming. Parsing at the
contract boundary would force it to decide what a half-arrived argument means. Consumers parse once
the value is complete.

## Two levels of checking

```python
validate_event(obj)  # is this one object a valid event?   -> ContractError
check_stream(events)  # is this sequence a valid stream?    -> ConformanceError
```

`check_stream` is where the real bugs get caught. Its invariants:

1. **Exactly one terminal event** (`done` or `error`), and nothing after it.
2. **Every `executor="app"` call is answered** before `done` — unless the stream ends in `error`.
3. No `call_id` on two `tool_call`s.
4. `usage` at most once.
5. A `done` stream carries a `trace_ids` with a non-empty `response_id`.

Invariant 2 is the one that earns its keep. Foundry emits a function call and then **waits**; if
nothing answers, the run hangs until it expires ten minutes later, and from the UI the stream simply
stops. Without this check that failure is silent. With it, it is a failing test.

## The adapter

```python
@runtime_checkable
class HarnessAdapter(Protocol):
    def stream_response(self, messages, conversation_state) -> AsyncIterator[AgentEvent]: ...
    async def submit_tool_output(self, call_id, output, conversation_state) -> None: ...
    def voice_attachment_params(self) -> VoiceAttachment: ...
```

Narrow on purpose. It exposes no model, no tool list, and no way for a caller to influence which
tool runs — that would put the agent loop back in the app.

## Proving a new harness

Don't edit the tests. Pass the adapter to the suite:

```python
from tests.conformance import run_conformance

await run_conformance(MyNewAdapter(...))
```

That is why the contract was built before any harness existed.

## Changing this file

It is a §9 contract change: it needs its own spec, and it moves every consumer — adapters,
`backend/app/sse.py`, the frontend event types, the recorded fixtures and
`docs/how-it-works/streaming-events.md` — in the **same** change.
