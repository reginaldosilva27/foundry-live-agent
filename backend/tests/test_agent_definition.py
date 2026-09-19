"""Proposing a change to the agent — and refusing to make one (spec 041).

The obvious feature is the one this project cannot have. §8 would permit editing the instructions on
screen and saving; **§4 refuses it**, because `agent_core.yaml` exists precisely so that two copies
of those instructions cannot drift, and a save creates the second copy.

So every test here is about the same thing from a different angle: the file is read, a diff is
produced, and nothing is written.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.agent_definition import definition_for, propose, yaml_with_instructions
from app.agents import AgentsUnavailable
from app.main import create_app

OURS = "foundry-live-agent"
CORE = Path(__file__).resolve().parents[2] / "ai" / "harness" / "_shared" / "agent_core.yaml"


def client(*, allow: bool = True, served: str | None = "") -> TestClient:
    def detail(name: str):
        if name != OURS and name != "foundry-live-agent-hosted":
            raise AgentsUnavailable("unknown_agent", name)
        return type("D", (), {"instructions": served})()

    return TestClient(
        create_app(
            stream_factory=lambda *_: iter(()),
            agent_detail=detail,
            project_endpoint="https://example.invalid/api/projects/p",
            agent_name=OURS,
            harness="prompt-agent",
            allow_proposals=allow,
        )
    )


class TestWhichFileIsEdited:
    def test_resolves_through_extends_to_the_file_that_declares_instructions(self):
        """The harness's own `agent.yaml` does not carry them — the shared core does."""
        definition = definition_for(OURS, None)

        assert definition.path.endswith("_shared/agent_core.yaml")
        assert definition.instructions.strip()

    def test_says_the_change_would_affect_both_agents(self):
        """Spec 018's design working as intended, and a surprise to anyone who does not know it.

        Editing "the prompt agent's" instructions edits the hosted agent's too, because there is
        one set of instructions and that is the whole claim the repository makes.
        """
        definition = definition_for(OURS, None)

        assert sorted(definition.shared_with) == [
            "foundry-live-agent",
            "foundry-live-agent-hosted",
        ]

    def test_refuses_an_agent_this_repository_did_not_write(self):
        # Proposing a change to a file we do not have is meaningless.
        with pytest.raises(AgentsUnavailable) as caught:
            definition_for("DatabricksGenie", None)

        assert caught.value.code == "not_owned"


class TestDrift:
    def test_reports_a_served_definition_that_differs(self):
        definition = definition_for(OURS, "something else entirely")
        assert definition.drifted is True

    def test_reports_no_drift_when_they_agree(self):
        current = definition_for(OURS, None).instructions
        assert definition_for(OURS, current).drifted is False

    def test_ignores_surrounding_whitespace_rather_than_crying_drift(self):
        current = definition_for(OURS, None).instructions
        assert definition_for(OURS, f"\n{current}  \n").drifted is False

    def test_says_nothing_when_there_is_nothing_to_compare(self):
        # The file is still readable without the service. Absent is not "they agree" (§5).
        definition = definition_for(OURS, None)
        assert definition.served_instructions is None
        assert definition.drifted is False


class TestTheRewrite:
    def test_replaces_the_block_and_leaves_everything_else(self):
        original = CORE.read_text()
        rewritten = yaml_with_instructions(original, "Be brief.")

        assert "\ninstructions: |\n  Be brief.\n" in rewritten
        # The comments are most of this file and a reformatted diff tells a reviewer nothing.
        assert "# The agent's behaviour, as code" in rewritten
        assert "schema_version: foundry-live-agent/v1" in rewritten

    def test_keeps_the_keys_after_the_block(self):
        rewritten = yaml_with_instructions(CORE.read_text(), "Be brief.")
        assert "\ntools:" in rewritten
        assert "examples:" in rewritten

    def test_indents_every_line_of_a_multi_line_proposal(self):
        rewritten = yaml_with_instructions(CORE.read_text(), "One.\n\nTwo.")
        assert "  One.\n\n  Two.\n" in rewritten


