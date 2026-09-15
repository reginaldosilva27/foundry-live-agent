"""Tests for the agent.yaml loader (spec 002, AC7)."""

import pytest

from harness._shared.agent_spec import AgentSpecError, load_agent_spec

VALID = """
schema_version: foundry-live-agent/v1
name: foundry-live-agent
model: foundry-analytics-demo/gpt-4o
instructions: |
  You are a helpful assistant.
tools:
  - type: function
    name: get_current_datetime
  - type: mcp
    name: microsoft_learn
    server_url: https://learn.microsoft.com/api/mcp
    require_approval: never
"""


def write(tmp_path, text):
    path = tmp_path / "agent.yaml"
    path.write_text(text)
    return path


def test_loads_a_valid_spec(tmp_path):
    spec = load_agent_spec(write(tmp_path, VALID))
    assert spec.name == "foundry-live-agent"
    assert spec.model == "foundry-analytics-demo/gpt-4o"
    assert spec.instructions.strip() == "You are a helpful assistant."


def test_splits_function_and_mcp_tools(tmp_path):
    spec = load_agent_spec(write(tmp_path, VALID))
    assert [t.name for t in spec.function_tools] == ["get_current_datetime"]
    assert [t.name for t in spec.mcp_tools] == ["microsoft_learn"]
    assert spec.mcp_tools[0].server_url == "https://learn.microsoft.com/api/mcp"


def test_rejects_a_function_tool_the_registry_does_not_have(tmp_path):
    """A definition naming an unimplemented tool must fail at load, not hang a run in production."""
    bad = VALID.replace("get_current_datetime", "delete_everything")
    with pytest.raises(AgentSpecError, match="delete_everything"):
        load_agent_spec(write(tmp_path, bad))


def test_rejects_an_unknown_schema_version(tmp_path):
    bad = VALID.replace("foundry-live-agent/v1", "foundry-live-agent/v99")
    with pytest.raises(AgentSpecError, match="schema_version"):
        load_agent_spec(write(tmp_path, bad))


def test_rejects_a_missing_required_field(tmp_path):
    bad = "\n".join(line for line in VALID.splitlines() if not line.startswith("model:"))
    with pytest.raises(AgentSpecError, match="model"):
        load_agent_spec(write(tmp_path, bad))


def test_rejects_an_mcp_tool_without_a_server_url(tmp_path):
    bad = VALID.replace("    server_url: https://learn.microsoft.com/api/mcp\n", "")
    with pytest.raises(AgentSpecError, match="server_url"):
        load_agent_spec(write(tmp_path, bad))


def test_rejects_an_unknown_tool_type(tmp_path):
    bad = VALID.replace("type: mcp", "type: telepathy")
    with pytest.raises(AgentSpecError, match="telepathy"):
        load_agent_spec(write(tmp_path, bad))


def test_function_tools_carry_the_registry_schema(tmp_path):
    """The YAML names the tool; the schema and description come from the registry (§4)."""
    spec = load_agent_spec(write(tmp_path, VALID))
    tool = spec.function_tools[0]
    assert tool.schema["properties"]["timezone"]["type"] == "string"
    assert tool.description


def test_the_shipped_agent_yaml_is_valid():
    """The definition we actually ship must load."""
    from pathlib import Path

    shipped = Path(__file__).resolve().parent.parent / "harness" / "prompt_agent" / "agent.yaml"
    spec = load_agent_spec(shipped)
    assert spec.name
    assert len(spec.function_tools) == 2
    assert len(spec.mcp_tools) == 1


# --- reasoning summaries (spec 002, observed 2026-09-15) -------------------


def test_reasoning_defaults_to_off(tmp_path):
    """Absent from the YAML means absent from the definition — not a silently applied default."""
    spec = load_agent_spec(write(tmp_path, VALID))
    assert spec.reasoning is None


def test_reasoning_is_read_from_the_definition(tmp_path):
    """Observed 2026-09-15: Foundry rejects a request-level `reasoning` with 400
    "Not allowed when agent is specified", so the agent definition is the only place it can live."""
    spec = load_agent_spec(
        write(tmp_path, VALID + "\nreasoning:\n  summary: auto\n  effort: high\n")
    )
    assert spec.reasoning == {"summary": "auto", "effort": "high"}


def test_rejects_a_reasoning_summary_foundry_does_not_accept(tmp_path):
    bad = VALID + "\nreasoning:\n  summary: verbose\n"
    with pytest.raises(AgentSpecError, match="verbose"):
        load_agent_spec(write(tmp_path, bad))


def test_the_shipped_agent_asks_for_reasoning_summaries():
    """Without this the activity panel's reasoning card is permanently empty — the recorded
    contrast between the two fixtures is exactly this one setting."""
    from pathlib import Path

    shipped = Path(__file__).resolve().parent.parent / "harness" / "prompt_agent" / "agent.yaml"
    assert load_agent_spec(shipped).reasoning == {"summary": "auto"}
