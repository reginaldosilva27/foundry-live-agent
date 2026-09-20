"""Nothing the BFF does may hold the event loop.

This is a BFF: almost everything it does is wait on somebody else — Foundry, Application Insights,
the Speech endpoint, Tavily. Every one of those calls is made with a **synchronous** client (that is
what the Azure SDKs give us), and a synchronous call inside an `async def` handler stops the entire
worker for its duration. With one uvicorn process — which is what `just backend` runs and what the
voice session store already requires — one slow agent listing freezes every SSE stream in flight
and every live voice session.

`TestClient` cannot see this: it serves one request at a time, so a fully blocking app passes every
other test in this suite.

**How these tests prove it, and why there is no clock in them.** Several identical requests are
issued at once and each one blocks on a `threading.Barrier` sized to their number. A barrier
releases only when all of them are waiting at it *simultaneously*, which is the property under test
stated exactly: if the handler owns the loop, the second request never starts, the first waits out
the barrier's timeout and the rendezvous is reported as failed. Nothing is measured, so nothing is
flaky — and on the passing path there is no sleep at all, so these cost milliseconds.

The first draft did assert on elapsed time with a wide margin, and a loaded machine still tripped
it. A timing assertion that is nearly always true is a test that will be deleted by whoever it
wakes up at the wrong moment; a rendezvous is the same claim without the clock.

The voice test at the bottom works the same way in one process: the tool reports whether anything
else could run while it was working.
"""

from __future__ import annotations

import asyncio
import threading

import httpx

from app.agents import AgentSummary
from app.main import create_app
from app.voice_session import VoiceSession

#: How many requests have to be in flight at once for the rendezvous to release.
CONCURRENCY = 3
#: How long one request will wait for the others before declaring that they never came. Only ever
#: spent on the failing path, so it can be generous without slowing the suite down.
RENDEZVOUS_TIMEOUT = 5.0


def _client(app) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://bff")


def _rendezvous(barrier: threading.Barrier) -> bool:
    """Block the way every synchronous SDK call in this app blocks, and report what happened.

    `True` means `CONCURRENCY` of these were blocking *at the same moment* — which can only be true
    if the handler let go of the event loop. `False` means this call sat here alone until it gave
    up, because nothing else could start.
    """
    try:
        barrier.wait(timeout=RENDEZVOUS_TIMEOUT)
        return True
    except threading.BrokenBarrierError:
        return False


async def _all_met(app, requests) -> None:
    responses = await asyncio.gather(*requests)
    assert all(r.status_code == 200 for r in responses), [r.status_code for r in responses]


async def test_a_slow_agent_listing_does_not_freeze_the_server():
    """`GET /agents` reads Foundry over a synchronous client. It must not own the loop."""

    barrier = threading.Barrier(CONCURRENCY)
    met: list[bool] = []

    def slow_lister() -> list[AgentSummary]:
        met.append(_rendezvous(barrier))
        return []

    app = create_app(agent_lister=slow_lister, project_endpoint="https://example/api/projects/p")
    async with _client(app) as client:
        await _all_met(app, [client.get("/agents") for _ in range(CONCURRENCY)])

    assert all(met), f"{CONCURRENCY} listings never overlapped: {met}"


async def test_a_slow_listing_does_not_freeze_a_turn_that_names_an_agent():
    """`POST /chat` resolves the agent through the same synchronous listing (spec 019).

    This is the worst site of the three: it is on the path of *every* turn once somebody has picked
    an agent on the screen, so a slow listing would stall every other conversation in the process.
    """

    barrier = threading.Barrier(CONCURRENCY)
    met: list[bool] = []

    def slow_lister() -> list[AgentSummary]:
        met.append(_rendezvous(barrier))
        return [
            AgentSummary(
                name="some-agent",
                kind="prompt",
                version="1",
                version_status="active",
                model="gpt-5.5",
                harness="prompt-agent",
                selectable=True,
            )
        ]

    app = create_app(
        agent_lister=slow_lister,
        stream_factory=lambda _inputs, _state: iter(
            [{"type": "response.completed", "response": {"id": "resp_1"}}]
        ),
        project_endpoint="https://example/api/projects/p",
    )
    async with _client(app) as client:
        await _all_met(
            app,
            [
                client.post("/chat", json={"message": "hi", "agent": "some-agent"})
                for _ in range(CONCURRENCY)
            ],
        )

    assert all(met), f"{CONCURRENCY} turns never overlapped: {met}"


