"""The agent, inspected (spec 030).

Driven by the **same recorded listing** the row tests use — the real one, captured from the live
project on 2026-09-16. That matters more here than anywhere: this spec's whole claim is that the
service already reports an agent's definition, including for the eight agents this repository did
not create. A hand-written fixture would have made that claim about ourselves (§5).

The assertions to read twice are the last two. `testagentdemo` really has no `tools` key, so "not
reported" is a shape the recording produced rather than one we invented; and the hosted agent really
carries `KEY_VAULT_URI` in its environment, which is why the projection drops the environment
entirely instead of filtering it at render time.
"""

import json
from pathlib import Path

import pytest

from app.agents import AgentDetail, detail_of, find_detail

FIXTURE = Path(__file__).parent / "fixtures" / "agents-listing-20260916.json"


@pytest.fixture
def listing() -> dict:
    return json.loads(FIXTURE.read_text())


def detail(listing: dict, name: str) -> AgentDetail:
    return find_detail(listing, name)


# --- AC2, AC6: what a prompt agent is --------------------------------------


def test_a_prompt_agent_carries_its_definition(listing):
    it = detail(listing, "foundry-live-agent")

    assert it.kind == "prompt"
    assert it.model == "gpt-5.5"
    assert it.version == "8"
    assert it.harness == "prompt-agent"
    assert it.instructions and len(it.instructions) > 500
    assert it.reasoning == {"summary": "detailed"}


def test_an_agent_this_repository_never_wrote_carries_the_same_fields(listing):
    """The point of the spec: eight of these ten are somebody else's, and they render identically.

    `DatabricksGenie`'s instructions come back as the empty string — genuinely empty in the project,
    not redacted; the fixture is redacted by identifier only (spec 019). That is the distinction
    this screen has to keep: **reported and empty** is not **not reported**, and only the second one
    may render as "the service did not say".
    """
    it = detail(listing, "DatabricksGenie")

    assert it.instructions == ""
    assert it.instructions is not None
    assert it.model
    assert it.tools is not None


def test_an_agent_that_does_write_instructions_carries_them_whole(listing):
    assert len(detail(listing, "datafabricagent").instructions or "") == 782


def test_reasoning_is_absent_on_the_agents_that_do_not_configure_it(listing):
    # Two of ten report it. Absent is the ordinary case, not a fault (AC6).
    configured = [
        a["name"]
        for a in listing["data"]
        if (a["versions"]["latest"]["definition"] or {}).get("reasoning")
    ]
    assert detail(listing, configured[0]).reasoning is not None
    assert detail(listing, "test-agent").reasoning is None


# --- AC3, AC4: the tools and who runs them ---------------------------------


def test_a_function_tool_projects_its_name_description_and_schema(listing):
    tools = detail(listing, "foundry-live-agent").tools or []
    datetime_tool = next(t for t in tools if t.name == "get_current_datetime")

    assert datetime_tool.kind == "function"
    assert datetime_tool.description
    assert "timezone" in (datetime_tool.parameters or "")
    # A string, not a dict: it is rendered and copied verbatim, never inspected by the browser.
    assert isinstance(datetime_tool.parameters, str)


def test_an_mcp_tool_projects_its_server_and_approval(listing):
    tools = detail(listing, "foundry-live-agent").tools or []
    mcp = next(t for t in tools if t.kind == "mcp")

    assert mcp.server_label == "microsoft_learn"
    assert mcp.server_url == "https://learn.microsoft.com/api/mcp"
    assert mcp.require_approval == "never"
    assert mcp.name == "microsoft_learn"


def test_the_service_types_every_tool_and_the_projection_narrows_it(listing):
    """The recorded listing types all four tools: three `function`, one `mcp`.

    Asserted against the recording rather than described in a comment, because the classification
    rule is the BFF's and a copy of it in TypeScript is the §4 violation (§4, spec 019).
    """
    raw = next(a for a in listing["data"] if a["name"] == "foundry-live-agent")["versions"][
        "latest"
    ]["definition"]["tools"]

    assert [t.get("type") for t in raw] == ["function", "function", "function", "mcp"]


def test_a_tool_type_this_build_does_not_know_still_renders(listing):
    """Dropping an unknown tool would hide part of an agent's definition, which is the one thing
    this screen exists not to do. It renders as a function tool, which is what it most likely is."""
    from app.agents import detail_of

    agent = json.loads(json.dumps(next(a for a in listing["data"] if a["name"] == "test-agent")))
    agent["versions"]["latest"]["definition"]["tools"] = [{"type": "something_new", "name": "x"}]

    tools = detail_of(agent).tools or []
    assert [t.name for t in tools] == ["x"]


def test_who_executes_each_tool_is_decided_here(listing):
    """The project's central lesson, and the BFF's knowledge — not the frontend's (AC4)."""
    tools = detail(listing, "foundry-live-agent").tools or []
    by_kind = {t.kind: t.executor for t in tools}

    assert by_kind["function"] == "app"
    assert by_kind["mcp"] == "foundry"


# --- AC5: not reported is not the same as empty ----------------------------


def test_a_definition_that_names_no_tools_reports_none_rather_than_an_empty_list(listing):
    # `testagentdemo` really has no `tools` key in the recording.
    assert detail(listing, "testagentdemo").tools is None


def test_nothing_is_filled_in_from_this_repository(listing):
    """`testagentdemo` is not ours and we know nothing about it. The projection must not guess."""
    it = detail(listing, "testagentdemo")

    assert it.tools is None
    assert it.reasoning is None
    assert it.container is None


# --- AC11: the container, and what never leaves the BFF --------------------


def test_a_hosted_agent_projects_its_container_and_not_its_definition(listing):
    it = detail(listing, "foundry-live-agent-hosted")

    assert it.kind == "hosted"
    assert it.instructions is None
    assert it.tools is None
    assert it.container is not None
    assert it.container.image.endswith("azd-deploy-1789580414")
    assert it.container.cpu == "1.0"
    assert it.container.memory == "2Gi"
    assert it.container.protocols == ["responses 2.0.0"]


def test_the_environment_never_reaches_the_browser(listing):
    """The recorded listing carries `KEY_VAULT_URI` among the container's environment variables.

    A field the browser never receives cannot leak from it later, so the environment is dropped in
    the projection rather than hidden in the view. The assertion is on the serialised response,
    because that is the thing that actually travels.
    """
    serialised = json.dumps(detail(listing, "foundry-live-agent-hosted").as_dict())

    assert "KEY_VAULT_URI" not in serialised
    assert "environment" not in serialised


def test_the_model_still_arrives_for_a_hosted_agent(listing):
    """Dropping the environment must not lose the one variable the screen needs (spec 019)."""
    assert detail(listing, "foundry-live-agent-hosted").model


# --- the lookup ------------------------------------------------------------


def test_an_unknown_name_is_refused_by_code(listing):
    from app.agents import AgentsUnavailable

    with pytest.raises(AgentsUnavailable) as raised:
        find_detail(listing, "no-such-agent")

    assert raised.value.code == "unknown_agent"


def test_detail_of_carries_the_rows_own_selectability(listing):
    """One vocabulary for "why not", shared with the card (§4, spec 019)."""
    hosted = next(a for a in listing["data"] if a["name"] == "foundry-live-agent-hosted")
    it = detail_of(hosted)

    assert it.selectable is True
    assert it.reason == ""
