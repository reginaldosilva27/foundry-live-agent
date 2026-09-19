"""Listing the project's agents (spec 019, AC1 · AC2 · AC3 · AC5).

The fixture is the **real listing**, recorded from the live project on 2026-09-16 and redacted by
identifier only (§5). That matters more here than usual: this project holds ten agents, most of them
nothing to do with this repository — `DatabricksGenie`, `dataagent`, a couple of throwaway spikes —
with empty instructions, tools we never chose and models we never picked. A hand-written fixture
would have contained two tidy agents and the mapper would have met the mess in production.

What the listing settles, verified before any of this was designed (§10, and spec 018's lesson):

- `versions.latest.definition.kind` is **in the listing** — AC2 needs no second call per agent.
- a **hosted** agent's definition carries no `model`: it has `cpu`, `memory`,
  `container_configuration`, and its deployment name inside `environment_variables`.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.agents import (
    AgentSummary,
    AgentsUnavailable,
    list_agents,
    select_agent,
    summarise,
)

FIXTURE = Path(__file__).parent / "fixtures" / "agents-listing-20260916.json"


@pytest.fixture
def listing() -> dict:
    return json.loads(FIXTURE.read_text())


@pytest.fixture
def rows(listing) -> list[AgentSummary]:
    return summarise(listing)


def row(rows: list[AgentSummary], name: str) -> AgentSummary:
    return next(r for r in rows if r.name == name)


# --- AC1: the rows come from the service ----------------------------------


def test_every_agent_in_the_project_becomes_a_row(rows, listing):
    assert len(rows) == len(listing["data"]) == 10


def test_a_row_carries_what_the_screen_needs(rows):
    """Name, kind, served version, that version's status, and the model."""
    prompt_agent = row(rows, "foundry-live-agent")

    assert prompt_agent.kind == "prompt"
    assert prompt_agent.version == "8"
    assert prompt_agent.version_status == "active"
    assert prompt_agent.model == "gpt-5.5"


def test_nothing_is_synthesised(rows):
    """AC1 — "no hardcoded entry in the response". Both of this repo's agents are in the project,
    so a mapper that injected a fallback row would be invisible here; asserting the exact set is
    what catches it."""
    assert {r.name for r in rows} >= {"foundry-live-agent", "foundry-live-agent-hosted"}
    assert len(rows) == 10, "a synthesised row would make this eleven"


# --- AC2: kind is read, never inferred ------------------------------------


def test_kind_comes_from_the_definition(rows):
    assert row(rows, "foundry-live-agent").kind == "prompt"
    assert row(rows, "foundry-live-agent-hosted").kind == "hosted"


def test_an_agent_with_no_kind_is_unknown_not_guessed():
    """The name says "hosted" and the definition says nothing. A mapper that read the name would
    call this hosted and then hand it to a harness that cannot drive it (§5)."""
    listing = {
        "data": [
            {
                "name": "looks-hosted-but-isnt",
                "state": "enabled",
                "versions": {"latest": {"version": 1, "status": "active", "definition": {}}},
            }
        ]
    }
    assert summarise(listing)[0].kind == "unknown"


def test_a_hosted_agent_takes_its_model_from_the_environment(rows):
    """A hosted agent's definition has no `model` — the deployment name is an env var on the agent
    version. Observed 2026-09-16; without this the hosted row would show no model at all."""
    assert row(rows, "foundry-live-agent-hosted").model == "gpt-5.5"


def test_a_model_that_cannot_be_found_is_empty_not_invented():
    listing = {
        "data": [
            {
                "name": "modelless",
                "state": "enabled",
                "versions": {
                    "latest": {"version": 1, "status": "active", "definition": {"kind": "prompt"}}
                },
            }
        ]
    }
    assert summarise(listing)[0].model == ""


# --- AC5: selectability, and WHY ------------------------------------------


def test_both_of_this_repos_agents_are_selectable(rows):
    """One prompt, one hosted — this build has a harness for each.

    Which is spec 018's whole point, asserted from the real project.
    """
    assert row(rows, "foundry-live-agent").selectable
    assert row(rows, "foundry-live-agent-hosted").selectable
    assert row(rows, "foundry-live-agent").reason == ""


def test_an_unknown_kind_is_listed_but_not_selectable():
    listing = {
        "data": [
            {
                "name": "a-workflow",
                "state": "enabled",
                "versions": {
                    "latest": {"version": 1, "status": "active", "definition": {"kind": "workflow"}}
                },
            }
        ]
    }
    only = summarise(listing)[0]

    assert not only.selectable
    assert only.reason == "no_harness"


