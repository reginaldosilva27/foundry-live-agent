"""`GET /agents/{name}` (spec 030 AC8, AC10).

The route is thin on purpose — the projection is tested against the recording in
`test_agent_detail.py`. What is worth asserting here is the *failure* shape, because that is the
part a screen renders and the part §5 is about: a detail that could not be read must never come
back as an empty detail.
"""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.agents import AgentsUnavailable, find_detail
from app.main import create_app

FIXTURE = Path(__file__).parent / "fixtures" / "agents-listing-20260916.json"
LISTING = json.loads(FIXTURE.read_text())


def client(reader=None):
    return TestClient(
        create_app(
            stream_factory=lambda *_: iter(()),
            agent_detail=reader or (lambda name: find_detail(LISTING, name)),
            project_endpoint="https://example.services.ai.azure.com/api/projects/p",
            project_name="p",
            agent_name="foundry-live-agent",
            model="gpt-5.5",
            harness="prompt-agent",
        )
    )


def test_it_answers_the_agents_definition():
    body = client().get("/agents/foundry-live-agent").json()

    assert body["error"] is None
    assert body["agent"]["kind"] == "prompt"
    assert body["agent"]["instructions"]
    assert body["agent"]["reasoning"] == {"summary": "detailed"}
    assert [t["executor"] for t in body["agent"]["tools"]] == ["app", "app", "app", "foundry"]


def test_an_unknown_name_is_a_404_carrying_a_code_and_no_detail():
    response = client().get("/agents/no-such-agent")

    assert response.status_code == 404
    assert response.json() == {"agent": None, "error": "unknown_agent"}


def test_a_project_we_cannot_read_is_not_an_empty_detail():
    def refuse(_name):
        raise AgentsUnavailable("forbidden", "403")

    response = client(refuse).get("/agents/foundry-live-agent")

    assert response.status_code == 502
    assert response.json() == {"agent": None, "error": "forbidden"}


def test_the_container_environment_never_appears_in_the_response():
    """Spec 030 AC11, asserted on the wire rather than on the dataclass."""
    body = client().get("/agents/foundry-live-agent-hosted").text

    assert "KEY_VAULT_URI" not in body
    assert '"container"' in body


def test_the_route_is_read_only():
    """Editing is spec 041's, and it is not in the browser. A POST here must not exist."""
    assert client().post("/agents/foundry-live-agent", json={}).status_code == 405


class TestTheVersionFields:
    """Spec 031 — what the detail gained, and what it must keep saying when it gains nothing.

    The recorded project has never had a pinned agent, so the honest default here is the one these
    tests assert: served equals latest, nothing is pinned, and the versions are **not reported**
    rather than reported as none.
    """

    def test_it_reports_the_served_and_the_latest_version(self):
        agent = client().get("/agents/foundry-live-agent").json()["agent"]

        assert agent["served_version"]
        assert agent["served_version"] == agent["latest_version"] == agent["version"]
        assert agent["pinned"] is False

    def test_unread_versions_are_null_rather_than_an_empty_list(self):
        """AC2 — "the service did not report them" is not "this agent has none"."""
        agent = client().get("/agents/foundry-live-agent").json()["agent"]
        assert agent["versions"] is None

    def test_a_version_list_arrives_with_the_marks_the_screen_needs(self):
        """AC1 · AC3 — newest first, the served one marked, and promotability per row."""
        from app.agents import detail_of

        raw = LISTING["data"]
        ours = next(a for a in raw if a["name"] == "foundry-live-agent")
        served = str(ours["versions"]["latest"]["version"])
        older = str(int(served) - 1)

        def reader(name: str):
            return detail_of(
                ours,
                [
                    {"version": older, "status": "active", "created_at": 1, "definition": {}},
                    {"version": served, "status": "active", "created_at": 2, "definition": {}},
                ],
            )

        agent = client(reader).get("/agents/foundry-live-agent").json()["agent"]

        assert [v["version"] for v in agent["versions"]] == [served, older]
        assert [v["served"] for v in agent["versions"]] == [True, False]
        assert [v["promotable"] for v in agent["versions"]] == [False, True]
        assert [v["promote_reason"] for v in agent["versions"]] == ["served", ""]


def test_the_production_wiring_reads_versions_and_the_endpoint(monkeypatch):
    """Regression (assessment 2026-10-15): `create_app` built the reader without `clients`.

    Every test above injects `agent_detail=`, so none of them saw that the reader production builds
    could never reach the SDK: `versions` was always None and the pin never resolved, live. This one
    leaves the reader to `create_app` and fakes only what lies past the network.
    """
    import app.agents as agents_module
    import app.main as main_module

    class FakeAgents:
        def get(self, name):
            return {"agent_endpoint": {"version_selector": {"version_selection_rules": []}}}

        def list_versions(self, name):
            return [{"version": "1", "status": "active"}, {"version": "2", "status": "active"}]

    class FakeClients:
        def credential(self):
            return object()

        def project(self, settings):
            return type("Project", (), {"agents": FakeAgents()})()

    monkeypatch.setattr(main_module, "AzureClients", FakeClients)
    monkeypatch.setattr(agents_module, "_http_fetch", lambda credential: lambda url: LISTING)

    body = (
        TestClient(
            create_app(
                stream_factory=lambda *_: iter(()),
                project_endpoint="https://example.services.ai.azure.com/api/projects/p",
                project_name="p",
                agent_name="foundry-live-agent",
                model="gpt-5.5",
                harness="prompt-agent",
            )
        )
        .get("/agents/foundry-live-agent")
        .json()
    )

    assert body["error"] is None
    assert body["agent"]["versions"] is not None
