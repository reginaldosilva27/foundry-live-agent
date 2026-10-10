"""Issue #35: recorded hosted identifiers through the real BFF/factory path.

The transport replays captured bytes, not a hosted service or model. Nothing here proves
that a later answer remembered an earlier question.
"""

from __future__ import annotations

import json
import socket
import threading
import time
import urllib.request
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from harness._shared.contract import check_stream

from app.harness_factory import AzureClients
from app.main import create_app
from app.sse import parse_frames

RECORDING = (
    Path(__file__).resolve().parents[2]
    / "ai/tests/fixtures/recorded/langgraph-hosted-function-20260916.jsonl"
)


@pytest.fixture
def hosted_replay(monkeypatch):
    raw = [json.loads(line) for line in RECORDING.read_text().splitlines()]
    completed = next(e["response"] for e in raw if e["type"] == "response.completed")
    requests = []
    wire = "".join(f"data: {json.dumps(event)}\n\n" for event in raw) + "data: [DONE]\n\n"

    def respond(request):
        requests.append(json.loads(request.content))
        return httpx.Response(200, text=wire, headers={"content-type": "text/event-stream"})

    real_client = httpx.Client
    transport = httpx.MockTransport(respond)
    monkeypatch.setattr(httpx, "Client", lambda **kw: real_client(transport=transport, **kw))
    monkeypatch.setattr(
        AzureClients,
        "credential",
        lambda _: SimpleNamespace(get_token=lambda _: SimpleNamespace(token="local-test-only")),
    )
    app = create_app(
        harness="langgraph",
        project_endpoint="https://example.services.ai.azure.com/api/projects/local-replay",
        project_name="local-replay",
        model="local-replay",
    )
    with TestClient(app) as client:
        yield client, requests, completed


def two_turns(client):
    first = parse_frames(client.post("/chat", json={"message": "First local probe"}).text)
    trace = next(e for e in first if e["type"] == "trace_ids")
    second = parse_frames(
        client.post(
            "/chat",
            json={"message": "Second local probe", "conversation_id": trace.get("conversation_id")},
        ).text
    )
    check_stream(first)
    check_stream(second)
    return trace, second


def test_recorded_hosted_response_reports_no_conversation_pointer(hosted_replay):
    client, requests, completed = hosted_replay
    trace, second = two_turns(client)

    assert trace["response_id"] == completed["id"] == "caresp_0000"
    assert "conversation" not in completed
    assert "conversation_id" not in trace
    assert completed["agent_session_id"] == "id_0001"
    assert "agent_session_id" not in trace
    assert [r["input"] for r in requests] == ["First local probe", "Second local probe"]
    assert all("conversation" not in r and "previous_response_id" not in r for r in requests)
    assert second[-1]["type"] == "done"


def test_bff_conversation_pointer_is_currently_ignored_by_hosted_factory(hosted_replay):
    client, requests, _ = hosted_replay
    events = parse_frames(
        client.post(
            "/chat", json={"message": "Pointer probe", "conversation_id": "conv_client_probe"}
        ).text
    )
    check_stream(events)
    assert requests == [{"input": "Pointer probe", "stream": True}]


@pytest.mark.xfail(
    strict=True,
    reason="Issue #35: recorded response has no conversation; repair needs service evidence",
)
def test_two_hosted_bff_turns_reuse_a_service_conversation_pointer(hosted_replay):
    client, requests, _ = hosted_replay
    trace, _ = two_turns(client)

    assert trace.get("conversation_id"), "First recorded hosted response has no conversation ID"
    assert requests[1].get("conversation") == trace["conversation_id"]


def test_actual_local_http_two_turn_replay(hosted_replay):
    """A real loopback HTTP socket, with only the upstream Azure transport replaced."""
    import uvicorn

    client, requests, completed = hosted_replay
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(128)
        listener.setblocking(False)
        port = listener.getsockname()[1]
        server = uvicorn.Server(uvicorn.Config(client.app, log_level="error", lifespan="off"))
        thread = threading.Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 5
            while not server.started and thread.is_alive() and time.monotonic() < deadline:
                time.sleep(0.01)
            assert server.started

            def post(body):
                request = urllib.request.Request(
                    f"http://127.0.0.1:{port}/chat",
                    data=json.dumps(body).encode(),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(request, timeout=5) as response:
                    assert response.status == 200
                    return parse_frames(response.read().decode())

            first = post({"message": "First loopback probe"})
            trace = next(e for e in first if e["type"] == "trace_ids")
            second = post(
                {
                    "message": "Second loopback probe",
                    "conversation_id": trace.get("conversation_id"),
                }
            )
            check_stream(first)
            check_stream(second)
            assert trace["response_id"] == completed["id"]
            assert "conversation_id" not in trace
            assert requests == [
                {"input": "First loopback probe", "stream": True},
                {"input": "Second loopback probe", "stream": True},
            ]
        finally:
            server.should_exit = True
            thread.join(timeout=5)
            assert not thread.is_alive(), "Owned local HTTP helper did not stop"
