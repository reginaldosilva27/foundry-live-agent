# The function-call round trip

**Foundry emits a function call and then stops.** If nothing answers, the run hangs until it expires
ten minutes later — and from the browser that looks like the stream simply stopped.

The normal path below answers every executed call. A bounded turn can still leave new remote
requests pending, and a failed transport cannot guarantee delivery; those limits are explicit.

## The shape of a turn

```
browser ──POST /chat──> BFF ──Responses API──> Foundry agent
                                                    │
                                       "call get_current_datetime"
                                                    │  (and then it waits)
                         BFF: registry.get(name).call(**args)
                                                    │
                         ──function_call_output──>  │
                                                    │
                                              …answer streams…
```

The BFF looks the name up in a registry and runs it. It does not decide *which* tool to call, in
what order, or whether to call one at all — that is Foundry's job, and keeping it there is
[constitution §8](../../.specify/constitution.md).

## Both legs name one conversation

The second leg carries **only** `function_call_output` items. What ties it to the leg that emitted
the call is the conversation:

```python
# backend/app/harness_factory.py
openai.responses.create(input=inputs, conversation=conversation_id, stream=True, extra_body=agent_ref)
```

Leave it out and Foundry has nothing to match the output against:

```
400 — No tool call found for function call output with call_id call_2BQ8UX8kLM9iJk4TfRSflRyj
```

Observed 2026-09-15, and it surfaces *after* the tool card has rendered green — the call ran here,
it was the answer that had nowhere to land. A turn that arrives without a conversation gets one
created before the first leg; the id travels out on `trace_ids`, and the browser sends it with the
next turn, which is also how the conversation remembers anything.

## The event pair the UI sees

One call produces two contract events:

```json
{"type":"tool_call","call_id":"call_1","name":"get_current_datetime",
 "arguments":"{\"timezone\":\"America/Sao_Paulo\"}","executor":"app"}
{"type":"tool_result","call_id":"call_1","name":"get_current_datetime",
 "output":"{\"iso\":\"…\"}","duration_ms":3}
```

`executor` is the field worth staring at. `"app"` means **we** must answer; `"foundry"` means Foundry
ran it itself and we are only watching. The UI renders the two differently, because they are not the
same kind of event.

**Where each half is drawn.** The chat shows one line per call — the name, the executor tag, the
status, the duration. The trace panel lists the same rows for the turn it is showing, and pressing
one opens a centred reader with that call's arguments and result, indented if they are JSON and
untouched if they are not (specs 009 and 010). An MCP search returns a page of documentation, and rendering it between the question
and the answer buried the answer. The fact belongs next to the prose; the payload belongs where a
run is inspected. During a *voice* session there is no trace panel, so the overlay still shows the
whole card.

## Four guarantees

Implemented across `ai/harness/prompt_agent/adapter.py`, `backend/app/tool_executor.py` and
`backend/app/routers/chat.py`:

| # | Guarantee | Where |
|---|---|---|
| 1 | **Every executed call's output gets a submission leg** — success, exception, unknown name, bad JSON | `tool_executor.execute` never raises; the adapter reserves the final submission |
| 2 | **A tool that raises produces a result, not a crash** | `execute` catches everything and returns `{"error": …}` |
| 3 | **Stream failures terminate explicitly** | the adapter has a terminal `except`; the router has a second one at the transport layer; neither is a timeout for a stalled upstream |
| 4 | **The loop is capped** (8 execution legs + at most 1 settlement leg) | new tool requests on settlement end in `turn_limit_exceeded`, without execution |

### The budget includes settling the last outputs (spec 054)

`PromptAgentAdapter.max_turns` counts legs allowed to execute function tools; its default remains
8. If that last leg asks for tools, their outputs travel together in **one more request**, with the
same conversation and only `function_call_output` inputs. The adapter consumes that settlement
leg normally: if it completes without new tool requests, the turn emits its summed usage and one
`done`. There are at most **N+1 upstream requests** (9 by default); ordinary shorter turns make no
extra request. A non-positive budget sends no request and emits the limit error.

If settlement requests more tools, those calls are shown but **not executed or answered**; the
existing `turn_limit_exceeded` error says so. They remain pending in Foundry. This is deliberately
not a recursive extension, a guessed cancellation API, or a guarantee that a pathological agent
finishes. A transport failure on submission emits `harness_error`; a local `tool_result` proves
execution, **not upstream receipt**. Cancellation can likewise interrupt delivery. The budget
bounds requests, not the duration or event count of an individual leg or tool.

