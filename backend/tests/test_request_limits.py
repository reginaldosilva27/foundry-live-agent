"""Spec 062 — the two free-text inputs have a bound, and the browser reads it from `/config`.

The 2026-10-15 assessment posted a 300 KB message to a live BFF; it went to Foundry and was billed.
Pydantic refuses an oversized field before the route runs, so "the stream factory was never
called" is the observable proof that nothing reached Foundry (AC1).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.limits import INSTRUCTIONS_CHARS, MESSAGE_CHARS
from app.main import create_app
from tests.test_agent_definition import OURS
from tests.test_agent_definition import client as proposal_client


def _chat_app():
    calls: list[object] = []

    def factory(*args, **kwargs):
        calls.append(args)
        return iter(())

    app = create_app(
        stream_factory=factory,
        project_endpoint="https://example.services.ai.azure.com/api/projects/p",
        project_name="p",
        agent_name="foundry-live-agent",
        model="gpt-5.5",
        harness="prompt-agent",
    )
    return TestClient(app), calls


def test_ac1_a_message_over_the_bound_never_reaches_foundry():
    client, calls = _chat_app()

    response = client.post("/chat", json={"message": "a" * (MESSAGE_CHARS + 1)})

    assert response.status_code == 422
    assert calls == []


def test_ac2_a_message_at_the_bound_is_accepted():
    client, calls = _chat_app()

    response = client.post("/chat", json={"message": "a" * MESSAGE_CHARS})

    assert response.status_code == 200
    assert calls, "the turn at the bound should have been handed to the harness"


def test_ac3_a_proposal_over_the_bound_is_refused_before_validation(monkeypatch):
    from harness._shared import agent_spec

    validated: list[object] = []
    monkeypatch.setattr(agent_spec, "load_agent_spec", lambda path: validated.append(path))

    response = proposal_client().post(
        f"/agents/{OURS}/definition/proposal", json={"instructions": "a" * (INSTRUCTIONS_CHARS + 1)}
    )

    assert response.status_code == 422
    assert validated == []


def test_ac4_config_publishes_the_bounds_the_routes_enforce():
    client, _ = _chat_app()

    limits = client.get("/config").json()["limits"]

    assert limits == {"message_chars": MESSAGE_CHARS, "instructions_chars": INSTRUCTIONS_CHARS}
