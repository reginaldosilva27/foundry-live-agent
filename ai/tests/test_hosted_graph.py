"""The container runs THIS repository's tools, in a graph with visible nodes (spec 018, AC6).

Two claims, and they are the ones a reader would otherwise have to take on trust.

**AC6 — one implementation, two processes.** The prompt agent's function tools run in the BFF; the
hosted agent's run in a container. If the container carried its own copy, "the two harnesses run the
same tools" would be a coincidence maintained by hand, and the comparison spec 020 builds would be
measuring two different agents. So the assertion is *identity*, not equality: the callable the graph
invokes must be the object `registry` holds.

**Decision 4 — a graph you can see.** A one-line `create_agent` would have produced a harness called
"LangGraph" that shows no graph. The nodes are named and asserted because they are the teaching
material.

These tests import the graph module but never build a model client or reach Azure — the model is
injected, exactly as the prompt agent's stream is.
"""

import pytest

from harness._shared.tools import registry

langgraph = pytest.importorskip(
    "langgraph",
    reason="the hosted agent's own dependencies (ai/harness/langgraph/agent/requirements.txt) "
    "are not installed; CI runs the contract suite on fixtures and needs neither",
)

from harness.langgraph.agent import graph as graph_module  # noqa: E402
from harness.langgraph.agent import tools as tools_module  # noqa: E402

# --- AC6: the tools are the registry's ------------------------------------


def test_the_container_exposes_every_registered_function_tool():
    assert sorted(t.name for t in tools_module.function_tools()) == registry.tool_names()


def test_each_tool_calls_the_registry_implementation_itself():
    """Identity, not equality. A vendored copy would pass an equality check on the first day."""
    for tool in tools_module.function_tools():
        assert tool.func is registry.get(tool.name).call


def test_each_tool_carries_the_registry_description_and_schema():
    """Foundry's prompt agent gets these from the registry too — same source, same words (§4)."""
    for tool in tools_module.function_tools():
        spec = registry.get(tool.name)
        assert tool.description == spec.description
        assert tool.args_schema == spec.schema


def test_the_learn_mcp_server_comes_from_the_shared_definition():
    """The container is the MCP client here (decision 5), but the server it points at is still the
    one both harnesses declare — otherwise the two agents would be searching different corpora."""
    from harness._shared.agent_spec import load_agent_spec

    spec = load_agent_spec(graph_module.AGENT_YAML)
    declared = next(m for m in spec.mcp_tools if m.name == "microsoft_learn")
    assert tools_module.mcp_server_config(spec)["microsoft_learn"]["url"] == declared.server_url


# --- decision 4: an explicit graph, and no checkpointer -------------------


def test_the_graph_has_the_two_named_nodes():
    compiled = graph_module.build_graph(model=_StubModel(), tools=[])
    assert set(compiled.get_graph().nodes) - {"__start__", "__end__"} == {"agent", "tools"}


def test_the_graph_loops_agent_to_tools_and_back():
    """`agent -> tools -> agent` is the loop this spec moved out of Foundry. Asserting the edge back
    is what distinguishes a graph from a single model call with a tool attached."""
    compiled = graph_module.build_graph(_StubModel(), [])
    edges = {(e.source, e.target) for e in compiled.get_graph().edges}
    assert ("tools", "agent") in edges
    assert ("__start__", "agent") in edges


def test_the_graph_has_no_checkpointer():
    """Decision 4 — conversation state stays Foundry's, exactly as with the prompt agent.

    Documented 2026-09-16: with no checkpointer the host replays Responses history into the graph;
    with one it sends only the current input and keys state by conversation thread. A checkpointer
    here would mean this repository owned state the platform already owns, which §8 calls out by
    name — and it would make the two harnesses differ in two things instead of one.
    """
    assert graph_module.build_graph(_StubModel(), []).checkpointer is None


class _StubModel:
    """Stands in for the chat model. The graph must be buildable without a credential."""

    def bind_tools(self, tools):
        return self

    def invoke(self, *_args, **_kwargs):  # pragma: no cover - never called by these tests
        raise AssertionError("the graph tests must not call the model")
