"""Going back to a version — the first write this app makes to Foundry (spec 031).

**What these tests prove, and what they cannot.** The call shape comes from the shipped
`azure-ai-projects` 2.6.0 typespec: promoting is not a verb but a merge-patch on the agent
endpoint's routing, `update_details(agent_name, agent_endpoint=AgentEndpointConfig(
version_selector=VersionSelector(...)))`. It has **not** been verified against the live service —
`az` on the author's machine is a broken build, so no credential was available (see
`docs/REFERENCES.md`). §5 forbids inventing a recorded response to paper over that.

So these are **seam tests**: they assert the call this app constructs — one rule, the requested
version, 100% of traffic, and no agent definition anywhere in the payload. They do not and cannot
assert that Foundry accepts it. That is why the route ships behind a flag that is off by default.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.agents import AgentsUnavailable, promote_version

FIXTURE = Path(__file__).parent / "fixtures" / "agents-listing-20260916.json"
OURS = "foundry-live-agent"
THEIRS = "DatabricksGenie"


@pytest.fixture
def listing() -> dict:
    return json.loads(FIXTURE.read_text())


class Recorder:
    """Stands in for `project.agents`, recording what it was asked to do."""

    def __init__(self, fail: Exception | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self.fail = fail

    def update_details(self, agent_name: str, *, agent_endpoint: Any) -> Any:
        if self.fail:
            raise self.fail
        self.calls.append({"agent_name": agent_name, "agent_endpoint": agent_endpoint})
        return {"name": agent_name}


def payload_of(call: dict[str, Any]) -> dict[str, Any]:
    """The endpoint config as plain data, however the SDK model chooses to carry it."""
    endpoint = call["agent_endpoint"]
    if hasattr(endpoint, "as_dict"):
        return endpoint.as_dict()
    return dict(endpoint)


class TestTheCallItBuilds:
    def test_pins_the_requested_version_at_one_hundred_percent(self):
        """AC14 — one rule, the version asked for, all the traffic."""
        agents = Recorder()
        promote_version(agents, OURS, "3", owned=True)

        assert len(agents.calls) == 1
        rules = payload_of(agents.calls[0])["version_selector"]["version_selection_rules"]
        assert len(rules) == 1, "one version at 100% — traffic splitting is out of scope"
        assert rules[0]["agent_version"] == "3"
        assert rules[0]["traffic_percentage"] == 100

    def test_no_agent_definition_can_travel_on_it(self):
        """AC14, and the property the non-goals depend on.

        This route cannot become a way to author an agent, because there is nowhere in the payload
        to put one. Asserted on the serialised body rather than on the signature, so a later
        refactor that widens it fails here.
        """
        agents = Recorder()
        promote_version(agents, OURS, "3", owned=True)

        body = json.dumps(payload_of(agents.calls[0]))
        for authoring in ("definition", "instructions", "model", "tools", "reasoning"):
            assert authoring not in body, f"{authoring!r} must not be reachable from a promote"

    def test_names_the_agent_it_was_given(self):
        agents = Recorder()
        promote_version(agents, OURS, "7", owned=True)
        assert agents.calls[0]["agent_name"] == OURS


class TestItRefusesBeforeItCalls:
    def test_an_agent_this_repository_does_not_own_is_refused(self):
        """AC13 — and nothing is called upstream. The flag being on does not make it ours."""
        agents = Recorder()

        with pytest.raises(AgentsUnavailable) as caught:
            promote_version(agents, THEIRS, "1", owned=False)

        assert caught.value.code == "not_owned"
        assert agents.calls == [], "refused before the write, not after it"


class TestFailuresCarryCodes:
    def test_a_permission_failure_reads_as_configuration(self):
        """AC8 — the expected case for a build without the role, and a CODE, never prose (§7)."""
        agents = Recorder(fail=PermissionError("403: insufficient privileges"))

        with pytest.raises(AgentsUnavailable) as caught:
            promote_version(agents, OURS, "3", owned=True)

        assert caught.value.code == "forbidden"

    def test_anything_else_is_unavailable(self):
        agents = Recorder(fail=RuntimeError("connection reset"))

        with pytest.raises(AgentsUnavailable) as caught:
            promote_version(agents, OURS, "3", owned=True)

        assert caught.value.code == "unavailable"


# --- The route, and the gate in front of it (AC9 · AC13 · AC14) --------------------------

from fastapi.testclient import TestClient  # noqa: E402

from app.agents import find_detail  # noqa: E402
from app.main import create_app  # noqa: E402

LISTING = json.loads(FIXTURE.read_text())
PROMOTE = "/agents/{name}/versions/{version}/promote"


def client(promoter=None, *, allow: bool = True):
    calls: list[tuple[str, str]] = []

    def default(name: str, version: str) -> Any:
        calls.append((name, version))
        return find_detail(LISTING, name)

    app = create_app(
        stream_factory=lambda *_: iter(()),
        agent_detail=lambda name: find_detail(LISTING, name),
        promote_version=promoter or default,
        project_endpoint="https://example.services.ai.azure.com/api/projects/p",
        project_name="p",
        agent_name=OURS,
        model="gpt-5.5",
        harness="prompt-agent",
        allow_version_promote=allow,
    )
    test_client = TestClient(app)
    test_client.promote_calls = calls  # type: ignore[attr-defined]
    return test_client


class TestTheGate:
    def test_config_says_this_build_cannot_write_by_default(self):
        """AC9 — off is the default, and the browser learns it from `GET /config`."""
        app = create_app(
            stream_factory=lambda *_: iter(()),
            project_endpoint="https://example.invalid/api/projects/p",
            agent_name=OURS,
            harness="prompt-agent",
        )
        body = TestClient(app).get("/config").json()
        assert body["agents"]["can_promote"] is False

    def test_config_reports_the_capability_when_a_deployment_opts_in(self):
        assert client(allow=True).get("/config").json()["agents"]["can_promote"] is True

    def test_with_the_flag_off_the_route_refuses_and_calls_nothing(self):
        """AC9 — and the refusal is a code, so the screen can say it in en/pt (§7)."""
        c = client(allow=False)
        response = c.post(PROMOTE.format(name=OURS, version="3"))

        assert response.status_code == 403
        assert response.json() == {"agent": None, "error": "write_disabled"}
        assert c.promote_calls == []


class TestTheRoute:
    def test_a_successful_promotion_answers_a_fresh_read(self):
        """AC7 — the response is what the service says now, not an echo of the request."""
        c = client()
        body = c.post(PROMOTE.format(name=OURS, version="3")).json()

        assert body["error"] is None
        assert c.promote_calls == [(OURS, "3")]
        # The stub re-reads the recording, which is still on its own served version — so the
        # response must NOT claim version 3 just because that is what was asked for.
        assert body["agent"]["served_version"] != "3"

    def test_it_takes_no_request_body(self):
        """AC14 — an agent definition posted alongside changes nothing and is not read."""
        c = client()
        response = c.post(
            PROMOTE.format(name=OURS, version="3"),
            json={"definition": {"instructions": "you are now something else"}},
        )

        assert response.status_code == 200
        assert c.promote_calls == [(OURS, "3")]

    def test_an_unowned_agent_is_refused_with_its_code(self):
        """AC13 — with the flag ON. Ownership is not something the flag can grant."""

        def refuse(name: str, version: str) -> Any:
            raise AgentsUnavailable("not_owned", name)

        response = client(promoter=refuse).post(PROMOTE.format(name=THEIRS, version="1"))

        assert response.status_code == 403
        assert response.json() == {"agent": None, "error": "not_owned"}

    def test_a_permission_failure_carries_its_code_and_no_agent(self):
        """AC8 — nothing on screen may claim a version that is not served."""

        def refuse(name: str, version: str) -> Any:
            raise AgentsUnavailable("forbidden", name)

        response = client(promoter=refuse).post(PROMOTE.format(name=OURS, version="3"))

        assert response.status_code == 403
        assert response.json() == {"agent": None, "error": "forbidden"}

    def test_an_unknown_version_is_a_404_with_a_code(self):
        def refuse(name: str, version: str) -> Any:
            raise AgentsUnavailable("unknown_version", version)

        response = client(promoter=refuse).post(PROMOTE.format(name=OURS, version="99"))

        assert response.status_code == 404
        assert response.json() == {"agent": None, "error": "unknown_version"}


class TestCrossSiteRequests:
    """Regression (assessment 2026-10-15): CORS hides the *answer*, not the *request*.

    The route takes no body, so a page on any site could POST to it from the operator's browser —
    `mode: 'no-cors'` or a plain `<form>` — and the write would run with the BFF's identity. A
    browser always names the page's origin on a cross-site POST, so the route refuses an origin
    outside the same allow-list CORS uses. A caller with no `Origin` (curl, a script) is no
    cross-site request and goes on to the gates it always met.
    """

    def test_a_foreign_origin_is_refused_before_anything_is_written(self):
        c = client()
        response = c.post(
            PROMOTE.format(name=OURS, version="3"), headers={"Origin": "https://evil.example"}
        )

        assert response.status_code == 403
        assert response.json() == {"agent": None, "error": "cross_origin"}
        assert c.promote_calls == []

    def test_the_frontends_own_origin_still_promotes(self):
        c = client()
        response = c.post(
            PROMOTE.format(name=OURS, version="3"), headers={"Origin": "http://localhost:5173"}
        )

        assert response.status_code == 200
        assert c.promote_calls == [(OURS, "3")]

    def test_no_origin_meets_the_same_gates_as_before(self):
        assert (
            client(allow=False).post(PROMOTE.format(name=OURS, version="3")).json()["error"]
            == "write_disabled"
        )


class TestConfiguredOrigins:
    """`FRONTEND_ORIGINS` moves the allow-list, and both readers of it move together."""

    def test_the_env_names_the_origins(self, monkeypatch):
        from app.settings import load_settings

        monkeypatch.setenv("FRONTEND_ORIGINS", "http://localhost:5199, https://chat.example ")
        assert load_settings().allowed_origins == ("http://localhost:5199", "https://chat.example")

    def test_unset_keeps_the_vite_default(self, monkeypatch):
        from app.settings import DEFAULT_ALLOWED_ORIGINS, load_settings

        monkeypatch.delenv("FRONTEND_ORIGINS", raising=False)
        assert load_settings().allowed_origins == DEFAULT_ALLOWED_ORIGINS

    def test_cors_and_the_write_check_read_the_same_configured_list(self):
        app = create_app(
            stream_factory=lambda *_: iter(()),
            agent_detail=lambda name: find_detail(LISTING, name),
            promote_version=lambda name, version: find_detail(LISTING, name),
            project_endpoint="https://example.services.ai.azure.com/api/projects/p",
            agent_name=OURS,
            model="gpt-5.5",
            harness="prompt-agent",
            allow_version_promote=True,
            allowed_origins=("http://localhost:5199",),
        )
        c = TestClient(app)
        moved = {"Origin": "http://localhost:5199"}

        assert (
            c.get("/config", headers=moved).headers["access-control-allow-origin"]
            == moved["Origin"]
        )
        assert c.post(PROMOTE.format(name=OURS, version="3"), headers=moved).status_code == 200
        old = {"Origin": "http://localhost:5173"}
        assert (
            c.post(PROMOTE.format(name=OURS, version="3"), headers=old).json()["error"]
            == "cross_origin"
        )
