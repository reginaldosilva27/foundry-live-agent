# Streaming events

A Foundry Responses stream becomes the nine-event `AgentEvent` vocabulary, which becomes SSE frames,
which become UI. Three hops, one schema.

```
Foundry raw stream ──normalise()──> AgentEvent ──format_event()──> SSE frame ──> React
                    (ai/harness/<harness>/events.py)      (backend/app/sse.py)
```

**Every mapping on this page is the *prompt agent's*.** Since spec 018 there are two harnesses, and
they normalise different raw streams: `ai/harness/langgraph/events.py` has its own table and its own
`verified` flags, and `GET /config` reports whichever one is running. The **nine-event vocabulary is
the same for both** — that is §9's whole claim, and a second harness is how it got tested.

Two things this page describes that the **current hosted normalizer/recordings do not produce**, both findings rather than
gaps (see [harness-comparison.md](../harness-comparison.md)):

- **`mcp_call`.** With a prompt agent Foundry is the MCP client; with a hosted agent the container
  is, so the same Learn search arrives as ordinary tool calls. **Nothing in the app may read a
  missing `mcp_call` as an error.**
- **`usage`.** A hosted turn's `response.completed` carries `usage: null`. The contract always
  allowed `usage` to be absent — `check_stream` forbids a second one, never requires a first — so a
  cost line must render "not reported", never zero. **This is why a hosted turn shows no cost
  estimate today** (spec 028): there are no token counts to price, and inventing one would be the
  §5 failure the whole feature is built around.

### Two fields of `usage` are breakdowns, not additions

`reasoning_tokens` is part of `output_tokens`, and `cached_input_tokens` is part of `input_tokens`.
Reading either as an addition produces a cost estimate that looks perfectly plausible and is
roughly double the truth, which is why the rule lives in the contract's own docstring and is pinned
by a test in `frontend/src/state/cost.test.ts`.

