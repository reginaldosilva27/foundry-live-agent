"""The graph — `agent` -> `tools` -> `agent`, and nothing else (spec 018, decision 4).

Written as an explicit `StateGraph` rather than a one-line `create_agent`, because a harness called
"LangGraph" that shows no graph teaches nobody anything. The two nodes are the loop this spec moved
out of Foundry's prompt runtime and into a container, and they are named so a reader can point at
them.

**No checkpointer, on purpose.** Documented 2026-09-16: with no checkpointer the Responses host
replays the conversation history into the graph on every turn; with one it sends only the current
input and keys state by conversation thread. Adding one here would mean this repository owned state
the platform already owns — the thing §8 names outright — and it would make the two harnesses
differ in two ways instead of the one this spec is about.

The model is a parameter, not something this module builds. That is what lets the graph be tested
without a credential, and it is the same injection the prompt-agent adapter uses for its stream.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

__all__ = ["AGENT_YAML", "build_graph"]

# The definition this agent runs, shared with the prompt agent through `extends:` (§4, AC5).
AGENT_YAML = Path(__file__).resolve().parent.parent / "agent.yaml"


def build_graph(model: Any, tools: list[Any], instructions: str = "") -> Any:
    """Compile `agent` -> `tools` -> `agent`.

    ``instructions`` is prepended as a system message when the incoming history has none. This is
    not the app prompting the agent (§8): it is the agent's *own* definition, read from the
    `agent.yaml` this harness ships, applied by the code that **is** the agent. The prompt agent's
    equivalent is Foundry applying `instructions` from its agent version.
    """
    bound = model.bind_tools(tools) if tools else model

    def agent(state: MessagesState) -> dict[str, list]:
        messages = list(state["messages"])
        if instructions and not any(
            getattr(m, "type", None) == "system" for m in messages
        ):
            messages.insert(0, {"role": "system", "content": instructions})
        return {"messages": [bound.invoke(messages)]}

    builder = StateGraph(MessagesState)
    builder.add_node("agent", agent)
    builder.add_node("tools", ToolNode(tools))
    builder.add_edge(START, "agent")
    # `tools_condition` routes to "tools" when the last message carries tool calls, else to END.
    builder.add_conditional_edges("agent", tools_condition, {"tools": "tools", END: END})
    builder.add_edge("tools", "agent")

    # No checkpointer. See the module docstring — this is the load-bearing omission.
    return builder.compile()
