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
