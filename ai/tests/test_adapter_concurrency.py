"""A running tool must not freeze the process.

The adapter already takes care that reading the Foundry stream does not hold the event loop — its
docstring explains why, with the 2026-09-15 measurement behind it. Executing the tool is the *other*
blocking call on the same path, and the longer one: `search_web` is an HTTP round trip to a
third-party service, and `lookup_knowledge` reads files.

Run inline in the async generator, that call stops the whole process for its duration: every other
SSE stream, every live voice session and every other request served by the same worker. This test
asserts the property behaviourally — while the tool runs, the event loop still runs — rather than
asserting that some particular API was used, so it survives a different implementation of the same
guarantee (§2).
"""

import asyncio
import json
import threading

from harness.prompt_agent.adapter import PromptAgentAdapter

CALL = {
    "type": "response.output_item.done",
    "item": {
        "type": "function_call",
        "call_id": "call_1",
        "name": "get_current_datetime",
        "arguments": "{}",
    },
}
COMPLETED = {"type": "response.completed", "response": {"id": "resp_1"}}


async def test_the_event_loop_keeps_running_while_a_tool_executes():
    """A blocking tool releases the loop, proved by something else making progress during it."""
    released = threading.Event()

    def slow_executor(name: str, arguments: str):
        # Waits for the loop to prove it is alive. `True` means something else ran while this
        # blocked; `False` means nothing could, because this call owned the only thread.
        ran_meanwhile = released.wait(timeout=2.0)
        return json.dumps({"loop_ran_meanwhile": ran_meanwhile}), 1, None

    legs = [[CALL], [COMPLETED]]

    def stream_factory(_inputs, _state):
        return iter(legs.pop(0))

    adapter = PromptAgentAdapter(
        stream_factory=stream_factory,
        executor=slow_executor,
        agent_name="test-agent",
        project_name="proj",
    )

    async def heartbeat() -> None:
        # One tick of the event loop is all this needs: if the tool is blocking it, this coroutine
        # cannot run at all until the tool gives up two seconds later.
        await asyncio.sleep(0.05)
        released.set()

    beat = asyncio.create_task(heartbeat())
    events = [e async for e in adapter.stream_response([{"role": "user", "content": "hi"}], {})]
    await beat

    result = next(e for e in events if e["type"] == "tool_result")
    assert json.loads(result["output"]) == {"loop_ran_meanwhile": True}


async def test_tool_results_keep_their_order_when_a_turn_calls_several():
    """Running off the loop must not reorder the answers, which are keyed by call_id."""

    def executor(name: str, arguments: str):
        return json.dumps({"name": name}), 1, None

    legs = [
        [
            {
                "type": "response.output_item.done",
                "item": {
                    "type": "function_call",
                    "call_id": f"call_{i}",
                    "name": f"tool_{i}",
                    "arguments": "{}",
                },
            }
            for i in range(3)
        ],
        [COMPLETED],
    ]

    def stream_factory(_inputs, _state):
        return iter(legs.pop(0))

    adapter = PromptAgentAdapter(
        stream_factory=stream_factory,
        executor=executor,
        agent_name="test-agent",
        project_name="proj",
    )

    events = [e async for e in adapter.stream_response([{"role": "user", "content": "hi"}], {})]
    results = [e["call_id"] for e in events if e["type"] == "tool_result"]
    assert results == ["call_0", "call_1", "call_2"]
