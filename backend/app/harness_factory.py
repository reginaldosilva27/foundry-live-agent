"""Selects the harness from `AGENT_HARNESS`.

The BFF talks to a harness only through the §9 Protocol, so this is the single place a harness name
becomes an object. Selection happens **at startup**: a bad value should stop the process with an
explanation, not surface as a confusing failure on the first user message.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from harness._shared.contract import HarnessAdapter

from app.settings import Settings
from app.tool_executor import execute

__all__ = ["build_harness"]


def _executor(name: str, arguments: str) -> tuple[str, int, str | None]:
    """Adapt the BFF's executor to the shape the adapter expects. No tool knowledge here (§8)."""
    result = execute(name, arguments)
    return result.output, result.duration_ms, result.error


def build_harness(settings: Settings, stream_factory: Callable[..., Any] | None = None):
    """Return the adapter named by ``settings.harness``."""
    name = settings.harness

    if name == "prompt-agent":
        from harness.prompt_agent.adapter import PromptAgentAdapter

        factory = stream_factory or _foundry_stream_factory(settings)
        adapter: HarnessAdapter = PromptAgentAdapter(
            stream_factory=factory,
            executor=_executor,
            agent_name=settings.agent_name,
            project_name=settings.project_name,
            agent_version=settings.agent_version,
        )
        return adapter

    if name == "langgraph":
        from harness.langgraph.adapter import LangGraphAdapter

        return LangGraphAdapter()  # raises NotImplementedError, by design

    raise ValueError(
        f"unknown harness {name!r}; AGENT_HARNESS must be 'prompt-agent' or 'langgraph'"
    )


def _foundry_stream_factory(settings: Settings) -> Callable[..., Any]:
    """The real stream: Responses API against the Foundry project endpoint.

    Built lazily so importing this module needs no Azure SDK and no credential — which is what lets
    the whole loop be tested with an injected stream.
    """

    def factory(inputs, conversation_state):
        from azure.ai.projects import AIProjectClient
        from azure.identity import DefaultAzureCredential

        from app.settings import require_live_settings

        require_live_settings(settings)
        project = AIProjectClient(
            endpoint=settings.project_endpoint, credential=DefaultAzureCredential()
        )
        openai = project.get_openai_client()

        request: dict[str, Any] = {
            "input": inputs,
            "stream": True,
            "extra_body": {
                "agent_reference": {"name": settings.agent_name, "type": "agent_reference"}
            },
        }
        if conversation_id := conversation_state.get("conversation_id"):
            request["conversation"] = conversation_id

        for event in openai.responses.create(**request):
            yield event.model_dump() if hasattr(event, "model_dump") else dict(event)

    return factory
