"""Running one tool, on purpose, outside any conversation (spec 042).

**The §8 question, answered rather than dodged.** "A screen that calls tools" describes the thing
the constitution forbids. The distinction is who chose: §8 forbids the *app* choosing which tool to
call, and a person typing arguments and pressing run has chosen — exactly as a person choosing which
agent answers is configuration and not a loop (spec 019).

What makes it safe is that it is visibly outside the conversation, and the last class here asserts
that rather than asserting it in a comment.
"""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from harness._shared.tools import registry

from app.main import create_app


def client(*, allow: bool = True) -> TestClient:
    return TestClient(
        create_app(
            stream_factory=lambda *_: iter(()),
            agent_name="foundry-live-agent",
            harness="prompt-agent",
            allow_playground=allow,
        )
    )


class TestTheListing:
    def test_is_the_registry_and_not_a_second_list(self):
        """AC1 — the same objects Foundry is given at `create_version` time."""
        body = client().get("/tools").json()

        assert [t["name"] for t in body["tools"]] == [s.name for s in registry.specs()]
        for tool, spec in zip(body["tools"], registry.specs(), strict=True):
            assert tool["description"] == spec.description
            assert tool["schema"] == spec.schema

    def test_offers_no_mcp_tool(self):
        # `microsoft_learn` is executed by Foundry. Running it from here would make this app an MCP
        # client, which is a different architecture and a different spec.
        names = [t["name"] for t in client().get("/tools").json()["tools"]]
        assert "microsoft_learn" not in names

    def test_no_second_list_exists_in_backend_source(self):
        """§4: a list of tool names anywhere else would drift from the registry."""
        app_dir = Path(__file__).resolve().parents[1] / "app"
        for path in app_dir.rglob("*.py"):
            text = path.read_text()
            assert not ("get_current_datetime" in text and "search_web" in text), (
                f"{path.name} enumerates the tools; the registry is their one home"
            )


class TestTheSwitch:
    def test_is_off_by_default(self):
        app = create_app(stream_factory=lambda *_: iter(()), agent_name="a", harness="prompt-agent")
        assert TestClient(app).get("/config").json()["playground"]["enabled"] is False

    def test_the_endpoint_refuses_rather_than_being_merely_hidden(self):
        """AC9 — asserted at the BFF, because hiding a screen is not a control."""
        disabled = client(allow=False)

        assert disabled.get("/tools").status_code == 403
        run = disabled.post("/tools/get_current_datetime/run", json={"arguments": "{}"})
        assert run.status_code == 403
        assert run.json()["error"] == "playground_disabled"

    def test_is_independent_of_any_other_surface(self):
        """AC12 — spec 038's inspector reads and costs nothing; this spends a metered key."""
        from app.settings import load_settings

        settings = load_settings(allow_playground=True)
        assert settings.allow_playground is True
        assert settings.allow_version_promote is False
        assert settings.allow_proposals is False


class TestRunning:
    def test_goes_through_the_real_execution_path(self, monkeypatch):
        """AC3 — asserted by observation, not by reading the source.

        `tool_executor.execute` is the same function `harness_factory` hands to every adapter. A
        second implementation here would be the §4 failure this project avoided by implementing the
        tools once.
        """
        from app import tool_executor

        seen: list[tuple[str, str]] = []
        real = tool_executor.execute

        def spy(name: str, arguments: str):
            seen.append((name, arguments))
            return real(name, arguments)

        monkeypatch.setattr(tool_executor, "execute", spy)
        client().post("/tools/get_current_datetime/run", json={"arguments": '{"timezone":"UTC"}'})

        assert seen == [("get_current_datetime", '{"timezone":"UTC"}')]

    def test_answers_the_raw_output_and_a_duration(self):
        body = (
            client()
            .post("/tools/get_current_datetime/run", json={"arguments": '{"timezone":"UTC"}'})
            .json()
        )

        assert '"timezone": "UTC"' in body["output"]
        assert body["duration_ms"] >= 0
        assert body["error"] == ""

    def test_an_unknown_tool_is_a_404_with_a_code(self):
        response = client().post("/tools/nope/run", json={"arguments": "{}"})

        assert response.status_code == 404
        assert response.json()["error"] == "unknown_tool"

    def test_renders_a_tools_own_failure_as_itself(self, monkeypatch):
        """AC5 — `search_unavailable` is the tool's documented answer, not an error box.

        It is also the most instructive case this screen has: a reader learns what happens when the
        deployment has no key, which is the state most forks will be in.
        """
        from app import tool_executor

        monkeypatch.setattr(
            tool_executor,
            "execute",
            lambda name, arguments: tool_executor.ExecutionResult(
                name=name,
                output='{"error": "search_unavailable", "results": []}',
                duration_ms=3,
                ok=True,
                error=None,
            ),
        )
        body = client().post("/tools/search_web/run", json={"arguments": '{"query":"x"}'}).json()

        assert "search_unavailable" in body["output"]
        assert body["error"] == ""


class TestArguments:
    def test_refuses_a_value_of_the_wrong_type_before_running(self):
        response = client().post(
            "/tools/get_current_datetime/run", json={"arguments": '{"timezone": 123}'}
        )

        assert response.status_code == 422
        assert "string" in response.json()["error"]

    def test_refuses_arguments_that_are_not_json(self):
        response = client().post("/tools/get_current_datetime/run", json={"arguments": "{oops"})

        assert response.status_code == 422
        assert "JSON" in response.json()["error"]

    def test_refuses_a_json_value_that_is_not_an_object(self):
        response = client().post("/tools/get_current_datetime/run", json={"arguments": "[1,2]"})
        assert response.status_code == 422

    def test_does_not_execute_a_refused_call(self, monkeypatch):
        from app import tool_executor

        called: list[str] = []
        monkeypatch.setattr(tool_executor, "execute", lambda name, arguments: called.append(name))
        client().post("/tools/get_current_datetime/run", json={"arguments": '{"timezone": 1}'})

        assert called == []


class TestOutsideTheConversation:
    """AC6, AC7 — the §8 guard, and the reason this screen is allowed to exist."""

    def test_creates_sends_and_stores_no_conversation_id(self):
        body = (
            client()
            .post("/tools/get_current_datetime/run", json={"arguments": '{"timezone":"UTC"}'})
            .json()
        )

        assert "conversation_id" not in body
        assert "conversation" not in str(body).lower()

    def test_the_router_reaches_no_model(self):
        """Structural: nothing in this router can talk to a model, because nothing imports one.

        Comments are stripped first: the docstring necessarily NAMES what it
        refuses to touch, and a grep over raw source would match the explanation.
        """
        source = (Path(__file__).resolve().parents[1] / "app" / "routers" / "tools.py").read_text()
        code = "\n".join(line for line in source.splitlines() if not line.strip().startswith("#"))
        parts = code.split('"""')
        code = parts[0] + '"""'.join(parts[2::2])

        for forbidden in ("build_harness", "openai", "AIProjectClient", "conversation_id"):
            assert forbidden not in code, f"the playground must not reach {forbidden}"

    def test_emits_no_events(self):
        """The playground does not stream, so there is nothing for the contract to carry (§9)."""
        response = client().post(
            "/tools/get_current_datetime/run", json={"arguments": '{"timezone":"UTC"}'}
        )

        assert response.headers["content-type"].startswith("application/json")
        assert set(response.json()) == {"output", "duration_ms", "error"}
