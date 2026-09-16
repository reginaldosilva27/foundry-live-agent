"""Tests for the agent.yaml loader (spec 002, AC7)."""

from pathlib import Path

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
    assert len(spec.function_tools) == 3
    assert len(spec.mcp_tools) == 1


def test_the_shipped_agent_declares_web_search():
    """spec 013 AC10 — declared *and* cross-checked against the registry by the loader."""
    from pathlib import Path

    shipped = Path(__file__).resolve().parent.parent / "harness" / "prompt_agent" / "agent.yaml"
    spec = load_agent_spec(shipped)
    tool = next(t for t in spec.function_tools if t.name == "search_web")
    assert tool.schema["required"] == ["query"]


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
    contrast between the two fixtures is exactly this one setting.

    `detailed`, not `auto`, since 2026-09-16: observed on agent version 4, a turn with seven
    tool-calling legs emitted a `reasoning` item on most of them and a summary on none, because
    `auto` leaves the choice to the model and on short legs it declines. The assertion names the
    value rather than merely checking presence, because *which* value is the whole finding.
    """
    from pathlib import Path

    shipped = Path(__file__).resolve().parent.parent / "harness" / "prompt_agent" / "agent.yaml"
    assert load_agent_spec(shipped).reasoning == {"summary": "detailed"}


# --- the spoken preamble (spec 016) ---------------------------------------

SHIPPED = Path(__file__).resolve().parent.parent / "harness" / "prompt_agent" / "agent.yaml"

NARRATION_CUE = "before you call a tool"


def narration_rule() -> str:
    """The paragraph of the shipped instructions that governs the preamble.

    Isolated rather than searched for across the whole text, because AC2 is about what that rule
    does *not* say — and every tool identifier it must avoid appears legitimately elsewhere in the
    same instructions.
    """
    paragraphs = load_agent_spec(SHIPPED).instructions.split("\n\n")
    return next(p for p in paragraphs if NARRATION_CUE in p.lower())


def test_the_shipped_agent_narrates_before_a_tool_call():
    """spec 016 AC1 — the silence during a tool round trip is the agent's to fill.

    This is a weak test and says so: it proves the instruction was *written*, not that the model
    obeys it. Obedience is proved by a recorded live turn (AC3/AC4), because a model cannot be
    unit-tested into behaving and this repository does not claim behavior it has not observed (§5).
    """
    rule = narration_rule().lower()
    assert "one short sentence" in rule
    assert "language" in rule, "the preamble must follow the same language rule as the answer"


def test_the_narration_rule_stays_out_of_jargon_and_off_repeat():
    """spec 016 AC2 — a spoken preamble that reads out identifiers is worse than silence."""
    rule = narration_rule()
    for identifier in ("search_web", "lookup_knowledge", "get_current_datetime", "microsoft_learn"):
        assert identifier not in rule, f"the preamble must not name {identifier} out loud"
    assert "once" in rule.lower(), "a line per call in a seven-call turn is a running commentary"


# --- no URLs in a spoken answer (spec 017) --------------------------------
#
# The rule that belongs here does NOT exist, and that is the finding. A first attempt put
# "when the conversation is spoken, leave the sources out" in the instructions; the model read the
# URL aloud anyway, because it cannot tell. Asked directly, over real audio in and audio out, it
# answered *"Estou trocando texto escrito com você."* An instruction conditioned on the modality is
# conditioned on nothing, so the condition moved to the only place that knows it: the session
# (`spoken_context_item`, `ai/harness/_shared/voice_events.py`).


def test_the_written_citation_rule_survives():
    """spec 017 AC2 — the guard against 'fixing' this by deleting citations.

    Without an unconditional citation rule for written answers, a web search becomes
    indistinguishable from the model's own memory — the exact failure spec 013 exists to prevent.
    """
    instructions = load_agent_spec(SHIPPED).instructions
    search_rule = next(
        line for line in instructions.splitlines() if "Always cite the URLs it returns" in line
    )

    assert search_rule, "the written citation rule was removed instead of made conditional"


# --- `extends:` — one definition, two harnesses (spec 018, AC5) -----------
#
# Two agents that must behave identically cannot each carry their own copy of the model, the
# instructions and the tool list: that is the drift §4 forbids, and a reviewer noticing is not a
# control. So the shared half moves into `_shared/agent_core.yaml` and each harness's agent.yaml
# names it. One key, a shallow merge, and no override rules — anything cleverer has outgrown the
# job it was added for.

CORE = """
schema_version: foundry-live-agent/v1
name: shared-core
model: gpt-5.5
instructions: |
  Shared instructions.
tools:
  - type: function
    name: get_current_datetime
