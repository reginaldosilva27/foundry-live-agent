"""An agent's versions, and which one actually answers (spec 031).

**The premise this file exists to defend.** `app/agents.py` has always read
`versions.latest.version` as "the served version". That is true only while nobody has ever pinned
one. Promoting works by pinning the agent endpoint's `version_selector` (see `plan.md`), and the
moment that happens the newest version and the serving version come apart.

So `served_version` is one concept with two branches, and both are tested here. The fallback branch
is driven by the **real listing** recorded 2026-09-16, in which no agent carries an `agent_endpoint`
key at all. Nothing in that project has ever been pinned, and §5 forbids hand-writing a recorded
response to make a test pass — so the pinned fixtures here are built in code, from the documented
selector shape, and labelled as constructed rather than recorded.

What *was* recorded, on 2026-09-20 once a working `az` was found: the **per-agent** read, which
does carry an `agent_endpoint` — for every agent, pinned or not. See
`TestTheDefaultEndpointTracksLatest` at the foot of this file; the sentinel it found is why
"has a selector" and "is pinned" are no longer the same question.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.agents import served_version, summarise

FIXTURE = Path(__file__).parent / "fixtures" / "agents-listing-20260916.json"


@pytest.fixture
def listing() -> dict:
    return json.loads(FIXTURE.read_text())


def pinned_to(agent: dict[str, Any], version: str) -> dict[str, Any]:
    """The same agent with its endpoint pinned. **Constructed, not recorded** — see the docstring.

    The shape is `azure-ai-projects` 2.6.0's `AgentEndpointConfig` → `VersionSelector` →
    `FixedRatioVersionSelectionRule`, which is what `promote_version` builds.
    """
    return {
        **agent,
        "agent_endpoint": {
            "version_selector": {
                "version_selection_rules": [
                    {"type": "FixedRatio", "agent_version": version, "traffic_percentage": 100}
                ]
            }
        },
    }


class TestServedVersion:
    def test_falls_back_to_the_latest_when_no_endpoint_pins_one(self, listing):
        """Today's behaviour, unchanged — the correction ships dormant (AC11)."""
        for agent in listing["data"]:
            latest = agent["versions"]["latest"]["version"]
            assert served_version(agent) == str(latest)

    def test_every_recorded_agent_really_does_lack_an_endpoint(self, listing):
        """The premise of the test above, asserted rather than assumed.

        If a future recording carries `agent_endpoint`, this fails and tells the reader the
        fallback branch is no longer the whole story.
        """
        assert [a for a in listing["data"] if "agent_endpoint" in a] == []

    def test_reads_the_pinned_version_when_the_endpoint_carries_one(self, listing):
        """AC11, the branch that only exists after a promotion."""
        agent = pinned_to(listing["data"][0], "3")
        assert served_version(agent) == "3"

    def test_the_pin_wins_over_the_latest(self, listing):
        """The whole point: newest and serving are different facts."""
        agent = pinned_to(listing["data"][0], "3")
        assert agent["versions"]["latest"]["version"] != "3"
        assert served_version(agent) == "3"

    def test_an_empty_selector_falls_back_rather_than_crashing(self, listing):
        """A selector with no rules is not something we have seen; it must not take down a read."""
        agent = {
            **listing["data"][0],
            "agent_endpoint": {"version_selector": {"version_selection_rules": []}},
        }
        assert served_version(agent) == str(agent["versions"]["latest"]["version"])


class TestSelectabilityFollowsTheServedVersion:
    def test_version_not_active_reads_the_served_versions_status(self, listing):
        """AC11 — a project pinned to a failed version is not selectable, however healthy the
        newest one is."""
        agent = pinned_to(listing["data"][0], "3")
        agent["versions"]["latest"] = {**agent["versions"]["latest"], "status": "active"}
        rules = agent["agent_endpoint"]["version_selector"]["version_selection_rules"]
        rules[0]["status"] = "failed"

        # The served version's status does not travel in the listing, so the row reports what it
        # can: see `test_agents.py` for the listing's contract. This asserts only that the summary
        # still names the *latest* version there (AC12) — the served status is a detail-screen fact.
        rows = summarise({"data": [agent]})
        assert rows[0].version == str(agent["versions"]["latest"]["version"])


# --- The version list, and the detail it lands on (AC1 · AC2 · AC11) --------------------


def versions_payload(*rows: dict[str, Any]) -> list[dict[str, Any]]:
    """What `agents.list_versions()` yields, as dicts. Constructed — see the module docstring."""
    return list(rows)


