"""Selects the harness from `AGENT_HARNESS`.

The BFF talks to a harness only through the §9 Protocol, so this is the single place a harness name
becomes an object. Selection happens **at startup**: a bad value should stop the process with an
explanation, not surface as a confusing failure on the first user message.
"""

from __future__ import annotations

from collections.abc import Callable, MutableMapping
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


def _openai_client(settings: Settings):
    """The OpenAI-shaped client for the Foundry project. Built lazily, so importing this module
    needs no Azure SDK and no credential — which is what lets the whole loop be tested with an
    injected stream."""
    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential

    from app.settings import require_live_settings

    require_live_settings(settings)
    project = AIProjectClient(
        endpoint=settings.project_endpoint, credential=DefaultAzureCredential()
    )
    return project.get_openai_client()


def _foundry_stream_factory(settings: Settings) -> Callable[..., Any]:
    """The real stream: Responses API against the Foundry project endpoint.

    **Every leg of a turn must name the same conversation.** The second leg carries only
    `function_call_output` items; with no conversation binding it to the leg that emitted the call,
    Foundry has no record of what is being answered and rejects the request:

        400 — No tool call found for function call output with call_id call_…

    Observed 2026-09-15; the recorded turn in `ai/tests/fixtures/recorded/` was produced with both
    legs bound to one conversation (`ai/scripts/spike.py`). So a turn that arrives without one —
    every first message — gets a conversation created here, written back into `conversation_state`,
    which the adapter hands unchanged to each leg. The id also leaves on `trace_ids`, so the
    browser sends it with the next turn and the thread continues.

    Creating the conversation is not agent-loop logic (§8): it is Foundry's state, named, not
    duplicated here.
    """

    cached: list[Any] = []

    def client() -> Any:
        # Built once. Every build is a fresh `DefaultAzureCredential`, and acquiring a token costs
        # seconds — paid before the first byte of the turn, and again on the leg that answers a
        # tool call. The browser sees that as a turn that sits there doing nothing.
        if not cached:
            cached.append(_openai_client(settings))
        return cached[0]

    def factory(inputs, conversation_state: MutableMapping[str, Any]):
        openai = client()

        conversation_id = conversation_state.get("conversation_id")
        if not conversation_id:
            conversation_id = openai.conversations.create().id
            conversation_state["conversation_id"] = conversation_id

        request: dict[str, Any] = {
            "input": inputs,
            "conversation": conversation_id,
            "stream": True,
            "extra_body": {
                "agent_reference": {"name": settings.agent_name, "type": "agent_reference"}
            },
        }

        for event in openai.responses.create(**request):
            yield event.model_dump() if hasattr(event, "model_dump") else dict(event)

    return factory