def test_a_disabled_agent_is_listed_but_not_selectable():
    listing = {
        "data": [
            {
                "name": "off",
                "state": "disabled",
                "versions": {
                    "latest": {"version": 1, "status": "active", "definition": {"kind": "prompt"}}
                },
            }
        ]
    }
    only = summarise(listing)[0]

    assert not only.selectable
    assert only.reason == "disabled"


def test_a_version_that_is_not_active_is_listed_but_not_selectable():
    listing = {
        "data": [
            {
                "name": "still-building",
                "state": "enabled",
                "versions": {
                    "latest": {
                        "version": 2,
                        "status": "creating",
                        "definition": {"kind": "prompt"},
                    }
                },
            }
        ]
    }
    only = summarise(listing)[0]

    assert not only.selectable
    assert only.reason == "version_not_active"


def test_the_reason_is_a_code_never_a_sentence(rows):
    """§7 — the BFF must ship no user-facing prose. A message composed here would be English by
    construction; the UI says it in the reader's language, from `strings.ts`."""
    for r in rows:
        assert " " not in r.reason, f"{r.name} carries prose, not a code: {r.reason!r}"


def test_disabled_outranks_an_inactive_version():
    """Two things wrong, one row, one reason. A disabled agent's endpoint is offline, so that is
    the fact worth saying — and a row that flipped between reasons would be noise."""
    listing = {
        "data": [
            {
                "name": "both",
                "state": "disabled",
                "versions": {
                    "latest": {
                        "version": 1,
                        "status": "creating",
                        "definition": {"kind": "prompt"},
                    }
                },
            }
        ]
    }
    assert summarise(listing)[0].reason == "disabled"


# --- AC3: failure is typed, never an empty list ---------------------------


def test_an_unconfigured_project_is_a_typed_failure():
    with pytest.raises(AgentsUnavailable) as caught:
        list_agents(endpoint="", fetch=lambda _url: {"data": []})

    assert caught.value.code == "unconfigured"


def test_an_unauthorised_listing_is_a_typed_failure():
    def forbidden(_url):
        raise PermissionError("403")

    with pytest.raises(AgentsUnavailable) as caught:
        list_agents(endpoint="https://example/api/projects/p", fetch=forbidden)

    assert caught.value.code == "forbidden"


def test_any_other_failure_is_typed_too():
    def exploded(_url):
        raise RuntimeError("connection reset")

    with pytest.raises(AgentsUnavailable) as caught:
        list_agents(endpoint="https://example/api/projects/p", fetch=exploded)

    assert caught.value.code == "unavailable"


def test_a_genuinely_empty_project_is_an_empty_list_not_a_failure(listing):
    """The other half of AC3: "never an empty list presented as no agents" must not become
    "never an empty list". A project with no agents is a fact, and different from a broken one."""
    assert (
        list_agents(endpoint="https://example/api/projects/p", fetch=lambda _u: {"data": []}) == []
    )


def test_the_listing_url_is_the_verified_one():
    """Observed 2026-09-16: `?api-version=v1`, and the `https://ai.azure.com` audience. Asserted
    because the endpoint shape is exactly the kind of thing §10 forbids writing from memory."""
    seen: list[str] = []

    def capture(url):
        seen.append(url)
        return {"data": []}

    list_agents(endpoint="https://example/api/projects/p/", fetch=capture)

    assert seen == ["https://example/api/projects/p/agents?api-version=v1"]


# --- the route (AC3) -------------------------------------------------------


def app_with(lister):
    from app.main import create_app

    return create_app(stream_factory=lambda *_: iter(()), agent_lister=lister)


def test_the_route_returns_the_rows(listing):
    from fastapi.testclient import TestClient

    with TestClient(app_with(lambda: summarise(listing))) as client:
        body = client.get("/agents").json()

    assert body["error"] is None
    assert len(body["agents"]) == 10
    assert {
        "name",
        "kind",
        "version",
        "version_status",
        "model",
        "harness",
        "suggestions",
        "selectable",
        "reason",
    } == set(body["agents"][0])


def test_the_route_reports_a_failure_as_a_code_and_never_as_no_agents():
    """AC3 — the whole point. A screen that renders "we could not read the project" the same way it
    renders "this project has no agents" teaches the reader something false."""
    from fastapi.testclient import TestClient

    def broken():
        raise AgentsUnavailable("forbidden", "403")

    with TestClient(app_with(broken)) as client:
        body = client.get("/agents").json()

    assert body["error"] == "forbidden"
    assert body["agents"] == []