def a_version(version: str, **over: Any) -> dict[str, Any]:
    base = {
        "object": "agent.version",
        "name": "foundry-live-agent",
        "version": version,
        "status": "active",
        "created_at": 1789580000 + (int(version) if version.isdigit() else 0),
        "definition": {"kind": "prompt", "model": "gpt-5.5"},
    }
    return {**base, **over}


class TestVersionRows:
    def test_newest_first_with_what_distinguishes_them(self, listing):
        """AC1 — identifier, status, creation time, model, and the served one marked."""
        from app.agents import versions_of

        agent = listing["data"][0]
        rows = versions_of(agent, versions_payload(a_version("1"), a_version("3"), a_version("2")))

        assert [r.version for r in rows] == ["3", "2", "1"]
        assert [r.model for r in rows] == ["gpt-5.5"] * 3
        assert [r.status for r in rows] == ["active"] * 3
        assert all(r.created_at for r in rows)

    def test_marks_the_served_one(self, listing):
        """AC1 — and it follows the pin, not the ordering."""
        from app.agents import versions_of

        agent = pinned_to(listing["data"][0], "2")
        rows = versions_of(agent, versions_payload(a_version("1"), a_version("2"), a_version("3")))

        assert [r.version for r in rows if r.served] == ["2"]

    def test_a_field_the_service_did_not_report_is_not_invented(self, listing):
        """AC2 — `None` is "the service said nothing", and is not the same as empty."""
        from app.agents import versions_of

        rows = versions_of(
            listing["data"][0],
            versions_payload(a_version("1", status=None, definition={"kind": "hosted"})),
        )
        assert rows[0].status is None
        assert rows[0].model is None

    def test_a_hosted_version_has_no_model_and_that_is_the_same_rule(self, listing):
        """AC2 — not a special case: a container simply reports no model (spec 030)."""
        from app.agents import versions_of

        rows = versions_of(
            listing["data"][0],
            versions_payload(a_version("1", definition={"kind": "hosted", "cpu": "1"})),
        )
        assert rows[0].model is None


class TestTheDetailFollowsTheServedVersion:
    def test_an_unpinned_detail_is_exactly_what_it_was(self, listing):
        """The correction ships dormant (AC11)."""
        from app.agents import detail_of

        agent = listing["data"][0]
        detail = detail_of(agent)
        assert detail.served_version == detail.latest_version
        assert detail.pinned is False

    def test_a_pinned_detail_reports_both_versions(self, listing):
        """AC11 — the screen needs to say "serving 2, newest is N"."""
        from app.agents import detail_of

        agent = pinned_to(listing["data"][0], "2")
        detail = detail_of(agent, versions_payload(a_version("1"), a_version("2"), a_version("3")))

        assert detail.served_version == "2"
        assert detail.latest_version == str(agent["versions"]["latest"]["version"])
        assert detail.pinned is True

    def test_version_not_active_reads_the_served_versions_status(self, listing):
        """AC11 — pinned to a failed version, however healthy the newest one is."""
        from app.agents import detail_of

        agent = pinned_to(listing["data"][0], "2")
        agent["versions"]["latest"] = {**agent["versions"]["latest"], "status": "active"}
        detail = detail_of(agent, versions_payload(a_version("2", status="failed"), a_version("3")))

        assert detail.version_status == "failed"
        assert detail.selectable is False
        assert detail.reason == "version_not_active"

    def test_a_pinned_but_healthy_version_stays_selectable(self, listing):
        """The converse, so the rule is a rule and not a way of always failing."""
        from app.agents import detail_of

        agent = pinned_to(listing["data"][0], "2")
        detail = detail_of(agent, versions_payload(a_version("2"), a_version("3")))
        assert detail.reason == ""
        assert detail.selectable is True


# --- Whose agents may be rolled back (AC3 · AC13) ---------------------------------------


def ours(listing: dict) -> dict[str, Any]:
    """This repository's prompt agent, as the real listing holds it."""
    return next(a for a in listing["data"] if a["name"] == "foundry-live-agent")


def ours_versions(agent: dict[str, Any]) -> list[dict[str, Any]]:
    """A version list that actually contains the version this agent serves.

    Written this way rather than with literal identifiers because the recorded agent is on version
    8, not version 1 — a payload of invented numbers would contain no served row at all and the
    "you cannot promote what is already serving" test would pass vacuously.
    """
    served = str(agent["versions"]["latest"]["version"])
    older = str(int(served) - 1) if served.isdigit() else "older"
    return versions_payload(a_version(older), a_version(served))


