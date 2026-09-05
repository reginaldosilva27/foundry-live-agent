# Plan: The BFF — streaming chat and the function-call round trip

| | |
|---|---|
| **Spec** | [spec.md](spec.md) |
| **Status** | done |

## Approach

```
backend/app/
  main.py            app factory, lifespan, harness selection at startup
  settings.py        env -> typed settings, fails fast on misconfiguration (§5)
  sse.py             AgentEvent -> text/event-stream frames
  tool_executor.py   registry lookup + execute + wrap failures as results
  turn.py            THE LOOP: stream -> execute -> submit -> stream -> ... -> terminal
  routers/
    chat.py  config.py  health.py
```

`turn.py` is the interesting file and deserves its own name rather than hiding in the router. It
owns the alternation between "the agent is talking" and "we owe the agent a tool output", and it is
where AC4/AC5/AC6 live.

### Correction: the loop lives in the adapter, not the router

The first draft of this plan put the tool-execution loop in the router. Writing it revealed why that
is wrong.

The §9 contract says a harness's stream **always terminates** in `done` or `error`, and the spec 001
conformance suite checks exactly that. If the router owned the loop, `stream_response` would yield a
*leg* — a fragment that ends without a terminal whenever the agent is waiting on tool output — and
the invariant would become unverifiable against an adapter. The conformance suite would only work on
scripted adapters, which is the opposite of the point.

So: **the adapter owns the loop and yields one complete turn.** Tool execution is *injected* as a
callable, so `ai/` still does not depend on `backend/`, and the LangGraph harness gets the same loop
shape for free. §8 is untouched — the adapter executes what Foundry asked for and still chooses
nothing.

`turn.py` therefore shrinks to what it should always have been: the transport-level guarantee that
even a harness which explodes produces a terminal `error` frame.

### The loop, and why it is shaped like this

```
adapter.stream_response()                     # one COMPLETE turn
  loop:
    stream one leg from Foundry
      ├── text / reasoning / mcp / usage ──── yield straight through
      └── function_call item ──────────────── yield tool_call(executor="app")
                                              execute via the injected executor
                                              yield tool_result
    if calls were collected: submit outputs, next leg
    else: yield the terminal event, stop
```

Three rules make the ten-minute hang impossible:

1. **Every collected call gets an output.** Success, tool exception, unknown tool name — all three
   produce a `function_call_output`. There is no path where a call is collected and not answered.
2. **Tool execution cannot raise out of the executor.** `tool_executor` catches everything and
   returns a result object. A tool that raises is a *result* describing the failure.
3. **The generator has a terminal `finally`.** If the harness itself explodes, the endpoint still
   emits `error` and closes. A client never sees a stream that merely stops.

A turn cap (default 8 harness round trips) stops a pathological loop from streaming forever. It emits
`error`, not silence.

### Where §8 is kept

`tool_executor.execute(name, arguments)` does exactly: `registry.get(name).call(**parsed)`. No
branching, no list of tools, no defaults per tool. The agent chose the name and the arguments; this
code resolves and runs. AC7's test reads `backend/app/` for any literal tool name, so the rule cannot
be broken quietly by someone adding a special case.

### The event normaliser, and its honest gap

`ai/harness/prompt-agent/events.py` maps raw Foundry stream events onto `AgentEvent`s through a
**declarative table**:

```python
MAPPINGS = (
    Mapping("response.mcp_list_tools.completed", ..., verified=True),   # observed 2026-09-04
    Mapping("response.output_text.delta",        ..., verified=False),  # NOT yet observed
    ...
)
```

`verified=True` means *this project saw that event come out of Foundry*. Everything else is marked
`False` and carries a comment saying where the shape came from. Two consequences:

- `GET /config` can report how much of the mapping is still unverified — honest rather than silent.
- A test asserts every `verified=True` entry appears in a recorded fixture, so the flag cannot rot.

Unrecognised events do not crash and are not silently dropped: they are counted, and the count is
surfaced. An event Foundry starts sending that we ignore is exactly the kind of thing that should be
visible.

### Testing without Azure

`PromptAgentAdapter` takes a `stream_factory` — a callable returning raw events. Production passes
one built on the OpenAI client; tests pass a replay. So the whole loop, including the round trip, is
testable against recorded or scripted raw streams with no credential, and the same code path runs in
production.

## Affected files

New: everything under `backend/`, plus `ai/harness/prompt-agent/{events,adapter}.py` and their tests.
Changed: `justfile` (already has `just backend`), `docs/how-it-works/*` at the end.

## Contract / data impact

Consumes §9 unchanged. SSE is a transport for it, not a second schema.

## i18n impact

None. The BFF emits protocol, not prose. Error *messages* are English technical strings; user-facing
copy is the frontend's job (§7).

## Test strategy

| AC | Test |
|---|---|
| AC1, AC2 | `test_chat_streams_valid_sse` — parse frames back, run `check_stream` |
| AC3 | `test_function_call_is_executed_and_submitted` |
| AC4 | `test_a_raising_tool_still_answers_the_call` |
| AC5 | `test_unknown_tool_name_answers_with_an_error` |
| AC6 | `test_harness_failure_emits_a_terminal_error` |
| AC7 | `test_no_backend_module_names_a_tool` — source inspection |
| AC8–AC11 | route tests + `test_langgraph_harness_fails_at_startup` |

AC4 is the one to write first and never delete. It is the difference between a visible failure and a
ten-minute silent hang.

## Risks

- **The unverified half of the mapping table.** Mitigated by the flag, the config report, and the
  fixture test — but until the spike completes, some mappings are inference from documented shapes.
  They are labelled, not hidden.
- **Turn cap masking a real loop.** 8 is generous for this agent; if it ever trips, that is a finding
  worth surfacing rather than raising the cap.