class TestProposing:
    def test_answers_a_diff_of_the_file_that_would_change(self):
        result = propose(OURS, "Be brief and exact.")

        assert result["ok"] is True
        assert "agent_core.yaml" in result["diff"]
        assert "+  Be brief and exact." in result["diff"]

    def test_answers_the_whole_file_so_it_can_be_taken_as_one(self):
        result = propose(OURS, "Be brief.")
        assert result["yaml"].startswith("# The agent's behaviour, as code")

    def test_writes_nothing(self):
        """The assertion this entire spec exists for."""
        before = CORE.read_text()
        propose(OURS, "Something completely different.")

        assert CORE.read_text() == before

    def test_validates_the_whole_document_before_answering(self, monkeypatch):
        """AC7's wiring, proven rather than staged.

        With instructions-only editing the rewrite **cannot** produce invalid YAML — which is a
        good property of the design, and it means there is no honest way to stage a schema failure
        here. So what is asserted is that the validator runs, on the rewritten document, in a
        temporary copy: a proposal that would fail `apply_agent.py` fails here instead of at deploy
        time.
        """
        from harness._shared import agent_spec

        seen: list[Path] = []
        real = agent_spec.load_agent_spec

        def spy(path):
            seen.append(Path(path))
            return real(path)

        monkeypatch.setattr(agent_spec, "load_agent_spec", spy)
        result = propose(OURS, "Be brief.")

        assert result["ok"] is True
        validated = [p for p in seen if "agent.yaml" in p.name]
        assert validated, "the proposal was never validated"
        # And never against the repository's own copy.
        assert all(str(CORE.parent) not in str(p) for p in validated)


class TestTheRoutes:
    def test_the_flag_is_off_by_default(self):
        body = client(allow=False).get(f"/agents/{OURS}/definition").json()
        assert body == {"definition": None, "error": "proposals_disabled"}

    def test_a_proposal_is_refused_with_the_flag_off(self):
        response = client(allow=False).post(
            f"/agents/{OURS}/definition/proposal", json={"instructions": "x"}
        )
        assert response.status_code == 403
        assert response.json()["error"] == "proposals_disabled"

    def test_config_reports_the_capability(self):
        assert client(allow=True).get("/config").json()["agents"]["can_propose"] is True
        assert client(allow=False).get("/config").json()["agents"]["can_propose"] is False

    def test_serves_the_definition_and_the_drift(self):
        body = client(served="something else").get(f"/agents/{OURS}/definition").json()

        assert body["error"] is None
        assert body["definition"]["drifted"] is True
        assert body["definition"]["path"].endswith("agent_core.yaml")

    def test_a_proposal_answers_a_diff(self):
        body = (
            client()
            .post(f"/agents/{OURS}/definition/proposal", json={"instructions": "Be brief."})
            .json()
        )

        assert body["ok"] is True
        assert "+  Be brief." in body["diff"]

    def test_an_unowned_agent_is_refused(self):
        response = client().get("/agents/DatabricksGenie/definition")
        assert response.status_code in (403, 404)
        assert response.json()["definition"] is None

    def test_nothing_in_this_feature_can_reach_foundry(self):
        """AC5, structurally.

        Asserted on the module rather than on behaviour, because "it did not write" is hard to
        observe and "it cannot write" is easy to read: there is no project client here, no SDK
        write call, and no HTTP client at all.
        """
        source = (Path(__file__).resolve().parents[1] / "app" / "agent_definition.py").read_text()

        for forbidden in ("AIProjectClient", "update_details", "create_version", "httpx"):
            assert forbidden not in source, f"{forbidden} must not be reachable from a proposal"

    def test_the_only_file_written_is_a_temporary_copy(self):
        """Every `write_text` targets the temporary copy, never the repository."""
        source = (Path(__file__).resolve().parents[1] / "app" / "agent_definition.py").read_text()
        writes = [line.strip() for line in source.splitlines() if ".write_text(" in line]

        assert writes, "the guard is vacuous if nothing writes at all"
        for line in writes:
            assert "tmp" in line, f"this write is not into the temporary copy: {line}"