class TestOwnership:
    """Promoting is offered on the agents **this repository authored**, and nothing else.

    The project holds ten agents; two came from `ai/harness/*/agent.yaml` and eight belong to other
    people's work. Rolling one of those back from a demo app would change what a colleague's agent
    serves, so the allowlist is derived from the harness definitions — the place that fact already
    lives (§4) — and a fork that edits those files gets its own agents for free.
    """

    def test_is_exactly_the_names_in_the_harness_definitions(self):
        """AC13's source of truth. Read from the YAML, never a hardcoded pair of strings."""
        from pathlib import Path

        import yaml

        from app.harness_factory import OWNED_AGENT_NAMES

        root = Path(__file__).resolve().parents[2] / "ai" / "harness"
        from_yaml = {yaml.safe_load(p.read_text())["name"] for p in root.glob("*/agent.yaml")}
        assert from_yaml == OWNED_AGENT_NAMES
        assert from_yaml, "the harness definitions must name at least one agent"

    def test_the_repositorys_own_agents_are_in_it(self):
        """A characterisation of today, so a rename that breaks the allowlist is loud."""
        from app.harness_factory import OWNED_AGENT_NAMES

        assert "foundry-live-agent" in OWNED_AGENT_NAMES

    def test_the_projects_other_agents_are_not(self, listing):
        from app.harness_factory import OWNED_AGENT_NAMES

        others = {a["name"] for a in listing["data"]} - OWNED_AGENT_NAMES
        assert others, "the recorded project really does hold agents we did not author"
        assert "DatabricksGenie" in others


class TestPromotableRows:
    def test_a_version_that_is_not_served_on_our_own_agent_is_promotable(self, listing):
        """AC3."""
        from app.agents import versions_of

        agent = ours(listing)
        rows = versions_of(agent, ours_versions(agent))
        not_served = [r for r in rows if not r.served]

        assert not_served
        assert all(r.promotable for r in not_served)
        assert all(r.promote_reason == "" for r in not_served)

    def test_the_served_version_is_not_promotable(self, listing):
        """AC3 — you cannot roll back to where you already are."""
        from app.agents import versions_of

        agent = ours(listing)
        rows = versions_of(agent, ours_versions(agent))
        served = [r for r in rows if r.served]

        assert len(served) == 1, "exactly one version serves — the endpoint serves one at 100%"
        assert not served[0].promotable
        assert served[0].promote_reason == "served"

    def test_no_version_of_someone_elses_agent_is_promotable(self, listing):
        """AC13 — a code, not prose (§7), and the BFF refuses the write too."""
        from app.agents import versions_of

        agent = next(a for a in listing["data"] if a["name"] == "DatabricksGenie")
        rows = versions_of(agent, ours_versions(agent))

        assert rows
        assert all(not r.promotable for r in rows)
        assert {r.promote_reason for r in rows} == {"not_owned"}


# --- What an agent is worth being asked (spec 037) --------------------------------------


class TestSuggestions:
    """Read from our own definitions and joined onto the service's rows by name.

    The service returns `instructions`, `model`, `tools` and `reasoning` — nothing that could carry
    an example question. So "ours only" is a permanent limitation rather than a gap, and the honest
    one: we cannot know what somebody else's agent is for.
    """

    def test_our_prompt_agent_carries_the_examples_from_its_definition(self, listing):
        from app.harness_factory import EXAMPLES_FOR_AGENT

        row = next(r for r in summarise(listing) if r.name == "foundry-live-agent")

        assert row.suggestions == EXAMPLES_FOR_AGENT["foundry-live-agent"]
        assert len(row.suggestions) >= 3

    def test_every_suggestion_is_bilingual(self, listing):
        row = next(r for r in summarise(listing) if r.name == "foundry-live-agent")

        for suggestion in row.suggestions:
            assert suggestion["en"].strip()
            assert suggestion["pt"].strip()

    def test_an_agent_we_did_not_write_carries_none(self, listing):
        # Absent, not invented. Deriving a suggestion from its tools would be this app making up a
        # description of somebody else's agent.
        row = next(r for r in summarise(listing) if r.name == "DatabricksGenie")

        assert row.suggestions == []

    def test_they_come_from_the_definition_and_not_from_a_literal(self):
        """The §4 point: the YAML is the source of truth, so the two cannot drift."""
        from pathlib import Path

        import yaml

        from app.harness_factory import EXAMPLES_FOR_AGENT

        root = Path(__file__).resolve().parents[2]
        core = root / "ai" / "harness" / "_shared" / "agent_core.yaml"
        declared = yaml.safe_load(core.read_text())["examples"]

        assert EXAMPLES_FOR_AGENT["foundry-live-agent"] == [
            {"en": e["en"], "pt": e["pt"]} for e in declared
        ]


