"""Cancellation propagates through the BFF without writing to a departed reader."""

import asyncio
import threading
from types import SimpleNamespace

import pytest

from app.harness_factory import _foundry_stream_factory
from app.routers.chat import ChatRequest, chat
from app.settings import Settings


async def test_closing_sse_body_closes_the_harness_without_an_extra_frame():
    closed = asyncio.Event()

    class Harness:
        async def stream_response(self, messages, state):
            try:
                yield {"type": "text_delta", "text": "local"}
                await asyncio.Event().wait()
            finally:
                closed.set()

    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(harness=Harness())))
    response = await chat(ChatRequest(message="local"), request)
    body = response.body_iterator
    assert "text_delta" in await anext(body)
    await body.aclose()
    assert closed.is_set()


def test_prompt_factory_closes_the_sdk_response_stream():
    closed = threading.Event()

    class Stream:
        def __iter__(self):
            yield {"type": "response.output_text.delta", "delta": "local"}

        def close(self):
            closed.set()

    openai = SimpleNamespace(responses=SimpleNamespace(create=lambda **kwargs: Stream()))
    factory = _foundry_stream_factory(
        Settings("https://local", "local", "local", "local", "prompt-agent"),
        "local",
        SimpleNamespace(openai=lambda settings: openai),
    )
    stream = factory([], {"conversation_id": "conv_local"})
    assert next(stream)["delta"] == "local"
    stream.close()
    assert closed.is_set()


async def test_cancellation_while_a_tool_runs_stops_submission_not_synchronous_work():
    from harness.prompt_agent.adapter import PromptAgentAdapter

    started, release, finished = threading.Event(), threading.Event(), threading.Event()
    requests = []

    def executor(*_):
        started.set()
        try:
            assert release.wait(3)
            return "{}", 0, None
        finally:
            finished.set()

    def factory(inputs, state):
        requests.append(inputs)
        return iter(
            [
                {
                    "type": "response.output_item.done",
                    "item": {
                        "type": "function_call",
                        "call_id": "local",
                        "name": "local",
                        "arguments": "{}",
                    },
                }
            ]
        )

    adapter = PromptAgentAdapter(factory, executor, "local", "local")
    events = adapter.stream_response([], {"conversation_id": "conv_local"})
    assert (await anext(events))["type"] == "tool_call"
    task = asyncio.create_task(anext(events))
    try:
        assert await asyncio.to_thread(started.wait, 1)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, 0.5)
        assert not finished.is_set()
        assert len(requests) == 1
    finally:
        release.set()
        await events.aclose()
    assert await asyncio.to_thread(finished.wait, 1)