Regressions capture actual factory inputs, not just paired UI events: the final multi-tool leg's
outputs must be submitted once, together, on the original conversation. The recorded two-tool turn
also replays at `max_turns=1` through the unchanged normalizer.

Guarantee 2 is the counter-intuitive one. Returning `{"error": "tool_failed", …}` to the model looks
like swallowing a bug. It is the opposite: the agent receives the failure, can tell the user what
broke, and the run completes. Letting the exception escape would abandon the call and hang the run.

The contract encodes this as an invariant, so it is a failing test rather than a code review note:

```python
# ai/harness/_shared/contract.py — check_stream
"app-executed tool call(s) never answered: 'call_1'. Foundry waits for the output;
 an unanswered call hangs the run until it expires."
```

## Seeing it fail properly

With the reference environment's gateway misconfigured, a real request returns:

```
event: error
data: {"type":"error","message":"APIError: Resource not found ModelGateway response: …",
       "code":"harness_error"}
```

A terminal frame, not a hung connection. That is guarantee 3 doing its job on a real failure.

## Asking again is not the app looping (spec 026)

The chat has a **repeat** control, and it looks like the thing constitution §8 forbids. It is worth
being precise about why it is not.

§8 is about the **app** deciding: re-prompting the model, looping on its output, choosing what to
send next. A person pressing repeat is a person asking again, and the app carries the message it is
given — exactly as it carries a message typed into the composer. Which agent answers, whether a tool
is called, how many legs the turn takes: all of that stays where it was, in Foundry.

The line that must not be crossed is **automatic retry** — the app deciding, on its own, that an
answer was bad enough to ask again. That is a permanent non-goal, not a feature that has not been
built yet, and it has a permanent test: `frontend/src/state/noAutoRepeat.test.ts` fails if a `send`
becomes reachable from a turn's completion, its failure, or its emptiness, and it keeps a closed list
of the files allowed to start a turn at all.

That test is a **tripwire, not a proof**. It cannot establish the absence of automatic sending in
general; it fails loudly when someone adds the obvious version of it. The file says so in its own
header, because a guard that is read as a proof is worse than no guard (§5).

Two consequences visible on screen:

- **Both turns stay.** The repeat is appended, and the original question and answer remain where
  they were — because that is what the conversation Foundry holds now contains, and hiding one would
  make the screen disagree with the service.
- **The repeat names its agent.** A reader who switched agents and then repeated is asking a
  *different* agent the same question, which is a reasonable thing to want and a misleading thing to
  leave unsaid.

## What the trace panel can draw of this (spec 029)

The band above the span list draws **one leg**. The round trip described on this page is two OTel
traces, not one: a separate `operation_Id` and `gen_ai.response.id` per leg, verified against the
live service on 2026-09-16 and recorded in [REFERENCES.md](../REFERENCES.md). The turn carries the
response id of the leg that produced the answer, so that is the leg with spans, and the band says so
rather than implying it drew the whole turn.

Two things follow, and both are visible rather than hidden:

- **The tool the BFF ran is not a segment.** Foundry traces what Foundry runs, so a client-side
  function tool produces no span at all — the §8 boundary showing up in telemetry. Its time appears
  as unattributed, hatched, in the band.
- **The gaps are the point.** Spec 015 measured those calls answering in about a millisecond while
  the model spent the seconds. A band of long model segments separated by hairlines is that
  measurement, drawn — and it is the opposite of what everyone assumes when they watch a tool row
  appear.

## Trying one (spec 042)

`/tools` runs a single function tool with arguments you type, through **the same**
`tool_executor.execute` an adapter uses when Foundry asks — not a copy of the path, the path. The
schema beside the field is the same document Foundry is given at `create_version` time.

Arguments are a raw JSON field rather than a generated form, and that is the honest choice twice
over: a form would be a second description of the schema (§4), and `arguments` arriving as a
**string** is part of what a function call is.

**Why this is not the thing §8 forbids.** §8 forbids the *app* choosing which tool to call — a
loop, a heuristic, a re-prompt on model output. A person typing arguments and pressing run has
chosen, exactly as a person choosing which agent answers is configuration (spec 019). What makes it
safe is that it is visibly outside the conversation: no `conversation_id` is created, sent or
stored, nothing reaches a model, and nothing lands in the transcript. Those are assertions in
`test_tool_playground.py`.

The most instructive case is the one that looks like a failure and is not: `search_web` answering
`search_unavailable` because no key is configured. That is the tool's documented answer, it renders
verbatim, and it is the state most forks of this repository will be in.

Off by default — see [`SECURITY.md`](../../SECURITY.md).

