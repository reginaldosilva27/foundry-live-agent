"""Routes (spec 003, AC1, AC2, AC6, AC8-AC11)."""

import ast
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from harness._shared.contract import check_stream

from app.main import create_app
from app.sse import parse_frames

COMPLETED = {"type": "response.completed", "response": {"id": "resp_1"}}
CALL = {
    "type": "response.output_item.done",
    "item": {
        "type": "function_call",
        "call_id": "call_1",
        "name": "get_current_datetime",
        "arguments": '{"timezone":"UTC"}',
    },
}


def client(legs=None, **overrides):
    """A TestClient whose harness replays `legs` instead of calling Foundry.

    Settings are supplied explicitly rather than read from the ambient environment, so the suite
    behaves the same on a laptop with a populated .env and in CI without one.
    """
    legs = list(legs if legs is not None else [[COMPLETED]])

    def stream_factory(_inputs, _state):
        return iter(legs.pop(0))

    settings = {
        "project_endpoint": "https://example.services.ai.azure.com/api/projects/proj-default",
        "project_name": "proj-default",
        "agent_name": "foundry-live-agent",
        "model": "foundry-analytics-demo/gpt-4o",
        "harness": "prompt-agent",
        **overrides,
    }
    return TestClient(create_app(stream_factory=stream_factory, **settings))


def stream_chat(c, body=None):
    with c.stream("POST", "/chat", json=body or {"message": "hi"}) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        return parse_frames("".join(response.iter_text()))


# --- AC1, AC2 --------------------------------------------------------------


def test_chat_streams_sse_frames_that_satisfy_the_contract():
    events = stream_chat(client())
    assert [e["type"] for e in events] == ["trace_ids", "done"]
    check_stream(events)


def test_chat_runs_the_function_call_round_trip():
    events = stream_chat(client([[CALL], [COMPLETED]]))
    types = [e["type"] for e in events]
    assert types == ["tool_call", "tool_result", "trace_ids", "done"]
    assert events[0]["executor"] == "app"
    assert json.loads(events[1]["output"])["timezone"] == "UTC"
    check_stream(events)


def test_chat_requires_a_message():
    assert client().post("/chat", json={}).status_code == 422


# --- AC6 -------------------------------------------------------------------


def test_a_harness_explosion_still_terminates_the_stream():
    def exploding(_inputs, _state):
        raise RuntimeError("connection reset")

    c = TestClient(create_app(stream_factory=exploding))
    events = stream_chat(c)
    assert events[-1]["type"] == "error"
    check_stream(events)


# --- AC8, AC9 --------------------------------------------------------------


def test_config_describes_what_we_are_talking_to():
    body = client().get("/config").json()
    assert body["harness"] == "prompt-agent"
    assert body["agent_name"]
    assert body["model"]
    assert body["event_types"]
    assert len(body["event_types"]) == 9


def test_config_says_whether_the_gateway_is_in_the_path():
    assert client().get("/config").json()["uses_gateway"] is True
    assert client(model="gpt-4o").get("/config").json()["uses_gateway"] is False


def test_config_reports_how_much_of_the_event_mapping_is_unverified():
    """Honesty surfaced in the API, not buried in a comment (§5, §10)."""
    report = client().get("/config").json()["event_mapping"]
    assert report["verified"] < report["total"]
    assert report["unverified"]


def test_health_does_not_touch_azure():
    assert client().get("/health").json()["status"] == "ok"


# --- AC11 ------------------------------------------------------------------


def test_the_langgraph_harness_starts_the_app():
    """Spec 018 AC1 — inverted. Until spec 018 this asserted the opposite: `AGENT_HARNESS=langgraph`
    raised `NotImplementedError` at startup because the harness was a documented scaffold. It is now
    a deployed hosted agent, so the app must simply start.

    The stream is injected, as it is for the prompt agent: building the real one would need a
    credential, and the point of the injection seam is that the whole app is testable without one.
    """
    app = create_app(harness="langgraph", stream_factory=lambda *_: iter(()))

    assert app.state.settings.harness == "langgraph"


def test_config_reports_the_selected_harness_mapping_not_the_other_ones():
    """A bug only a second harness could expose: `/config` imported the prompt agent's mapping
    report unconditionally, so it described the wrong normaliser whenever another harness ran."""
    app = create_app(harness="langgraph", stream_factory=lambda *_: iter(()))
    with TestClient(app) as test_client:
        body = test_client.get("/config").json()

    from harness.langgraph.events import mapping_report

    assert body["harness"] == "langgraph"
    assert body["event_mapping"]["total"] == mapping_report()["total"]


def test_an_unknown_harness_name_is_rejected():
    with pytest.raises(ValueError, match="unknown harness"):
        create_app(harness="telepathy")


# --- AC7: no agent loop in the backend ------------------------------------

APP_DIR = Path(__file__).resolve().parent.parent / "app"


def test_no_backend_module_names_a_tool():
    """§8: the BFF executes tools; it must not know which tools exist.

    A literal tool name in this package is the first step toward a special case, and a special case
    is tool selection. The registry is the only place a name resolves.
    """
    from harness._shared.tools import registry

    offenders = []
    for module in APP_DIR.rglob("*.py"):
        text = module.read_text()
        for name in registry.tool_names():
            if f'"{name}"' in text or f"'{name}'" in text:
                offenders.append(f"{module.relative_to(APP_DIR)} names {name}")
    assert not offenders, "; ".join(offenders)


def test_no_backend_module_imports_a_specific_tool():
    forbidden = ("datetime_tool", "knowledge_tool")
    offenders = []
    for module in APP_DIR.rglob("*.py"):
        tree = ast.parse(module.read_text())
        for node in ast.walk(tree):
            names = []
            if isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                names = [node.module]
            for imported in names:
                if any(bad in imported for bad in forbidden):
                    offenders.append(f"{module.relative_to(APP_DIR)} imports {imported}")
    assert not offenders, "; ".join(offenders)
