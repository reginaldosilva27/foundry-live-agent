"""The tool registry — the one place a tool name resolves to code.

This module knows every tool; **no tool knows another**. That asymmetry is deliberate: it means a
tool cannot dispatch to a sibling, and the only thing that maps a name to a callable is a table with
no branching in it.

The BFF's job is `registry.get(name).call(**arguments)`. Nothing in that sentence is a decision:
Foundry chose the name and the arguments.
"""

from __future__ import annotations

import os
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from harness._shared.tools import datetime_tool, knowledge_tool
from harness._shared.tools.knowledge_tool import KnowledgeSource, LocalMarkdownKnowledge

__all__ = ["ToolSpec", "UnknownToolError", "get", "specs", "tool_names"]

DEFAULT_KNOWLEDGE_DIR = Path(__file__).resolve().parent / "knowledge"


class UnknownToolError(KeyError):
    """A tool name that no implementation answers to."""


@dataclass(frozen=True)
class ToolSpec:
    """Everything Foundry needs to declare a tool, plus the code that runs it."""

    name: str
    description: str
    schema: dict[str, Any]
    call: Callable[..., dict[str, Any]]


def _knowledge_source() -> KnowledgeSource:
    """The knowledge backing store. Swap this line for Foundry IQ; nothing else changes."""
    return LocalMarkdownKnowledge(os.environ.get("KNOWLEDGE_DIR") or DEFAULT_KNOWLEDGE_DIR)


def _lookup_knowledge(query: str) -> dict[str, Any]:
    return knowledge_tool.lookup_knowledge(query, source=_knowledge_source())


_REGISTRY: dict[str, ToolSpec] = {
    "get_current_datetime": ToolSpec(
        name="get_current_datetime",
        description=(
            "Get the current date and time in a given IANA timezone. "
            "Use whenever the answer depends on what time it is now."
        ),
        schema=datetime_tool.SCHEMA,
        call=datetime_tool.get_current_datetime,
    ),
    "lookup_knowledge": ToolSpec(
        name="lookup_knowledge",
        description=(
            "Search this project's own knowledge base for background on how it is built. "
            "Use for questions about this repository, not for general Azure documentation."
        ),
        schema=knowledge_tool.SCHEMA,
        call=_lookup_knowledge,
    ),
}


def tool_names() -> list[str]:
    """Every registered tool name."""
    return sorted(_REGISTRY)


def specs() -> list[ToolSpec]:
    """Every registered tool, for building an agent definition."""
    return [_REGISTRY[name] for name in tool_names()]


def get(name: str) -> ToolSpec:
    """Resolve a tool name, or raise :class:`UnknownToolError`.

    Raising here is right — unlike inside a tool, an unknown *name* means the agent definition and
    the registry disagree, which is a bug the BFF must surface, not paper over.
    """
    try:
        return _REGISTRY[name]
    except KeyError:
        raise UnknownToolError(
            f"no tool named {name!r}; registered tools are {tool_names()}"
        ) from None
