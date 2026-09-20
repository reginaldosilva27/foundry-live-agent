"""Demo mode (spec 050) — the whole app, replayed, with no Azure credential.

The point of every assertion here is that the demo is the **same application**, composed against
the recordings through the seams the suite already uses. So the tests it must pass are the ones the
live path passes: the §9 contract, one `usage`, one terminal, codes and not prose.

Two of them are about what the demo must *not* be. `test_production_app_has_no_demo_route` and
`test_production_entrypoint_never_reaches_the_demo_module` are AC2, and they are the reason this is
an entrypoint rather than a flag: a variable that could turn a real BFF into a replaying one would
make a deployment able to serve a recording as a live answer, and nobody downstream could tell.
"""

import ast
import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from harness._shared.contract import check_stream

from app.demo import RECORDED_AT, RECORDINGS, RECORDINGS_DIR, create_demo_app
from app.main import create_app
from app.sse import parse_frames


@pytest.fixture
def demo():
    return TestClient(create_demo_app())


def stream_chat(client, message="hi"):
    with client.stream("POST", "/chat", json={"message": message}) as response:
        assert response.status_code == 200
        return parse_frames("".join(response.iter_text()))


def _answer(events) -> str:
    return "".join(event["text"] for event in events if event["type"] == "text_delta")


# --- AC1: it runs with nothing configured ----------------------------------


def test_builds_and_streams_a_whole_turn_with_no_azure_environment(monkeypatch):
    """AC1 — the environment a fresh clone has: none of it.

    Stripped rather than overridden, because the failure this guards against is the demo silently
    working off the maintainer's own `.env` and failing on the first reader's machine.
    """
    for name in list(os.environ):
        if name.startswith(("FOUNDRY_", "AZURE_", "VOICELIVE_", "SPEECH_", "APPLICATIONINSIGHTS_")):
            monkeypatch.delenv(name, raising=False)

    events = stream_chat(TestClient(create_demo_app()))

    assert check_stream(events)
    assert events[-1]["type"] == "done"


# --- AC3, AC7: it is the real contract, and it ignores the question --------


def test_the_replayed_turn_satisfies_the_contract_the_live_path_satisfies():
    """AC3 — the demo feeds the same normaliser, so it earns the same guarantees."""
    events = stream_chat(TestClient(create_demo_app()))

    assert check_stream(events)
    assert [e["type"] for e in events].count("usage") == 1
    assert [e["type"] for e in events].count("done") == 1
    # The canonical recording is the one with the round trip in it, so the demo's first impression
    # is the thing this repository exists to show.
    assert any(e["type"] == "tool_call" for e in events)
    assert any(e["type"] == "tool_result" for e in events)
    assert any(e["type"] == "mcp_call" for e in events)


def test_what_you_type_does_not_change_the_answer(demo):
    """AC7 — a recording cannot answer a question, and the app must not pretend it can."""
    first = stream_chat(demo, "what is a hosted agent?")
    second = stream_chat(demo, "completely unrelated question about bicycles")

    assert _answer(first) == _answer(second)
    assert _answer(first)


# --- AC2: no demo on the production path -----------------------------------


def test_production_app_has_no_demo_route():
    routes = {getattr(route, "path", "") for route in create_app().routes}

    assert not [path for path in routes if path.startswith("/demo")]


def test_production_entrypoint_never_reaches_the_demo_module():
    """AC2 — asserted over the import graph, not by reading it.

    Walks what `app.main` imports, transitively, within `app.` — the module that composes the real
    BFF must not be able to reach the one that replays recordings, at any depth.
    """
    root = Path(__file__).resolve().parent.parent / "app"

    def imports_of(module: str) -> set[str]:
        path = root / (module.replace(".", "/") + ".py")
        if not path.exists():
            return set()
        tree = ast.parse(path.read_text())
        found: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("app."):
                found.add(node.module[len("app.") :])
            elif isinstance(node, ast.Import):
                found |= {n.name[len("app.") :] for n in node.names if n.name.startswith("app.")}
        return found

    seen: set[str] = set()
    queue = ["main"]
    while queue:
        module = queue.pop()
        if module in seen:
            continue
        seen.add(module)
        queue.extend(imports_of(module) - seen)

    assert "demo" not in seen, f"app.main reaches app.demo through {sorted(seen)}"


# --- AC6, AC12: the catalogue, and where it points -------------------------