Both are measured, not assumed: every recorded turn in `ai/tests/fixtures/recorded/` satisfies
`total_tokens == input_tokens + output_tokens`, with the two details nested one level down. See
[REFERENCES.md](../REFERENCES.md#what-a-turn-costs--spec-028-read-and-verified-2026-09-18).

One spelling trap: the Responses API sends `input_tokens_details` (plural) and Voice Live sends
`input_token_details` (singular). Each normaliser reads its own.

And one event Foundry produces differently: a hosted `function_call` is a **report of a call the
container already made and answered**, arriving with its `function_call_output` in the same stream,
not a request waiting on the app.

## Why SSE and not WebSocket

The browser needs one-way streaming from a **POST**, and `EventSource` is GET-only. So the client
reads the response body with `fetch` + `ReadableStream`. WebSocket is reserved for the Voice Live
control channel, which genuinely is bidirectional.

One framing detail: SSE splits records on a blank line, so a payload containing one would break the
stream. Each event is encoded as **single-line JSON**, which sidesteps it — a newline inside a string
becomes an escape and never reaches the wire as a newline.

Every event is validated against the contract *before* framing. The browser cannot receive something
the frontend's types do not cover; a mismatch fails loudly in the backend instead of silently as a
blank card.

## The mapping — and what is still unverified

Constitution §10 forbids writing a Foundry integration from memory. The names below were **observed**
on 2026-09-15 against project `ai-admin2354ai223634534-project`, agent `spike-reasoning`, model
`gpt-5.5`, and the capture is committed at
[`ai/tests/fixtures/recorded/`](../../ai/tests/fixtures/recorded/). What is still inferred is the
failure half — nothing has gone wrong on the wire yet.

| Raw Foundry event | Becomes | Status |
|---|---|---|
| `response.created` · `response.in_progress` · `response.output_item.added` | *(ignored)* | **observed** |
| `response.content_part.added` · `.done` | *(ignored)* | **observed** |
| `response.mcp_list_tools.in_progress` · `.completed` | *(ignored — setup, not a call)* | **observed** |
| `response.mcp_call.in_progress` · `.completed` | *(ignored — see below)* | **observed** |
| `response.mcp_call_arguments.delta` · `.done` | *(ignored — partial)* | **observed** |
| `response.function_call_arguments.delta` · `.done` | *(ignored — partial)* | **observed** |
| `response.output_text.delta` | `text_delta` | **observed** |
| `response.output_text.done` | *(ignored — already streamed)* | **observed** |
| `response.reasoning_summary_text.delta` | `reasoning_summary` | **observed** |
| `response.reasoning_summary_part.added` | `reasoning_summary` (a paragraph break) | **observed** |
| `response.reasoning_summary_text.done` · `_part.done` | *(ignored)* | **observed** |
| `response.output_item.done` (a `function_call` item) | `tool_call` | **observed** |
| `response.output_item.done` (an `mcp_call` item) | `mcp_call` | **observed** |
| `response.completed` | `usage` + `trace_ids` + `done` | **observed** |
| `response.mcp_call.failed` | `mcp_call` with an `error` | inferred |
| `response.failed` · `response.incomplete` · `error` | `error` | inferred |

`GET /config` reports the split live:

```json
"event_mapping": { "total": 25, "verified": 21, "unverified": ["response.mcp_call.failed", …] }
```

Surfacing it in the API rather than a code comment is the point — a reader sees the gap without
reading the source. A test replays the recorded fixtures and asserts nothing is marked verified
unless it appears in one of them, so the flags cannot drift into optimism.

### Three things the recording contradicted

Each of these was a reasonable guess, and each was wrong. They are the argument for §10.

**1. `response.mcp_call.completed` carries no data.** The whole event is four fields:

```json
{"item_id": "mcp_0010", "output_index": 1, "sequence_number": 8, "type": "response.mcp_call.completed"}
```

No `server_label`, no `name`, no `output`. Building the MCP card from it — the obvious reading of
the name — produced a card labelled `unknown` with nothing in it. The complete record is the
`mcp_call` item on `response.output_item.done`, which carries the server, the arguments, the output
and an `error` field. Same story for `response.function_call_arguments.done`, which carries
`name: null`.

**2. Foundry completes the leg it is still waiting on.** It does not hold the stream open across a
function call. It emits the calls, sends `response.completed` *with that leg's usage*, and waits for
a new request carrying the outputs. So a turn with one tool round trip is **two** `response.completed`
events, and forwarding them straight through would put `done` in the middle of the turn and two
`usage` events in it — both forbidden by the contract. The adapter accumulates usage across legs and
holds `done` until the turn really ends.

**3. Reasoning summaries are configured on the agent, not on the request.** Sending
`reasoning={"summary": "auto"}` alongside an `agent_reference` is rejected:

```
400 invalid_payload — "Not allowed when agent is specified."  (param: reasoning)
```

The setting belongs to the agent definition (`PromptAgentDefinition.reasoning`), which is why
[`agent.yaml`](../../ai/harness/prompt_agent/agent.yaml) carries a `reasoning:` block. Without it
the model still *reasons* — the recorded turn spent 410 reasoning tokens and emitted five `reasoning`
output items — but every one of them carries `summary: []`, and the activity panel's reasoning card
stays empty forever. The two committed fixtures are the same agent with and without that one line.

And the block has to say `summary: detailed`, not `auto`. Observed 2026-09-16 on the agent's version
4, which carried `auto`: a seven-leg turn emitted `reasoning` items and not one line of summary,
because `auto` leaves the decision to the model and a leg whose only output is a function call has
little to summarise. Version 5 carries `detailed`.

Either way the app cannot rely on a summary arriving. That is why the activity panel numbers the
calls and shows the argument each one carried (spec 015): those come from `tool_call` and
`mcp_call`, which are always there, and they are what the turn has to say when the model says
nothing.

## A synchronous client is a streaming bug

The Foundry SDK's stream is **synchronous**: every `next()` is a blocking network read. Iterating it
directly inside the adapter's async generator blocks the event loop between events — and a blocked
loop cannot flush the frames the server has already been handed. The turn then arrives on the
browser as one burst at the end, which looks exactly like a model that does not stream.

Measured on 2026-09-15, straight from Foundry with no BFF in the path:

| event | count | first | last |
|---|---|---|---|
| `response.reasoning_summary_text.delta` | 76 | 5.37s | 6.72s |
| `response.output_text.delta` | 78 | 6.72s | 7.52s |

Foundry streams. Through the BFF, all of it reached the browser at 8.26s.

Reproduced with no Azure at all — a sync generator sleeping 200ms per event, behind the real app:

```
blocking (time.sleep)        all 10 frames at 2.05s
awaiting (asyncio.sleep)     0.20s  0.41s  0.61s  0.81s  …
```

So each `next()` now runs in a worker thread (`PromptAgentAdapter._stream_events`). The awaits are
sequential, so ordering is untouched; the loop is free to write each frame as it arrives.

## Mapping coverage versus runtime diagnostics (spec 057, #39)

`GET /config` reports **offline mapping evidence**, not runtime counts. Each normalizer's
`MAPPINGS` supplies the known vocabulary: handled types and deliberately ignored lifecycle,
partial-argument and already-streamed text types all belong to it. An unverified known type is
not an unknown type. Unknown **nested item kinds** on a known event are outside this diagnostic.
`unmapped_types()` remains an offline analysis helper for separately reviewed, trusted recordings;
it exposes spellings and is not the live logging path.

Prompt and hosted adapters now collect unknown **top-level type** occurrences server-side and
emit at most **one warning per turn**, in `finally` after completion, failure, cancellation or
explicit generator close. Prompt legs share one budget, including settlement. No unknown types
means no warning. Whole-stream `normalise()` helpers use the same policy; low-level `convert()`
without a collector stays silent. Voice uses a different transport and is unchanged.

The logger `harness._shared.event_diagnostics` supplies a `diagnostic` record attribute and the
same content in its message. Operators use their existing Python logging sink; there is no new
endpoint, configuration flag, browser event or `AgentEvent`. Example **synthetic** summary:

```json
{"normalizer":"prompt_agent","types":{"unmapped_type_1":3},"invalid_type":1,"omitted_occurrences":2,"truncated":true,"counts_saturated":false}
```

The exact policy lives in `ai/harness/_shared/event_diagnostics.py`:

- Retain at most **16 distinct spellings** internally, each **1–96 ASCII characters** matching
  `[a-z][a-z0-9_]*(?:\\.[a-z][a-z0-9_]*)*`. Check length before regex/hash. No raw value is stringified.
- Emit **only opaque, turn-local aliases** and counts. Even a valid spelling could contain a secret;
  aliases are not globally identifiable types, hashes, or recoverable spellings. Names are cleared
  on flush. Never log payloads, prompts, arguments, outputs, identifiers or exception representations.
- Malformed, missing, non-string or oversized types increment one `invalid_type` counter, retaining
  no name. A seventeenth valid type increments `omitted_occurrences` every time it occurs; that is
  **not a distinct-type count**. Retained types continue accumulating after the cap.
- Each counter saturates at **1,000,000**. Further increments set `counts_saturated`; `truncated`
  means omitted occurrences or saturated counters. Invalid classification alone does not truncate
  its occurrence count. All counts describe only events this consumer actually read.

These limits bound memory and log volume per turn, not total stream duration or aggregate traffic
across turns. A hard process kill can lose the summary. A failed logging handler is suppressed so
it cannot change cleanup or settlement. No upstream cancellation is introduced. These warnings
are **drift signals, not evidence of a new service shape**: recovering the real type requires
separately reviewed recordings and §10 evidence before implementing a handler. The boundary tests
in `ai/tests/test_event_diagnostics.py` are explicitly synthetic, not new Foundry recordings.

## What a turn looks like on the wire

Illustrative contract payloads, not a recorded run; real fixtures are linked above.

```
event: reasoning_summary
data: {"type":"reasoning_summary","text":"The user asked for the time."}

event: tool_call
data: {"type":"tool_call","call_id":"call_1","name":"get_current_datetime","arguments":"{…}","executor":"app"}

event: tool_result
data: {"type":"tool_result","call_id":"call_1","name":"get_current_datetime","output":"{…}","duration_ms":3}

event: text_delta
data: {"type":"text_delta","text":"It is 17:00 in São Paulo."}

event: usage
data: {"type":"usage","input_tokens":312,"output_tokens":96,"reasoning_tokens":68,"cached_input_tokens":128}

event: trace_ids
data: {"type":"trace_ids","response_id":"resp_1"}

event: done
data: {"type":"done","response_id":"resp_1"}
```

The stream always ends in `done` or `error`. Never silence — that is
[`check_stream`](../../ai/harness/_shared/README.md)'s first invariant, and the router enforces it a
second time at the transport layer.

## Stopping a turn (spec 023)

A reader can stop a turn. It is worth being precise about what that does, because the obvious
reading of it is wrong.

**What stops is the browser.** The frontend holds an `AbortController` for the turn in flight;
pressing stop aborts the `fetch`, which errors the response body and discards anything still queued
in it. The turn is marked `stopped` — a fourth turn status beside `streaming`, `done` and `error` —
and keeps every event it had already received.

**What does not stop is the run.** Foundry is not told anything. There is no cancellation in this
design: no endpoint for it has been read from a doc (§10), so none is called, and the app does not
pretend otherwise. The line under a stopped turn says exactly that much — the answer was interrupted
here, and the run may still be finishing — and deliberately says nothing about tokens or cost,
because nobody has measured what a run does after the browser stops listening (§5).

**The stream's own invariant is unaffected.** `check_stream` still requires every stream to end in
`done` or `error`; a stopped turn is not a stream that ended without one, it is a stream the client
stopped reading. The BFF sees a dropped connection and closes its local stream; that is not a
Foundry run-cancellation request.

Two consequences worth knowing:

- A stopped turn does not end the conversation. The next message carries the same
  `conversation_id`, because that is Foundry's state and this app does not own it (§8).
- A stopped turn is **not** read aloud when spoken answers are on. Speaking the half of an answer
  somebody just interrupted is the opposite of what they asked for.

### Local resource lifecycle and its limits (#33)

Both adapters use `harness/_shared/streaming.py` for per-leg synchronous iteration. Factory
creation and reads run off the event loop. Success, read failure, a terminal error and explicit
consumer close release an iterator's `close()` where it exists. The prompt factory also closes
the SDK response stream hidden behind its generator; the hosted factory unwinds its existing
HTTP response/client contexts. Cleanup failures are logged, not emitted as a second terminal
event. The SSE router explicitly closes its harness generator and never tries to yield a terminal
frame during cancellation or `GeneratorExit`.

Cleanup is serialized with reads: closing a Python generator while `next()` runs would itself
fail. Cancellation stops awaiting the read, not the worker thread. A cleanup worker therefore
waits until that read returns, then closes the iterator without requesting another event. If the
read never returns, cleanup cannot finish; a blocked worker still occupies threadpool capacity.
Cancelling during a function call likewise leaves its synchronous execution running, but does
not submit its output or start a later leg. Delivery can be interrupted, including on spec 054's
reserved settlement leg; local cleanup is no claim that Foundry received an answer or stopped
billing. No upstream cancellation API is called.

The search tool closes each HTTP client it creates, including on transport, status and parsing
failures. An injected client stays open: its caller owns its lifetime. If a tool is already
running when the stream is cancelled, its owned client closes when that synchronous call exits.

**Timeout is not a turn deadline.** The hosted factory's `httpx.Client(timeout=300.0)` sets HTTP
operation timeouts, not a total wall-clock budget. Repeated reads and multiple execution legs
can exceed 300 seconds; a blocked tool has its own timeout. There is no total-turn deadline in
this patch, nor a guarantee of immediate socket cleanup, stopped metering, or responsiveness
under a saturated worker pool. A new deadline would require a clarified spec and a documented
bound, not relabelling this timeout.

`ai/tests/test_resource_lifecycle.py` and `backend/tests/test_chat_lifecycle.py` are local,
close-observable probes, not Foundry recordings. They check owned/injected cleanup, normal/error
termination, explicit close, cancellation during a blocked read/tool and event-loop progress.
Voice cleanup remains the existing activity-stream reaping path, tested separately by
`backend/tests/test_voice_reaping.py`; no voice protocol or deployment behavior changes here.

## What an answer consulted (spec 034)

The agent is told to cite, and does — in prose. The events already carry the evidence, so the
**Sources** strip under a settled turn is built from `mcp_call` and `tool_result`, never from the
answer text. Selecting one opens that call's payload in the trace reader; it is an index into
evidence the app already renders, not a second copy of it.

**The reading rule is per tool, and that is measured rather than assumed:**

| Tool | Where the URL is |
|---|---|
| `microsoft_learn` | `contentUrl` — inside a string holding **two concatenated JSON documents**, so `JSON.parse` on the whole thing throws |
| `search_web` | `url`, in `{query, results[]}` |
| `lookup_knowledge` | none — `source`, a path inside this repository, rendered as a path and never as a link |

The tempting simplification, scanning the output string for URLs, is wrong for all three. Against
the real Learn payload it finds nothing at the top level and pulls dozens of incidental links out
of the Markdown in `content`, listing pages the agent never opened as though it had (§5). The tests
are driven by the recorded payloads for exactly that reason.

## Watching it happen (spec 038)

The event inspector is the live counterpart to this page: the nine types, arriving in order, with
the mapping report above them. It is opened from the command palette and is closed by default — a
developer surface, out of the way of anyone using the app to talk to an agent.

Three properties are the point:

- **The events are retained whether or not it is open.** Opening it mid-turn shows the whole turn,
  not the remainder of one — which matters because the turn somebody opens it for is usually the
  one that just went wrong. Each turn keeps at most 2000 normalized wire payloads and says so if it hits the cap.
- **They are retained as received from the BFF.** `unknown[]`, not `AgentEvent[]`, avoids a
  frontend assumption hiding a wire payload. These are normalized SSE payloads, not upstream
  Foundry frames: backend contract validation still applies. The inspector cannot discover an
  upstream event the normalizer never emitted.
- **The filter's vocabulary comes from `GET /config`.** A list of type names in the frontend would
  be a fourth place the contract is written down, after `contract.py`, its parity-tested mirror in
  `types/events.ts`, and the config.

A turn replayed from a voice session or restored from this browser's history has **no** events —
absent, not empty, because it never came from the stream.

