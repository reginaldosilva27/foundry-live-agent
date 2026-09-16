"""The two harnesses answer the same way, and a test says so (spec 018, AC5 · AC11).

Behavioral parity is this spec's whole claim: *only the harness changed*. A comparison between two
agents that quietly drifted apart in their instructions measures nothing, and "a reviewer will
notice" is not a control — so the model, the instructions and the tool set live in exactly one file
(`harness/_shared/agent_core.yaml`) and both definitions `extends:` it.

These tests are belt and braces on that arrangement. The braces are structural: with the prose in
one file it *cannot* drift. The belt is here: if someone ever re-inlines it, the assertion fails
before the comparison starts lying.
"""

from pathlib import Path

import pytest

from harness._shared.agent_spec import load_agent_spec

HARNESS = Path(__file__).resolve().parent.parent / "harness"
CORE = HARNESS / "_shared" / "agent_core.yaml"
PROMPT_AGENT = HARNESS / "prompt_agent" / "agent.yaml"
HOSTED = HARNESS / "langgraph" / "agent.yaml"


@pytest.fixture
def prompt_agent():
    return load_agent_spec(PROMPT_AGENT)


@pytest.fixture
def hosted():
    return load_agent_spec(HOSTED)


def test_both_harnesses_run_the_same_model(prompt_agent, hosted):
    assert prompt_agent.model == hosted.model


def test_both_harnesses_run_the_same_instructions(prompt_agent, hosted):
    """Character for character. A paraphrase is a different agent wearing the same name."""
    assert prompt_agent.instructions == hosted.instructions


def test_both_harnesses_declare_the_same_tools(prompt_agent, hosted):
    def names(spec):
        return sorted(t.name for t in [*spec.function_tools, *spec.mcp_tools])

    assert names(prompt_agent) == names(hosted)
    assert names(hosted) == [
        "get_current_datetime",
        "lookup_knowledge",
        "microsoft_learn",
        "search_web",
    ]


def test_neither_definition_inlines_what_the_core_owns():
    """The guard that keeps the parity above structural rather than coincidental.

    Both files must *name* the core and carry none of it. Without this, someone copies the
    instructions back in, the assertions above still pass on the day of the copy, and the two
    agents drift apart a month later with nothing failing.
    """
    for path in (PROMPT_AGENT, HOSTED):
        text = path.read_text()
        assert "extends:" in text, f"{path.name} must extend the shared core"
        for owned in ("instructions:", "model:", "tools:"):
            assert owned not in text, (
                f"{path.name} declares {owned!r}, which belongs to agent_core.yaml (§4)"
            )


def test_the_core_is_the_only_place_the_instructions_live():
    assert "instructions:" in CORE.read_text()


# --- what each harness is allowed to differ on ----------------------------


def test_only_the_prompt_agent_asks_foundry_for_reasoning_summaries(prompt_agent, hosted):
    """`reasoning` is a prompt-agent definition field — the hosted agent's loop is our code.

    Whether a hosted turn produces summaries at all is AC13's measurement, not a setting we get to
    assert here.
    """
    assert prompt_agent.reasoning == {"summary": "detailed"}
    assert hosted.reasoning is None


def test_the_two_agents_have_different_names(prompt_agent, hosted):
    """They live in one Foundry project, where a name is unique."""
    assert prompt_agent.name != hosted.name
    assert hosted.name == "foundry-live-agent-hosted"


# --- the hosted sandbox, stated once (AC11) -------------------------------


def test_the_hosted_sizing_is_declared_once_in_the_definition(hosted):
    """1 vCPU / 2 GiB and the 15-minute default idle timeout — decision 9.

    Chosen deliberately, not measured: the documented right-sizing procedure wants representative
    load first. Billing is CPU+memory across *active sessions*, so oversizing multiplies by
    concurrency, which is why the value is asserted rather than left to a deploy-time default.
    """
    assert hosted.hosted == {
        "protocol": "responses",
        "cpu": 1,
        "memory_gib": 2,
        "idle_timeout_minutes": 15,
    }


def test_the_prompt_agent_has_no_hosted_block(prompt_agent):
    """It has no container to size. An empty block would read as 'unset', not 'not applicable'."""
    assert prompt_agent.hosted is None


def test_neither_harness_goes_through_the_gateway(prompt_agent, hosted):
    """Decision 8 — the hosted agent matches the prompt agent's deliberate bypass, so the two
    harnesses differ in one thing. Both are restored together when the APIM API is bound to its
    backend; this assertion is what makes restoring one and forgetting the other fail."""
    assert not prompt_agent.uses_gateway
    assert not hosted.uses_gateway
