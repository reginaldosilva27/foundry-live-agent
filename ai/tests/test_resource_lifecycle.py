"""Local lifecycle probes, not fabricated Foundry recordings."""

import asyncio
import threading

import httpx
import pytest

from harness._shared.tools import web_search_tool
from harness.langgraph.adapter import LangGraphAdapter
from harness.prompt_agent.adapter import PromptAgentAdapter


@pytest.mark.parametrize("owned", [True, False])
@pytest.mark.parametrize("outcome", ["success", "http_error", "malformed", "transport_error"])
def test_search_closes_only_owned_clients(monkeypatch, owned, outcome):
    def handle(request):
        if outcome == "transport_error":
            raise httpx.ReadTimeout("local timeout", request=request)
        if outcome == "http_error":
            return httpx.Response(429)
        return httpx.Response(200, json={} if outcome == "malformed" else {"results": []})

    client = httpx.Client(transport=httpx.MockTransport(handle))
    monkeypatch.setattr(web_search_tool.httpx, "Client", lambda **kwargs: client)
    backend = web_search_tool.TavilySearch("local-test", client=None if owned else client)
    try:
        result = web_search_tool.search_web("lifecycle", backend)
        assert ("error" in result) == (outcome != "success")
        assert client.is_closed is owned
    finally:
        client.close()


class ObservableStream:
    def __init__(self, outcome):
        self.outcome = outcome
        self.started = threading.Event()
        self.release = threading.Event()
        self.closed = threading.Event()
        self.close_count = 0
        self.reading = False
        self.overlapped_close = False
        self.index = 0

    def __iter__(self):
        return self

    def __next__(self):
        self.reading = True
        try:
            self.started.set()
            if self.outcome == "blocked":
                assert self.release.wait(3), "test failed to release its worker"
            if self.outcome == "failure":
                raise RuntimeError("local read failure")
            if self.index:
                raise StopIteration
            self.index += 1
            if self.outcome == "terminal_error":
                return {"type": "error", "message": "local error"}
            if self.outcome == "partial":
                return {"type": "response.output_text.delta", "delta": "partial"}
            return {"type": "response.completed", "response": {"id": "resp_local"}}
        finally:
            self.reading = False

    def close(self):
        self.overlapped_close |= self.reading
        self.close_count += 1
        self.closed.set()


def adapter_for(kind, stream):
    kwargs = dict(stream_factory=lambda *_: stream, agent_name="local", project_name="local")
    if kind == "prompt":
        return PromptAgentAdapter(executor=lambda *_: ("{}", 0, None), **kwargs)
    return LangGraphAdapter(**kwargs)


@pytest.mark.parametrize("kind", ["prompt", "hosted"])
@pytest.mark.parametrize("outcome", ["success", "failure", "terminal_error"])
async def test_stream_closed_on_success_or_error(kind, outcome):
    stream = ObservableStream(outcome)
    events = [event async for event in adapter_for(kind, stream).stream_response([], {})]
    assert sum(event["type"] in {"done", "error"} for event in events) == 1
    assert stream.closed.is_set()
    assert stream.close_count == 1
    assert not stream.overlapped_close


@pytest.mark.parametrize("kind", ["prompt", "hosted"])
async def test_explicit_consumer_close_releases_suspended_iterator(kind):
    stream = ObservableStream("partial")
    events = adapter_for(kind, stream).stream_response([], {})
    assert (await anext(events))["type"] == "text_delta"
    await events.aclose()
    assert stream.closed.is_set()
    assert stream.close_count == 1


@pytest.mark.parametrize("kind", ["prompt", "hosted"])
async def test_cancel_does_not_close_a_generator_while_next_is_running(kind):
    stream = ObservableStream("blocked")
    events = adapter_for(kind, stream).stream_response([], {})
    task = asyncio.create_task(anext(events))
    try:
        assert await asyncio.to_thread(stream.started.wait, 1)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, 0.5)
        assert not stream.closed.is_set(), "running synchronous I/O was not stopped"
    finally:
        stream.release.set()
        await events.aclose()
    assert await asyncio.to_thread(stream.closed.wait, 1)
    assert stream.close_count == 1
    assert not stream.overlapped_close


@pytest.mark.parametrize("kind", ["prompt", "hosted"])
async def test_cleanup_failure_does_not_add_a_second_terminal(kind, caplog):
    class BrokenClose(ObservableStream):
        def close(self):
            super().close()
            raise RuntimeError("local cleanup failed")

    stream = BrokenClose("success")
    events = [event async for event in adapter_for(kind, stream).stream_response([], {})]
    assert sum(event["type"] in {"done", "error"} for event in events) == 1
    assert "local cleanup failed" in caplog.text


@pytest.mark.parametrize("kind", ["prompt", "hosted"])
@pytest.mark.parametrize("phase", ["factory", "close"])
async def test_factory_creation_and_close_leave_the_event_loop_responsive(kind, phase):
    release = threading.Event()
    observed = []

    class SlowClose(ObservableStream):
        def close(self):
            if phase == "close":
                observed.append(release.wait(1))
            super().close()

    stream = SlowClose("success")

    def factory(*_):
        if phase == "factory":
            observed.append(release.wait(1))
        return stream

    kwargs = dict(stream_factory=factory, agent_name="local", project_name="local")
    adapter = (
        PromptAgentAdapter(executor=lambda *_: ("{}", 0, None), **kwargs)
        if kind == "prompt"
        else LangGraphAdapter(**kwargs)
    )

    async def heartbeat():
        await asyncio.sleep(0.02)
        release.set()

    beat = asyncio.create_task(heartbeat())
    try:
        events = [event async for event in adapter.stream_response([], {})]
        assert events[-1]["type"] == "done"
        assert observed == [True]
    finally:
        release.set()
        await beat
