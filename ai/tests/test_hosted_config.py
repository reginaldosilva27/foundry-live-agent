"""`azure.yaml` is generated from `agent.yaml`, and stays that way (spec 018, AC7 · AC8 · AC11).

Three files describe one agent: our `agent.yaml`, Microsoft's `azure.yaml`, and the Dockerfile. §4
says a fact lives in one place, so `azure.yaml` is **generated** — committed, because AC8 promises a
cloner can deploy from what is in the repo, and drift-tested, because a generated file someone edits
by hand is worse than no generator at all.

What these tests do *not* do is claim the deployment works. That is AC8's live half, and it is a
recorded transcript, not an assertion (§5).
"""

import subprocess
import sys
from pathlib import Path

import pytest
import yaml

AI = Path(__file__).resolve().parent.parent
AZURE_YAML = AI / "azure.yaml"
HOSTED_AGENT_YAML = AI / "harness" / "langgraph" / "agent.yaml"
GENERATOR = AI / "scripts" / "build_hosted_config.py"


@pytest.fixture
def config() -> dict:
    return yaml.safe_load(AZURE_YAML.read_text())


@pytest.fixture
def agent(config) -> dict:
    return config["services"]["foundry-live-agent-hosted"]


def test_the_committed_azure_yaml_matches_its_generator():
    """The drift test. Run the generator in --check mode; a hand edit fails here."""
    result = subprocess.run(
        [sys.executable, str(GENERATOR), "--check"],
        capture_output=True,
        text=True,
        cwd=AI,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_the_sandbox_matches_the_agent_definition(agent):
    """AC11 — the size is stated in agent.yaml and reaches azure.yaml by generation only.

    azd wants `cpu` as a string and `memory` with a `Gi` suffix; agent.yaml states plain numbers.
    The translation lives in the generator, so neither file carries the other's spelling.
    """
    from harness._shared.agent_spec import load_agent_spec

    hosted = load_agent_spec(HOSTED_AGENT_YAML).hosted
    assert agent["container"]["resources"] == {
        "cpu": f"{hosted['cpu']:.1f}",
        "memory": f"{hosted['memory_gib']}Gi",
    }


def test_the_protocol_matches_the_agent_definition(agent):
    assert [p["protocol"] for p in agent["protocols"]] == ["responses"]


def test_the_agent_name_matches_the_agent_definition(agent):
    from harness._shared.agent_spec import load_agent_spec

    assert agent["name"] == load_agent_spec(HOSTED_AGENT_YAML).name


def test_no_secret_is_declared_in_the_config(config, agent):
    """AC7 — a plaintext key on the agent version is a failing case.

    The hosted-agent documentation is explicit: don't put secrets in container images or
    environment variables. `search_web` still needs `TAVILY_API_KEY`, so the assertion is that no
    *declared* value carries it — the file may well name it in a comment explaining where it went,
    and `ai/harness/langgraph/README.md` carries the documented path to the value (§5).
    """
    assert "TAVILY_API_KEY" not in agent.get("env", {})
    for service in config["services"].values():
        assert "credentials" not in service, (
            "a connection with inline credentials puts a secret in a committed file"
        )
    assert "tvly-" not in AZURE_YAML.read_text(), "an actual key must never reach a committed file"


def test_the_platform_injected_endpoint_is_not_declared(agent):
    """Documented 2026-09-16: the platform injects FOUNDRY_PROJECT_ENDPOINT into hosted
    containers, and declaring it in `env` risks shadowing the platform value. The `FOUNDRY_` and
    `AGENT_` prefixes are reserved."""
    for name in agent.get("env", {}):
        assert not name.startswith(("FOUNDRY_", "AGENT_")), (
            f"{name} uses a reserved platform prefix and must not be declared in env"
        )


def test_the_idle_timeout_is_not_invented_as_a_key(agent):
    """§10, and an honest gap.

    The idle timeout **is** configurable per agent version — 2 to 60 minutes, 15 by default — but
    the `azure.ai.agent` field reference documents no key for it. Emitting one would be a Foundry
    API written from memory. So the generator states the value in a comment and leaves the
    platform default in place; the open question is recorded in docs/REFERENCES.md.
    """
    assert "idleTimeout" not in agent
    assert "sessionConfiguration" not in agent
    assert "idle timeout" in AZURE_YAML.read_text().lower(), (
        "the value we intend must still be visible to a reader, even unset"
    )


def test_the_generated_file_says_it_is_generated():
    assert AZURE_YAML.read_text().lstrip().startswith("# GENERATED")
