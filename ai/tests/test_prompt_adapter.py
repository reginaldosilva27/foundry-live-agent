"""PromptAgentAdapter — the turn loop (spec 003, AC2-AC6).

Raw legs are injected, so the whole loop including the function-call round trip is exercised with no
Azure credential and with the same code path production uses.
"""

import json

import pytest

from harness._shared.contract import ConformanceError, HarnessAdapter, check_stream
from harness.prompt_agent.adapter import PromptAgentAdapter
from tests.conformance import run_conformance

CALL = {
    "type": "response.output_item.done",
    "item": {
        "type": "function_call",
        "call_id": "call_1",
        "name": "get_current_datetime",
        "arguments": '{"timezone":"UTC"}',
    },
}
COMPLETED = {"type": "response.completed", "response": {"id": "resp_1"}}


def call(call_id: str, name: str = "get_current_datetime") -> dict:
    """A completed function_call item. Each call needs its own id — the contract forbids reuse."""
    return {
        "type": "response.output_item.done",
        "item": {
            "type": "function_call",
            "call_id": call_id,
            "name": name,
            "arguments": '{"timezone":"UTC"}',
        },
    }


def adapter(legs, executor=None):
    """Build an adapter whose Foundry legs are `legs`, oldest first."""
    remaining = list(legs)
    submitted: list[dict] = []

    def stream_factory(_inputs, _state):
        submitted.append({"inputs": list(_inputs), "state": _state})
        return iter(remaining.pop(0))

    def default_executor(name, arguments):
        return json.dumps({"echo": name, "args": json.loads(arguments)}), 7, None

    a = PromptAgentAdapter(
        stream_factory=stream_factory,
        executor=executor or default_executor,
        agent_name="test-agent",
        project_name="proj-default",
    )
    a._submitted = submitted  # type: ignore[attr-defined]
    return a


async def collect(a):
    return [e async for e in a.stream_response([{"role": "user", "content": "hi"}], {})]


# --- the happy path --------------------------------------------------------


async def test_a_simple_turn_streams_and_terminates():
    events = await collect(
        adapter([[{"type": "response.output_text.delta", "delta": "hi"}, COMPLETED]])
    )
    assert [e["type"] for e in events] == ["text_delta", "trace_ids", "done"]
    check_stream(events)


async def test_a_function_call_is_executed_and_answered_in_the_same_stream():
    events = await collect(adapter([[CALL], [COMPLETED]]))
    types = [e["type"] for e in events]
    assert types == ["tool_call", "tool_result", "trace_ids", "done"]
    assert events[0]["executor"] == "app"
    assert events[1]["call_id"] == "call_1"
    check_stream(events)  # the AC5 invariant: no unanswered call


async def test_the_adapter_satisfies_the_protocol_and_the_conformance_suite():
    a = adapter([[{"type": "response.output_text.delta", "delta": "x"}, COMPLETED]])
    assert isinstance(a, HarnessAdapter)
    await run_conformance(a)


# --- failure paths ---------------------------------------------------------


async def test_a_failing_tool_still_answers_the_call():
    def failing(name, arguments):
        return json.dumps({"error": "tool_failed"}), 3, "RuntimeError: disk on fire"

    events = await collect(adapter([[CALL], [COMPLETED]], executor=failing))
    result = next(e for e in events if e["type"] == "tool_result")
    assert result["error"] == "RuntimeError: disk on fire"
    check_stream(events)  # still conforms: answered, just with an error


async def test_a_harness_explosion_becomes_a_terminal_error(caplog):
    # The exception's text is the upstream's own error body: request ids, resource names, the
    # endpoint. It goes to the BFF's log; the browser gets the kind of failure (assessment
    # 2026-10-15 — a forged conversation id rendered Foundry's whole 400 body on screen).
    def exploding(_inputs, _state):
        raise RuntimeError("connection reset [Request ID: abc] x.services.ai.azure.com")

    a = PromptAgentAdapter(
        stream_factory=exploding,
        executor=lambda n, a_: ("{}", 0, None),
        agent_name="x",
        project_name="y",
    )
    events = [e async for e in a.stream_response([], {})]
    assert events[-1]["type"] == "error"
    assert events[-1]["message"] == "RuntimeError"
    assert "Request ID" in caplog.text and "connection reset" in caplog.text
    check_stream(events)


