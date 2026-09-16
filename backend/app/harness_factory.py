"""Selects the harness from `AGENT_HARNESS`.

The BFF talks to a harness only through the §9 Protocol, so this is the single place a harness name
becomes an object. Selection happens **at startup**: a bad value should stop the process with an
explanation, not surface as a confusing failure on the first user message.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping, MutableMapping
from pathlib import Path
from typing import Any

import harness._shared
from harness._shared.contract import HarnessAdapter

from app.settings import Settings
from app.tool_executor import execute

__all__ = ["build_harness"]

# Observed 2026-09-16: the hosted agent endpoint REQUIRES this, and the documented URL shape
# omits it — `400 BadRequest — Missing required query parameter: api-version` without it.
HOSTED_API_VERSION = "v1"
_AZURE_AI_SCOPE = "https://ai.azure.com/.default"

# The hosted agent's definition. `ai/` is on the path; this resolves the same file
# `just hosted-config` generates azure.yaml from.
_HOSTED_AGENT_YAML = (
    Path(harness._shared.__file__).resolve().parent.parent / "langgraph" / "agent.yaml"
)


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
        from harness._shared.agent_spec import load_agent_spec
        from harness.langgraph.adapter import LangGraphAdapter

        # The agent's NAME comes from its own definition, not from AGENT_NAME. A hosted agent
        # cannot share a name with the prompt agent in one project, and an env var that can
        # disagree with the definition would be a second source of truth (§4). AGENT_NAME stays
        # the prompt agent's; spec 019 generalises selection.
        spec = load_agent_spec(_HOSTED_AGENT_YAML)
        return LangGraphAdapter(
            stream_factory=stream_factory or _hosted_stream_factory(settings, spec.name),
            agent_name=spec.name,
            project_name=settings.project_name,
            agent_version=settings.agent_version,
        )

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


def _hosted_stream_factory(settings: Settings, agent_name: str) -> Callable[..., Any]:
    """The real stream for a hosted agent: its OWN endpoint, not the project's Responses API.

    A hosted agent is reached at
    `{project_endpoint}/agents/{name}/endpoint/protocols/openai/responses`, live as soon as it is
    deployed — publishing is not required. Two details cost a turn each to discover, so they are
    written down rather than left in a commit message (§10, observed 2026-09-16):

    - **`api-version=v1` is required** and the documented endpoint shape omits it. Without it the
      service answers `400 BadRequest — Missing required query parameter: api-version`. `azd deploy`
      prints the URL with it, which is the accurate source.
    - **There is no tool round trip**, so unlike the prompt agent's factory there is no conversation
      to create and bind. The container owns its loop; one request is the whole turn. Continuing a
      thread is `previous_response_id` or a `conversation` id, which spec 019 will wire up.
    """
    import httpx

    def factory(messages, conversation_state: MutableMapping[str, Any]):
        from azure.identity import DefaultAzureCredential

        from app.settings import require_live_settings

        require_live_settings(settings)
        endpoint = settings.project_endpoint.rstrip("/")
        url = (
            f"{endpoint}/agents/{agent_name}/endpoint/protocols/openai/responses"
            f"?api-version={HOSTED_API_VERSION}"
        )
        token = DefaultAzureCredential().get_token(_AZURE_AI_SCOPE).token

        body: dict[str, Any] = {"input": _as_input(messages), "stream": True}
        if previous := conversation_state.get("response_id"):
            body["previous_response_id"] = previous

        with (
            httpx.Client(timeout=300.0) as client,
            client.stream(
                "POST",
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                },
                json=body,
            ) as response,
        ):
            response.raise_for_status()
            for line in response.iter_lines():
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if payload and payload != "[DONE]":
                    yield json.loads(payload)

    return factory


def _as_input(messages: list[Mapping[str, Any]]) -> str | list[Mapping[str, Any]]:
    """The turn's input. A lone user message goes as a plain string, which is what the recorded
    turns were driven with; anything richer goes through as items."""
    if len(messages) == 1 and messages[0].get("role", "user") == "user":
        return str(messages[0]["content"])
    return [
        {"type": "message", "role": m.get("role", "user"), "content": m["content"]}
        for m in messages
    ]