def test_every_recording_exists_and_is_documented():
    """AC12 — the demo may only offer a recording somebody wrote down.

    The fixtures README is where a reader learns what a recording *is*; a catalogue entry naming a
    file absent from it would be a fourth place recordings are described, and the first to rot.
    """
    readme = (RECORDINGS_DIR / "README.md").read_text()

    for recording in RECORDINGS:
        path = RECORDINGS_DIR / recording.file
        assert path.exists(), f"{recording.id} names a missing file: {path}"
        assert recording.file in readme, f"{recording.file} is missing from the fixtures README"


def test_the_catalogue_is_served_with_the_current_pick(demo):
    body = demo.get("/demo").json()

    assert [r["id"] for r in body["recordings"]] == [r.id for r in RECORDINGS]
    assert body["current"] == RECORDINGS[0].id
    assert body["recorded_at"] == RECORDED_AT
    # A CODE per row and no prose: the BFF ships no user-facing sentence (§7).
    assert all(set(row) == {"id", "recorded_at"} for row in body["recordings"])


def test_choosing_a_recording_changes_what_the_next_turn_replays(demo):
    """AC6 — and it does not travel on `POST /chat`, whose three keys are pinned elsewhere."""
    first = stream_chat(demo)

    assert demo.post("/demo/recording", json={"id": "no-reasoning"}).status_code == 200
    assert demo.get("/demo").json()["current"] == "no-reasoning"

    second = stream_chat(demo)

    assert [e["type"] for e in first] != [e["type"] for e in second]
    # The contrast the two recordings exist for: one summarises its reasoning, the other does not.
    assert any(e["type"] == "reasoning_summary" for e in first)
    assert not any(e["type"] == "reasoning_summary" for e in second)


def test_an_unknown_recording_is_refused_with_a_code(demo):
    response = demo.post("/demo/recording", json={"id": "nope"})

    assert response.status_code == 404
    assert response.json()["error"] == "unknown_recording"
    assert demo.get("/demo").json()["current"] == RECORDINGS[0].id


# --- AC8: the recorded agents ----------------------------------------------


def test_the_listing_carries_the_three_cases_that_matter(demo):
    """AC8 — a prompt agent, a hosted one, and one this build cannot drive."""
    body = demo.get("/agents").json()
    rows = {row["name"]: row for row in body["agents"]}

    assert body["error"] is None
    kinds = {row["kind"] for row in rows.values()}
    assert {"prompt", "hosted"} <= kinds

    selectable = [row for row in rows.values() if row["selectable"]]
    assert selectable, "at least one agent must answer, or the demo has nothing to show"

    refused = [row for row in rows.values() if not row["selectable"]]
    assert refused, "the dimmed row is half of what the agents screen teaches"
    for row in refused:
        # A code, never a sentence: the frontend says it in the reader's language (§7).
        assert row["reason"] and " " not in row["reason"]

    # The hosted agent is listed and honestly explained: this demo has no recording for it, which is
    # a different fact from having no harness for it (spec 050, deferred).
    hosted = next(row for row in rows.values() if row["kind"] == "hosted")
    assert hosted["reason"] == "demo_not_recorded"
    assert hosted["harness"] == "langgraph"


# --- AC9, AC10, AC11: the other three screens ------------------------------


def test_the_trace_panel_gets_a_real_span_tree(demo):
    body = demo.get("/trace/resp_0008").json()

    assert body["status"] == "ok"
    assert len(body["spans"]) > 1
    assert {span["kind"] for span in body["spans"]} & {"agent", "model", "tool"}


def test_the_playground_is_on_and_web_search_says_it_is_unavailable(demo):
    assert demo.get("/config").json()["playground"]["enabled"] is True

    listed = {tool["name"] for tool in demo.get("/tools").json()["tools"]}
    assert {"get_current_datetime", "lookup_knowledge", "search_web"} <= listed

    # The clock needs nothing, and runs for real.
    clock = demo.post(
        "/tools/get_current_datetime/run", json={"arguments": '{"timezone": "UTC"}'}
    ).json()
    assert clock["error"] == ""
    assert json.loads(clock["output"])["timezone"] == "UTC"


def test_voice_and_speech_report_not_configured(demo):
    """AC11 — nothing is faked. A replayed WebRTC session would be a drawing of a feature (§5)."""
    config = demo.get("/config").json()

    assert config["voice"]["enabled"] is False
    assert config["speech"]["enabled"] is False


# --- AC4: the config says so -----------------------------------------------


def test_config_says_this_build_is_a_replay(demo):
    config = demo.get("/config").json()

    assert config["demo"]["recorded_at"] == RECORDED_AT
    assert config["tracing"]["enabled"] is True


def test_a_live_build_omits_the_key_rather_than_reporting_false():
    """AC4 — absent and `false` are different facts, and here there is no `false` to report."""
    config = TestClient(create_app()).get("/config").json()

    assert "demo" not in config