async def test_a_leg_that_never_terminates_is_capped_not_infinite():
    """A pathological agent must not stream forever; the cap ends it with an error."""
    legs = [[call(f"call_{i}")] for i in range(50)]
    a = adapter(legs)
    a.max_turns = 3
    events = await collect(a)
    assert events[-1]["type"] == "error"
    assert "turn" in events[-1]["message"].lower()
    check_stream(events)


async def test_a_stream_that_ends_without_a_completion_is_an_error_not_a_done():
    """`done` would mean an empty response_id, leaving the trace drawer nothing to query."""
    events = await collect(adapter([[{"type": "response.output_text.delta", "delta": "hi"}]]))
    assert events[-1]["type"] == "error"
    assert events[-1]["code"] == "stream_ended_without_terminal"
    check_stream(events)


# --- what it refuses to do -------------------------------------------------


async def test_the_adapter_never_invents_a_tool_call():
    """§8: it executes what Foundry asked for. No call in, no execution out."""
    executed = []

    def spy(name, arguments):
        executed.append(name)
        return "{}", 0, None

    await collect(adapter([[COMPLETED]], executor=spy))
    assert executed == []


def test_voice_attachment_points_at_the_same_agent():
    params = adapter([[COMPLETED]]).voice_attachment_params()
    assert params["agent_name"] == "test-agent"
    assert params["project_name"] == "proj-default"


async def test_submit_tool_output_is_available_for_out_of_band_use():
    a = adapter([[COMPLETED]])
    with pytest.raises(NotImplementedError, match="loop"):
        await a.submit_tool_output("call_1", "{}", {})


# --- conformance holds across shapes --------------------------------------


@pytest.mark.parametrize(
    "legs",
    [
        [[COMPLETED]],
        [[CALL], [COMPLETED]],
        [[call("c1")], [call("c2")], [COMPLETED]],
        [[{"type": "response.failed", "response": {"error": {"message": "nope"}}}]],
    ],
)
async def test_every_shape_produces_a_conforming_stream(legs):
    check_stream(await collect(adapter(legs)))


async def test_two_calls_in_one_leg_are_both_answered():
    second = {
        "type": "response.output_item.done",
        "item": {
            "type": "function_call",
            "call_id": "call_2",
            "name": "lookup_knowledge",
            "arguments": '{"query":"harness"}',
        },
    }
    events = await collect(adapter([[CALL, second], [COMPLETED]]))
    answered = {e["call_id"] for e in events if e["type"] == "tool_result"}
    assert answered == {"call_1", "call_2"}
    check_stream(events)


def test_an_unanswered_call_would_fail_the_contract():
    """Proof the invariant has teeth: hand-build the bad stream and watch it fail."""
    with pytest.raises(ConformanceError, match="never answered"):
        check_stream(
            [
                {"type": "trace_ids", "response_id": "r"},
                {
                    "type": "tool_call",
                    "call_id": "call_1",
                    "name": "x",
                    "arguments": "{}",
                    "executor": "app",
                },
                {"type": "done"},
            ]
        )


# --- the stream must not hold the event loop -------------------------------


async def test_the_event_loop_stays_free_while_the_foundry_stream_blocks():
    """Measured 2026-09-15 against the live service: Foundry sends 76 reasoning deltas over 1.35s
    and 78 text deltas over 0.8s. The browser received all of them at once, at the end of the turn.

    The cause is here: the Foundry client is **synchronous**, so iterating it inside an async
    generator blocks the event loop between events, and the server never gets a chance to flush the
    frames it has already been handed. A stream that arrives in one burst is not a stream.

    The test asserts the property rather than the mechanism: while the blocking stream is being
    consumed, another coroutine still runs.
    """
    import asyncio
    import time

    def blocking_stream(_inputs, _state):
        for index in range(5):
            time.sleep(0.05)  # what a blocking network read does to the loop
            yield {"type": "response.output_text.delta", "delta": f"token{index} "}
        yield COMPLETED

    a = PromptAgentAdapter(
        stream_factory=blocking_stream,
        executor=lambda name, arguments: ("{}", 0, None),
        agent_name="test-agent",
        project_name="proj-default",
    )

    ticks = 0

    async def ticker():
        nonlocal ticks
        while True:
            await asyncio.sleep(0.01)
            ticks += 1

    beat = asyncio.create_task(ticker())
    events = await collect(a)
    beat.cancel()

    assert [e["type"] for e in events][-1] == "done"
    # Five 50ms reads: a free loop ticks ~25 times. A blocked one ticks 0.
    assert ticks >= 5, f"the event loop was blocked while the stream was consumed ({ticks} ticks)"