def test_an_empty_project_is_not_reported_as_an_error():
    from fastapi.testclient import TestClient

    with TestClient(app_with(lambda: [])) as client:
        body = client.get("/agents").json()

    assert body == {"agents": [], "error": None}


# --- AC6, and the guard T13: resolving a name to a row --------------------


def selectable_row(name: str = "foundry-live-agent", **overrides) -> AgentSummary:
    values = {
        "name": name,
        "kind": "prompt",
        "version": "8",
        "version_status": "active",
        "model": "gpt-5.5",
        "harness": "prompt-agent",
        "selectable": True,
        "reason": "",
    }
    return AgentSummary(**{**values, **overrides})


def test_selecting_a_name_the_project_offers_returns_that_row():
    wanted = selectable_row("spike-reasoning")
    rows = [selectable_row(), wanted]

    assert select_agent(lambda: rows, "spike-reasoning") is wanted


def test_selecting_an_agent_this_build_cannot_drive_is_refused_before_a_turn_starts():
    """The row's own reason, not a new one: the screen dims it for a stated reason, and the refusal
    must say the same thing. A second vocabulary here would let the two disagree (§4)."""
    rows = [
        selectable_row("DatabricksGenie", kind="workflow", selectable=False, reason="no_harness")
    ]

    with pytest.raises(AgentsUnavailable) as caught:
        select_agent(lambda: rows, "DatabricksGenie")

    assert caught.value.code == "no_harness"


def test_selecting_a_name_the_project_does_not_have_is_refused():
    with pytest.raises(AgentsUnavailable) as caught:
        select_agent(lambda: [selectable_row()], "ghost")

    assert caught.value.code == "unknown_agent"


def test_a_selection_made_while_the_project_cannot_be_read_keeps_the_listings_code():
    """Not swallowed into a generic failure: the reader is told the project could not be listed,
    which is a different problem from the agent being wrong."""

    def unavailable():
        raise AgentsUnavailable("forbidden", "403")

    with pytest.raises(AgentsUnavailable) as caught:
        select_agent(unavailable, "foundry-live-agent")

    assert caught.value.code == "forbidden"


def test_a_row_names_the_harness_that_would_drive_it():
    """The header renders a harness badge beside the agent's name. With a selection it was still
    showing `AGENT_HARNESS` — so choosing the hosted agent produced a turn tagged `foundry` under a
    badge reading `prompt-agent`. Exactly the bug spec 018 fixed for `agent_name`, one field over.

    The rule stays in `HARNESS_FOR_KIND` and travels on the row, rather than being re-derived in
    TypeScript: two copies of "which kinds can this build drive" is what §4 forbids.
    """
    rows = summarise(
        {
            "data": [
                {
                    "name": "hosted-one",
                    "versions": {
                        "latest": {
                            "version": 2,
                            "status": "active",
                            "definition": {"kind": "hosted"},
                        }
                    },
                },
                {
                    "name": "prompt-one",
                    "versions": {
                        "latest": {
                            "version": 1,
                            "status": "active",
                            "definition": {"kind": "prompt"},
                        }
                    },
                },
                {
                    "name": "workflow-one",
                    "versions": {
                        "latest": {
                            "version": 1,
                            "status": "active",
                            "definition": {"kind": "workflow"},
                        }
                    },
                },
            ]
        }
    )

    assert [(r.name, r.harness) for r in rows] == [
        ("hosted-one", "langgraph"),
        ("prompt-one", "prompt-agent"),
        # Nothing drives it, so the row says nothing rather than naming a harness that would fail.
        ("workflow-one", ""),
    ]


class TestTheListingStaysOneCall:
    """Spec 031, AC12 — the served-version correction must not cost the listing anything.

    Spec 030 verified that the whole agents screen is answerable from one request, and spec 031
    deliberately did **not** spend that: a pin is resolved on the detail screen, which is the one
    screen that can afford a call. These tests assert the *absence* of the extra request, the same
    way spec 027 asserts that search makes none.
    """

    def test_lists_ten_agents_with_exactly_one_upstream_request(self, listing):
        calls: list[str] = []

        def fetch(url: str) -> dict:
            calls.append(url)
            return listing

        rows = list_agents("https://example.invalid/api/projects/p", fetch)

        assert len(rows) == 10
        assert len(calls) == 1, f"one listing, not {len(calls)} — no per-agent call (AC12)"

    def test_the_rows_version_is_the_newest_one(self, listing):
        """Not the served one. The rail says "latest" and means it; the detail resolves the pin."""
        rows = summarise(listing)
        for r, agent in zip(rows, listing["data"], strict=True):
            assert r.version == str(agent["versions"]["latest"]["version"])