# --- What the endpoint says when nobody has pinned anything (recorded 2026-09-20) --------


LIVE = Path(__file__).parent / "fixtures" / "agent-endpoint-20260920.json"


@pytest.fixture
def live() -> dict:
    """`GET /agents/{name}` and `/versions`, recorded from the live project on 2026-09-20.

    The shape spec 031 could not probe — it was written against the SDK typespec while `az` on the
    author's machine was unusable, and recorded the result as an open question (§10). This closes
    it, and the answer is not the one the typespec suggested.
    """
    return json.loads(LIVE.read_text())


def live_agent(listing: dict, live: dict) -> dict[str, Any]:
    """The recorded agent with the endpoint the service really returns for it."""
    return {**ours(listing), "agent_endpoint": live["agent_endpoint"]["foundry-live-agent"]}


class TestTheDefaultEndpointTracksLatest:
    """Every agent has an `agent_endpoint`, and it names `@latest` until somebody pins a number.

    Spec 031 assumed a selector's presence *was* the pin, because the recorded listing carried no
    `agent_endpoint` at all and the typespec models `agent_version` as a version. Against the live
    service it is a **sentinel**: the default endpoint of an agent nobody has touched says
    `@latest`, which means "whatever is newest" — exactly the fallback branch, spelled out rather
    than absent. Read as a version it matches no row, and the detail screen calls a perfectly
    healthy agent `version_not_active`.
    """

    def test_the_recorded_endpoint_really_names_the_sentinel(self, live):
        """The premise, asserted rather than assumed — the house style of this file.

        A future recording that carries a number here fails loudly instead of quietly making the
        tests below vacuous.
        """
        for name, endpoint in live["agent_endpoint"].items():
            rules = endpoint["version_selector"]["version_selection_rules"]
            assert [r["agent_version"] for r in rules] == ["@latest"], name
            assert [r["traffic_percentage"] for r in rules] == [100], name

    def test_the_sentinel_resolves_to_the_newest_version(self, listing, live):
        """Not to the string `@latest`, which is no version at all."""
        agent = live_agent(listing, live)
        assert served_version(agent) == str(agent["versions"]["latest"]["version"])

    def test_an_agent_nobody_pinned_is_not_reported_as_pinned(self, listing, live):
        """`pinned` means *a version was chosen*, not *an endpoint exists* — every agent has one."""
        from app.agents import detail_of

        detail = detail_of(live_agent(listing, live), live["versions"]["foundry-live-agent"])
        assert detail.pinned is False
        assert detail.served_version == detail.latest_version

    def test_the_detail_of_a_healthy_agent_stays_selectable(self, listing, live):
        """The regression this fixture exists for: the whole screen against the real service.

        Unresolved, `served` matches no row, the status falls to `unknown`, and our own working
        agent comes back unusable with a reason meant for a failed rollback.
        """
        from app.agents import detail_of

        detail = detail_of(live_agent(listing, live), live["versions"]["foundry-live-agent"])
        assert detail.version == str(detail_of(ours(listing)).latest_version)
        assert detail.version_status == "active"
        assert detail.reason == ""
        assert detail.selectable is True

    def test_exactly_one_recorded_version_is_served_and_it_is_the_newest(self, listing, live):
        """AC3's property, under the shape the service actually returns."""
        from app.agents import versions_of

        rows = versions_of(live_agent(listing, live), live["versions"]["foundry-live-agent"])
        served = [r for r in rows if r.served]

        assert [r.version for r in served] == [rows[0].version]
        assert not served[0].promotable
        assert served[0].promote_reason == "served"

    def test_a_real_pin_still_wins_over_the_sentinel(self, listing, live):
        """The sentinel is ignored, not the selector — promoting must still take effect."""
        from app.agents import detail_of

        agent = live_agent(listing, live)
        rules = agent["agent_endpoint"]["version_selector"]["version_selection_rules"]
        agent["agent_endpoint"] = {
            **agent["agent_endpoint"],
            "version_selector": {"version_selection_rules": [{**rules[0], "agent_version": "7"}]},
        }
        detail = detail_of(agent, live["versions"]["foundry-live-agent"])

        assert detail.served_version == "7"
        assert detail.pinned is True
        assert detail.latest_version == "8"
