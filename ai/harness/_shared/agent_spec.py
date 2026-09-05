"""Loader and validator for `agent.yaml` — the agent definition as code.

**This schema is ours, not Foundry's.** Foundry's own `agent.yaml` (AgentSchema) is deprecated,
superseded by `azure.yaml` for *hosted* agents — which is not a prompt-agent format. Rather than
teach a retired schema or invent a hosted-agent file for an agent that isn't hosted, this is a small
declared format of our own, marked `schema_version: foundry-live-agent/v1` so nobody mistakes it for
a Microsoft one. See `docs/harness-comparison.md`.

The validation that earns its keep is the registry cross-check: a definition naming a function tool
nobody implements is rejected **at load time**. Without it, that mistake reaches production as an
agent that emits a call the BFF cannot answer — and an unanswered call hangs the run for ten minutes
while looking, from the browser, like the stream just stopped.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from harness._shared.tools import registry

__all__ = ["AgentSpec", "AgentSpecError", "FunctionToolSpec", "McpToolSpec", "load_agent_spec"]

SCHEMA_VERSION = "foundry-live-agent/v1"
_REQUIRED = ("schema_version", "name", "model", "instructions", "tools")


class AgentSpecError(ValueError):
    """The agent definition is malformed or refers to something that doesn't exist."""


@dataclass(frozen=True)
class FunctionToolSpec:
    """A tool Foundry asks us to run. Schema and description come from the registry."""

    name: str
    description: str
    schema: dict[str, Any]


@dataclass(frozen=True)
class McpToolSpec:
    """A remote MCP server Foundry calls itself."""

    name: str
    server_url: str
    require_approval: str = "never"
    allowed_tools: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class AgentSpec:
    """A validated agent definition."""

    name: str
    model: str
    instructions: str
    function_tools: list[FunctionToolSpec]
    mcp_tools: list[McpToolSpec]
    description: str = ""

    @property
    def uses_gateway(self) -> bool:
        """True when the model routes through a bring-your-own-model connection.

        A plain model name means the agent talks to a normal Foundry deployment and **bypasses the
        gateway** — easy to do by accident, and invisible unless something says so.
        """
        return "/" in self.model


def load_agent_spec(path: Path | str) -> AgentSpec:
    """Load and validate an agent definition, or raise :class:`AgentSpecError`."""
    path = Path(path)
    try:
        raw = yaml.safe_load(path.read_text())
    except FileNotFoundError:
        raise AgentSpecError(f"no agent definition at {path}") from None
    except yaml.YAMLError as exc:
        raise AgentSpecError(f"{path} is not valid YAML: {exc}") from None

    if not isinstance(raw, dict):
        raise AgentSpecError(f"{path} must contain a mapping at the top level")

    missing = [key for key in _REQUIRED if key not in raw]
    if missing:
        raise AgentSpecError(f"{path} is missing required field(s): {', '.join(missing)}")

    if raw["schema_version"] != SCHEMA_VERSION:
        raise AgentSpecError(
            f"{path}: unsupported schema_version {raw['schema_version']!r}; "
            f"this loader understands {SCHEMA_VERSION!r}"
        )

    function_tools: list[FunctionToolSpec] = []
    mcp_tools: list[McpToolSpec] = []

    for index, entry in enumerate(raw["tools"] or []):
        where = f"{path}: tools[{index}]"
        if not isinstance(entry, dict) or "type" not in entry or "name" not in entry:
            raise AgentSpecError(f"{where} must be a mapping with 'type' and 'name'")

        kind, name = entry["type"], entry["name"]
        if kind == "function":
            try:
                spec = registry.get(name)
            except registry.UnknownToolError as exc:
                raise AgentSpecError(
                    f"{where}: declares function tool {name!r}, which no implementation "
                    f"answers to. {exc}"
                ) from None
            function_tools.append(
                FunctionToolSpec(name=spec.name, description=spec.description, schema=spec.schema)
            )
        elif kind == "mcp":
            if not entry.get("server_url"):
                raise AgentSpecError(f"{where}: MCP tool {name!r} needs a 'server_url'")
            mcp_tools.append(
                McpToolSpec(
                    name=name,
                    server_url=entry["server_url"],
                    require_approval=entry.get("require_approval", "never"),
                    allowed_tools=list(entry.get("allowed_tools") or []),
                )
            )
        else:
            raise AgentSpecError(
                f"{where}: unknown tool type {kind!r}; expected 'function' or 'mcp'"
            )

    return AgentSpec(
        name=raw["name"],
        model=raw["model"],
        instructions=raw["instructions"],
        description=raw.get("description", ""),
        function_tools=function_tools,
        mcp_tools=mcp_tools,
    )