@pytest.mark.parametrize("budget", [1, 3])
@pytest.mark.parametrize("calls_per_leg", [1, 2])
async def test_final_execution_leg_submits_every_output_on_the_same_conversation(
    budget, calls_per_leg
):
    executed = []

    def executor(name, arguments):
        executed.append((name, arguments))
        return f'{{"execution":{len(executed)}}}', 1, None

    batches = [
        [call(f"leg_{leg}_call_{index}") for index in range(calls_per_leg)] for leg in range(budget)
    ]
    a = adapter([*[batch + [COMPLETED] for batch in batches], [COMPLETED]], executor)
    a.max_turns = budget
    state = {"conversation_id": "conv_budget"}
    messages = [{"role": "user", "content": "hi"}]
    events = [e async for e in a.stream_response(messages, state)]

    assert len(a._submitted) == budget + 1
    assert a._submitted[0]["inputs"] == messages
    assert all(request["state"] is state for request in a._submitted)
    results = {e["call_id"]: e["output"] for e in events if e["type"] == "tool_result"}
    for batch, request in zip(batches, a._submitted[1:], strict=True):
        assert request["inputs"] == [
            {
                "type": "function_call_output",
                "call_id": raw["item"]["call_id"],
                "output": results[raw["item"]["call_id"]],
            }
            for raw in batch
        ]
    assert len(executed) == budget * calls_per_leg
    assert [e["type"] for e in events if e["type"] in {"done", "error"}] == ["done"]
    check_stream(events)


@pytest.mark.parametrize("budget", [1, 3])
async def test_settlement_requests_are_visible_but_not_executed_or_recursively_settled(budget):
    executed = []

    def executor(name, arguments):
        executed.append(name)
        return "{}", 1, None

    a = adapter([[call(f"c{i}"), COMPLETED] for i in range(20)], executor)
    a.max_turns = budget
    events = await collect(a)

    assert len(a._submitted) == budget + 1
    assert len(executed) == budget
    assert len([e for e in events if e["type"] == "tool_result"]) == budget
    assert len([e for e in events if e["type"] == "tool_call"]) == budget + 1
    assert [e["type"] for e in events if e["type"] in {"done", "error"}] == ["error"]
    assert events[-1]["code"] == "turn_limit_exceeded"
    assert "not executed or answered" in events[-1]["message"]
    check_stream(events)


@pytest.mark.parametrize("budget", [0, -1])
async def test_nonpositive_budget_makes_no_upstream_request(budget):
    a = adapter([[COMPLETED]])
    a.max_turns = budget
    events = await collect(a)
    assert a._submitted == []
    assert len(events) == 1
    assert events[0]["code"] == "turn_limit_exceeded"
    check_stream(events)


async def test_failed_settlement_is_not_reported_as_successful_delivery():
    requests = []

    def factory(inputs, state):
        requests.append((list(inputs), state))
        if len(requests) == 2:
            raise RuntimeError("output submission failed")
        return iter([CALL, COMPLETED])

    a = PromptAgentAdapter(factory, lambda n, args: ("{}", 0, None), "agent", "project")
    a.max_turns = 1
    events = await collect(a)
    assert len(requests) == 2
    assert requests[1][0] == [{"type": "function_call_output", "call_id": "call_1", "output": "{}"}]
    assert events[-1]["code"] == "harness_error"
    assert events[-1]["message"] == "RuntimeError"
    assert [e["type"] for e in events if e["type"] in {"done", "error"}] == ["error"]
    check_stream(events)
