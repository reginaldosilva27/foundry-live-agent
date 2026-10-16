"""An upstream failure tells the browser *what kind* of failure, and the log the rest.

Regressions from the 2026-10-15 assessment: a forged `conversation_id` rendered Foundry's whole
400 body on screen — request id included — and the trace drawer would have done the same with a
Log Analytics error naming the workspace's resource id. `ErrorCard` renders `message` verbatim, so
the message is now the exception's class and the text goes to the BFF's log.

Also here, because it is the same function: the trace reader built a credential and a query client
on every request and never closed either, and its `denied` branch could never run — the SDK raises
`HttpResponseError` / `ClientAuthenticationError`, never `PermissionError`.
"""

from __future__ import annotations

import json

from azure.core.exceptions import ClientAuthenticationError, HttpResponseError
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import load_settings
from app.traces import build_trace_reader, read_trace
from app.voice_session import VoiceSession
from tests.test_voice import SDP_OFFER
from tests.test_voice_failures import DyingSocket

LEAK = "Request ID: 9f1c /subscriptions/0000/resourceGroups/rg x.services.ai.azure.com"
RESPONSE_ID = "resp_0123456789abcdef"


def test_a_bff_failure_names_its_kind_and_logs_the_detail(caplog):
    class Exploding:
        async def stream_response(self, messages, state):
            raise RuntimeError(LEAK)
            yield  # pragma: no cover - makes this an async generator

    app = create_app(
        stream_factory=lambda *_: iter(()),
        project_endpoint="https://example.services.ai.azure.com/api/projects/p",
        agent_name="foundry-live-agent",
        model="gpt-5.5",
        harness="prompt-agent",
    )
    app.state.harness = Exploding()

    body = TestClient(app).post("/chat", json={"message": "hi"}).text
    frames = [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]

    assert frames[-1] == {"type": "error", "message": "RuntimeError", "code": "bff_error"}
    assert "Request ID" in caplog.text


def test_an_unreadable_agent_listing_does_not_put_the_endpoint_on_screen(caplog):
    def lister():
        raise RuntimeError(LEAK)

    app = create_app(
        stream_factory=lambda *_: iter(()),
        project_endpoint="https://example.services.ai.azure.com/api/projects/p",
        agent_name="foundry-live-agent",
        model="gpt-5.5",
        harness="prompt-agent",
    )

    import app.agents as agents_module

    original = agents_module.read_listing
    agents_module.read_listing = lambda endpoint, fetch: original(endpoint, lambda url: lister())
    try:
        body = TestClient(app).post("/chat", json={"message": "hi", "agent": "other"}).text
    finally:
        agents_module.read_listing = original
    frames = [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]

    assert frames[-1]["code"] == "unavailable"
    assert "services.ai.azure.com" not in frames[-1]["message"]
    assert "Request ID" in caplog.text


def test_a_failed_trace_query_names_its_kind_only(caplog):
    def query(_kql):
        raise RuntimeError(LEAK)

    trace = read_trace(query, RESPONSE_ID)

    assert trace.status == "failed"
    assert trace.message == "RuntimeError"
    assert "/subscriptions/" in caplog.text


def test_a_forbidden_query_is_denied_and_names_the_role():
    def query(_kql):
        raise HttpResponseError(message=LEAK, response=_Response(403))

    trace = read_trace(_reader_that_raises(query), RESPONSE_ID)

    assert trace.status == "denied"
    assert "Log Analytics Reader" in trace.message
    assert "Request ID" not in trace.message


def test_an_unauthenticated_query_is_denied_too():
    def query(_kql):
        raise ClientAuthenticationError(message=LEAK)

    assert read_trace(_reader_that_raises(query), RESPONSE_ID).status == "denied"


def test_the_reader_builds_one_query_client_from_the_shared_credential(monkeypatch):
    import azure.monitor.query as query_module

    built: list[object] = []
    shared = object()

    class FakeLogsClient:
        def __init__(self, credential):
            built.append(credential)

        def query_resource(self, *args, **kwargs):
            return type("R", (), {"status": query_module.LogsQueryStatus.SUCCESS, "tables": []})()

    class FakeClients:
        def credential(self):
            return shared

    monkeypatch.setattr(query_module, "LogsQueryClient", FakeLogsClient)
    query = build_trace_reader(load_settings(appinsights_resource_id="/r/1"), FakeClients())

    query("a")
    query("b")

    assert built == [shared]


async def test_a_dead_voice_channel_names_its_kind_only():
    session = VoiceSession("s1", DyingSocket())
    await session.negotiate(SDP_OFFER)

    events = [event async for event in session.events()]

    assert events[-1]["message"] == "ConnectionError"


class _Response:
    """The least of an `azure.core` response that `HttpResponseError` reads."""

    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        self.reason = "Forbidden"
        self.headers: dict[str, str] = {}

    def text(self) -> str:
        return LEAK


def _reader_that_raises(raiser):
    """`build_trace_reader`'s translation of SDK errors, around a query that raises them."""
    from app.traces import translate_query_errors

    return translate_query_errors(raiser)