async def test_a_slow_trace_query_does_not_freeze_the_server():
    """The Application Insights client is synchronous too (spec 005)."""

    barrier = threading.Barrier(CONCURRENCY)
    met: list[bool] = []

    def slow_query(_kql: str) -> list[dict]:
        met.append(_rendezvous(barrier))
        return []

    app = create_app(trace_query=slow_query)
    async with _client(app) as client:
        await _all_met(app, [client.get("/trace/resp_1") for _ in range(CONCURRENCY)])

    assert all(met), f"{CONCURRENCY} trace reads never overlapped: {met}"


async def test_a_slow_synthesis_does_not_freeze_the_server():
    """`POST /speech` posts to the Speech endpoint with a synchronous client (spec 008).

    Spoken answers synthesise sentence by sentence while the answer streams, so this route is called
    many times during one turn — precisely while an SSE stream needs the loop.
    """

    barrier = threading.Barrier(CONCURRENCY)
    met: list[bool] = []

    def slow_synthesize(_text: str, _voice: str) -> bytes:
        met.append(_rendezvous(barrier))
        return b"mp3"

    app = create_app(synthesize=slow_synthesize)
    async with _client(app) as client:
        await _all_met(
            app,
            [client.post("/speech", json={"text": "oi", "lang": "pt"}) for _ in range(CONCURRENCY)],
        )

    assert all(met), f"{CONCURRENCY} syntheses never overlapped: {met}"


async def test_a_slow_tool_run_does_not_freeze_the_server():
    """`POST /tools/{name}/run` executes a real tool, `search_web` included (spec 042)."""
    # No rendezvous here: the tool is real and fast, and there is nothing to inject a barrier into.
    # This asserts the route still answers under concurrency; the blocking property is proved at the
    # sites that can genuinely be slow.
    app = create_app(allow_playground=True)
    async with _client(app) as client:
        await _all_met(
            app,
            [
                client.post(
                    "/tools/get_current_datetime/run", json={"arguments": '{"timezone":"UTC"}'}
                )
                for _ in range(CONCURRENCY)
            ],
        )


async def test_a_voice_tool_call_does_not_freeze_the_process():
    """The voice control channel answers function calls with the same synchronous executor.

    Worse here than in text: this loop is also the one reading the socket, so a blocking tool stalls
    the conversation it is part of as well as every other one in the process. No clock needed —
    the tool reports whether anything else ran while it was working.
    """
    released = threading.Event()

    class FakeSocket:
        def __init__(self) -> None:
            self.sent: list[str] = []

        async def send(self, payload: str) -> None:
            self.sent.append(payload)

        async def recv(self) -> str:  # pragma: no cover - never reached in this test
            await asyncio.sleep(3600)
            return ""

        async def close(self) -> None:
            return None

    class Result:
        name = "search_web"
        output = ""
        duration_ms = 1
        error = None

    def slow_executor(_name: str, _arguments: str) -> Result:
        ran_meanwhile = released.wait(timeout=2.0)
        result = Result()
        result.output = '{"loop_ran_meanwhile": %s}' % ("true" if ran_meanwhile else "false")
        return result

    session = VoiceSession("s1", FakeSocket(), executor=slow_executor)

    async def heartbeat() -> None:
        # One tick of the loop is all this needs. If the tool owns the thread, this coroutine
        # cannot run at all until the tool gives up two seconds later.
        await asyncio.sleep(0.05)
        released.set()

    beat = asyncio.create_task(heartbeat())
    await session._answer("call_1", "search_web", "{}")
    await beat

    event = await session._events.get()
    assert event is not None
    assert event["output"] == '{"loop_ran_meanwhile": true}'
