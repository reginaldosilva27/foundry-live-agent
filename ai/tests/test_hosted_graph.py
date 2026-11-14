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


async def test_an_mcp_server_that_never_answers_fails_startup_loudly(monkeypatch):
    """Regression (2026-10-15): `get_tools()` had no bound, so a Learn server that accepted the
    connection and never answered hung the container until a health probe killed it — silently,
    the opposite of what this function's docstring promises (§5)."""
    import asyncio

    import langchain_mcp_adapters.client as client_module

    from harness._shared.agent_spec import load_agent_spec

    class Silent:
        def __init__(self, servers):
            pass

        async def get_tools(self):
            await asyncio.sleep(3600)

    monkeypatch.setattr(client_module, "MultiServerMCPClient", Silent)
    monkeypatch.setattr(tools_module, "MCP_STARTUP_TIMEOUT", 0.05)
    spec = load_agent_spec(graph_module.AGENT_YAML)

    with pytest.raises(RuntimeError, match="learn.microsoft.com"):
        await tools_module.load_mcp_tools(spec)


# --- spec 067, AC6: the agent's own instructions survive a developer item ----


class _RecordingModel:
    """Answers once, with no tool call, and keeps what it was given."""

    def __init__(self) -> None:
        self.seen: list[list] = []

    def bind_tools(self, tools):
        return self

    def invoke(self, messages, *_args, **_kwargs):
        from langchain_core.messages import AIMessage

        self.seen.append(list(messages))
        return AIMessage(content="ok")


def _content(message) -> str:
    return message["content"] if isinstance(message, dict) else message.content


def test_a_developer_item_does_not_replace_the_agents_instructions():
    """AC6 — the BFF now opens every turn with the current moment, as a `developer` message, and
    LangChain reads `developer` as a `SystemMessage`. The graph used to apply its instructions only
    when the history held **no** system message — so that one timestamp would have silently stood
    in for the whole agent definition. Its instructions go first, whatever else arrived."""
    from langchain_core.messages import HumanMessage, SystemMessage

    model = _RecordingModel()
    graph = graph_module.build_graph(model, [], instructions="AGENT DEFINITION")
    moment = SystemMessage(
        content="Current date and time: Saturday, 14 November 2026, 22:30 "
        "(America/Sao_Paulo, UTC-03:00).",
        additional_kwargs={"__openai_role__": "developer"},
    )

    graph.invoke({"messages": [moment, HumanMessage(content="que dia é hoje?")]})

    (given,) = model.seen
    assert _content(given[0]) == "AGENT DEFINITION"
    assert [_content(m) for m in given[1:]] == [moment.content, "que dia é hoje?"]


def test_the_instructions_are_not_applied_twice():
    """AC6 — the Responses host replays the history every turn (no checkpointer), and the graph
    never stores the instructions in it; but a history that already opens with them gets no copy."""
    from langchain_core.messages import HumanMessage, SystemMessage

    model = _RecordingModel()
    graph = graph_module.build_graph(model, [], instructions="AGENT DEFINITION")

    graph.invoke(
        {"messages": [SystemMessage(content="AGENT DEFINITION"), HumanMessage(content="oi")]}
    )

    (given,) = model.seen
    assert [_content(m) for m in given] == ["AGENT DEFINITION", "oi"]