"""


def write_named(tmp_path, filename, text):
    path = tmp_path / filename
    path.write_text(text)
    return path


def test_extends_pulls_in_the_shared_definition(tmp_path):
    write_named(tmp_path, "core.yaml", CORE)
    child = write_named(
        tmp_path,
        "agent.yaml",
        "schema_version: foundry-live-agent/v1\nextends: core.yaml\nname: child\n",
    )

    spec = load_agent_spec(child)

    assert spec.model == "gpt-5.5"
    assert spec.instructions.strip() == "Shared instructions."
    assert [t.name for t in spec.function_tools] == ["get_current_datetime"]


def test_the_local_file_wins_over_what_it_extends(tmp_path):
    """The child is the more specific statement, so it overrides — but only key by key."""
    write_named(tmp_path, "core.yaml", CORE)
    child = write_named(
        tmp_path,
        "agent.yaml",
        "schema_version: foundry-live-agent/v1\nextends: core.yaml\n"
        "name: child\nreasoning:\n  summary: detailed\n",
    )

    spec = load_agent_spec(child)

    assert spec.name == "child"
    assert spec.reasoning == {"summary": "detailed"}
    assert spec.model == "gpt-5.5", "a key the child does not mention still comes from the core"


def test_extends_resolves_relative_to_the_file_that_declares_it(tmp_path):
    """Not to the working directory — `just agent` runs from `ai/`, a test runs from anywhere."""
    (tmp_path / "shared").mkdir()
    write_named(tmp_path / "shared", "core.yaml", CORE)
    (tmp_path / "harness").mkdir()
    child = write_named(
        tmp_path / "harness",
        "agent.yaml",
        "schema_version: foundry-live-agent/v1\nextends: ../shared/core.yaml\nname: child\n",
    )

    assert load_agent_spec(child).model == "gpt-5.5"


def test_rejects_an_extends_target_that_does_not_exist(tmp_path):
    child = write_named(
        tmp_path,
        "agent.yaml",
        "schema_version: foundry-live-agent/v1\nextends: missing.yaml\nname: child\n",
    )
    with pytest.raises(AgentSpecError, match="missing.yaml"):
        load_agent_spec(child)


def test_rejects_a_cycle_rather_than_recursing_forever(tmp_path):
    write_named(
        tmp_path,
        "a.yaml",
        "schema_version: foundry-live-agent/v1\nextends: b.yaml\nname: a\n",
    )
    write_named(
        tmp_path,
        "b.yaml",
        "schema_version: foundry-live-agent/v1\nextends: a.yaml\nname: b\n",
    )
    with pytest.raises(AgentSpecError, match="extends cycle"):
        load_agent_spec(tmp_path / "a.yaml")


# --- the hosted sandbox (spec 018, AC11) ----------------------------------
#
# Same reasoning as the `reasoning:` block above: a value Foundry rejects fails at `azd deploy`,
# minutes later, naming a generated azure.yaml nobody wrote by hand. Catching it at load time
# points at the line someone actually typed.

HOSTED = """
hosted:
  protocol: responses
  cpu: 1
  memory_gib: 2
  idle_timeout_minutes: 15
"""


def test_hosted_defaults_to_absent(tmp_path):
    """A prompt agent has no container to size, and that is different from an unset one."""
    assert load_agent_spec(write(tmp_path, VALID)).hosted is None


def test_hosted_is_read_from_the_definition(tmp_path):
    spec = load_agent_spec(write(tmp_path, VALID + HOSTED))
    assert spec.hosted == {
        "protocol": "responses",
        "cpu": 1,
        "memory_gib": 2,
        "idle_timeout_minutes": 15,
    }


def test_rejects_a_sandbox_size_foundry_does_not_offer(tmp_path):
    """The three documented sizes are a closed set; 4 vCPU is a deploy-time failure otherwise."""
    bad = VALID + HOSTED.replace("cpu: 1", "cpu: 4")
    with pytest.raises(AgentSpecError, match="not one of the sizes"):
        load_agent_spec(write(tmp_path, bad))


def test_rejects_an_idle_timeout_outside_the_documented_range(tmp_path):
    """2-60 minutes, 15 by default — read 2026-09-16. An earlier note said 5-60 and was stale."""
    bad = VALID + HOSTED.replace("idle_timeout_minutes: 15", "idle_timeout_minutes: 90")
    with pytest.raises(AgentSpecError, match="2-60"):
        load_agent_spec(write(tmp_path, bad))


def test_rejects_an_unknown_protocol(tmp_path):
    bad = VALID + HOSTED.replace("protocol: responses", "protocol: graphql")
    with pytest.raises(AgentSpecError, match="graphql"):
        load_agent_spec(write(tmp_path, bad))


def test_rejects_an_incomplete_hosted_block(tmp_path):
    """Half a sandbox definition would silently take Foundry's defaults for the other half —
    which is exactly the one-place-only claim AC11 makes, broken."""
    bad = VALID + "\nhosted:\n  protocol: responses\n"
    with pytest.raises(AgentSpecError, match="cpu"):
        load_agent_spec(write(tmp_path, bad))
