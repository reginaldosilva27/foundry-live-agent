"""The container's tools — the repository's, not copies of them (spec 018, AC6).

The prompt agent's function tools run in the BFF. The hosted agent's run here. If this module
reimplemented them, "both harnesses run the same tools" would be a claim maintained by hand, and
the comparison spec 020 builds would be measuring two different agents. So there is exactly one
implementation — `harness/_shared/tools/` — and this module wraps it.

The wrapping is the whole file. `StructuredTool.from_function` takes the registry's own callable,
description and JSON schema; nothing here decides anything about a tool.

**Microsoft Learn is different in one way that matters.** With the prompt agent, Foundry is the MCP
client and the call surfaces as an `mcp_call`. Here the *container* is the MCP client, so the call
is an ordinary tool call in the graph — which is why this harness never emits `mcp_call`, and why
the spec calls that the finding rather than a regression (decision 5).
"""

from __future__ import annotations

from typing import Any

from langchain_core.tools import StructuredTool

from harness._shared.agent_spec import AgentSpec
from harness._shared.tools import registry

__all__ = ["function_tools", "load_mcp_tools", "mcp_server_config"]


def function_tools() -> list[StructuredTool]:
    """Every registered function tool, as a LangChain tool.

    `func=spec.call` is deliberate and is what AC6's test asserts by identity: the graph invokes
    the registry's object, not a copy of its behaviour.
    """
    return [
        StructuredTool.from_function(
            func=spec.call,
            name=spec.name,
            description=spec.description,
            args_schema=spec.schema,
        )
        for spec in registry.specs()
    ]


def mcp_server_config(spec: AgentSpec) -> dict[str, dict[str, Any]]:
    """The MCP servers the agent definition declares, in `langchain-mcp-adapters` shape.

    Read from the same `agent.yaml` the prompt agent declares to Foundry, so the two harnesses
    cannot end up searching different corpora. `streamable_http` is the transport the Learn server
    speaks; the server is public, unauthenticated and read-only, so there is no credential here.
    """
    return {
        mcp.name: {"url": mcp.server_url, "transport": "streamable_http"} for mcp in spec.mcp_tools
    }


async def load_mcp_tools(spec: AgentSpec) -> list[Any]:
    """Connect to the declared MCP servers and return their tools.

    Separate from :func:`function_tools` because it does I/O: it is called once at startup, and a
    Learn server that is unreachable then should fail the container loudly rather than produce an
    agent that silently lost a tool its instructions tell it to use (§5).
    """
    from langchain_mcp_adapters.client import MultiServerMCPClient

    servers = mcp_server_config(spec)
    if not servers:
        return []
    return await MultiServerMCPClient(servers).get_tools()
