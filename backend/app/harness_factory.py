"""Turns a harness name — or a chosen agent — into an adapter.

The BFF talks to a harness only through the §9 Protocol, so this is the single place a harness name
becomes an object. `AGENT_HARNESS` is still resolved **at startup**, so a bad value stops the
process with an explanation rather than surfacing as a confusing failure on someone's first
message. Spec 019 added the second entrance: a person picks an agent on the screen, and the turn
gets an adapter built for *that* agent, per request.

**Per request, not a swapped singleton.** `app.state.harness` stays the default and is never
mutated. Replacing it on selection would be process-global mutable state: one browser's choice
would change another browser's turn, and a turn already streaming could have its adapter swapped
underneath it. Adapters are cheap — a closure and a name. The expensive things are the credential
and the project client, which is why they live in :class:`AzureClients`, built once per process and
handed to every build.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping, MutableMapping
from pathlib import Path
from typing import TYPE_CHECKING, Any

import harness._shared
from harness._shared.contract import HarnessAdapter

from app.settings import Settings
from app.tool_executor import execute

if TYPE_CHECKING:  # an annotation only — importing it for real would close a cycle with app.agents
    from app.agents import AgentSummary

__all__ = [
    "EXAMPLES_FOR_AGENT",
    "HARNESS_FOR_KIND",
    "OWNED_AGENT_NAMES",
    "AzureClients",
    "build_harness",
]

# Which agent kinds THIS BUILD can drive, and with what (spec 019).
#
# One home, because two places would disagree: `app/agents.py` uses it to decide whether a row on
# the agents screen is selectable, and `build_harness` uses it to pick an adapter. A screen that
# offers an agent the factory then refuses is exactly the dishonesty §5 names.
#
# This is not agent-loop logic (§8). The app is not choosing which agent answers — a person is, and
# this table is the app reporting what it can run. `workflow`, and anything Foundry adds later,
# is absent on purpose: an unknown kind is listed and disabled with a reason, never hidden.
HARNESS_FOR_KIND: dict[str, str] = {
    "prompt": "prompt-agent",
    "hosted": "langgraph",
}


# Which agents THIS REPOSITORY authored (spec 031).
#
# Read from the harness definitions rather than written down, for the same reason
# `HARNESS_FOR_KIND` has one home: the names are already stated in `ai/harness/*/agent.yaml`, which
# is what `apply_agent.py` deploys, and a second copy here would drift on the first rename (§4). A
# fork that edits those files gets its own agents in the allowlist with no code change.
#
# It exists because promoting a version is a **write** that changes what the whole project serves.
# The recorded listing holds ten agents and eight of them are other people's work; bounding the
# blast radius to what this repository created is the same sentence spec 031's non-goals use to
# justify promoting at all. Enforced in the BFF, not only in the UI — a restriction the server does
# not keep is not a restriction.
def _owned_agent_names() -> frozenset[str]:
    import yaml

    root = Path(harness._shared.__file__).resolve().parent.parent
    names = set()
    for path in sorted(root.glob("*/agent.yaml")):
        try:
            loaded = yaml.safe_load(path.read_text()) or {}
        except Exception:  # noqa: BLE001 - an unreadable harness must not stop the process
            continue
        if name := loaded.get("name"):
            names.add(str(name))
    return frozenset(names)


OWNED_AGENT_NAMES: frozenset[str] = _owned_agent_names()


# What each of our agents is worth being asked (spec 037).
#
# Read from the same definitions, for the same reason: what an agent is good at is a property of
# the AGENT, and a list of example questions in the frontend was a second description of it, free
# to drift (§4). The service's listing has no field that could carry these — it returns
# `instructions`, `model`, `tools` and `reasoning` — so the BFF joins its rows against ours by
# name, and an agent we did not write simply has none. That is a permanent limitation and the
# honest one: we cannot know what somebody else's agent is for.
def _examples_for_agent() -> dict[str, list[dict[str, str]]]:
    from harness._shared.agent_spec import load_agent_spec

    root = Path(harness._shared.__file__).resolve().parent.parent
    out: dict[str, list[dict[str, str]]] = {}
    for path in sorted(root.glob("*/agent.yaml")):
        try:
            spec = load_agent_spec(path)
        except Exception:  # noqa: BLE001 - one bad harness must not stop the process
            continue
        if spec.examples:
            out[spec.name] = [example.as_dict() for example in spec.examples]
    return out


EXAMPLES_FOR_AGENT: dict[str, list[dict[str, str]]] = _examples_for_agent()

# Observed 2026-09-16: the hosted agent endpoint REQUIRES this, and the documented URL shape
# omits it — `400 BadRequest — Missing required query parameter: api-version` without it.
HOSTED_API_VERSION = "v1"
_AZURE_AI_SCOPE = "https://ai.azure.com/.default"

# The hosted agent's definition. `ai/` is on the path; this resolves the same file
# `just hosted-config` generates azure.yaml from.
_HOSTED_AGENT_YAML = (
    Path(harness._shared.__file__).resolve().parent.parent / "langgraph" / "agent.yaml"
)


class AzureClients:
    """The expensive Azure objects, acquired once and shared by every harness this process builds.

    Spec 019 made harnesses per-turn, which would have put a fresh ``DefaultAzureCredential`` — and
    therefore a token acquisition costing seconds — in front of every message. That is exactly the
    dead time spec 002 measured and removed, so the client outlives the adapter rather than the
    other way round. `create_app` builds one of these; a build that is given none makes its own,
    which is what keeps every existing caller and test unchanged.
    """

    def __init__(self) -> None:
        self._openai: Any = None
        self._credential: Any = None
        self._project: Any = None

    def openai(self, settings: Settings) -> Any:
        if self._openai is None:
            self._openai = _openai_client(settings, self.credential())
        return self._openai

    def project(self, settings: Settings) -> Any:
        """The Agents data-plane client, once per process.

        Spec 031 needs the SDK rather than a hand-built URL: the version and endpoint routes are
        not in `docs/REFERENCES.md`, and §10 forbids guessing one. The listing keeps its verified
        HTTP path — this is additive, not a replacement.
        """
        if self._project is None:
            from azure.ai.projects import AIProjectClient

            self._project = AIProjectClient(
                endpoint=settings.project_endpoint, credential=self.credential()
            )
        return self._project

    def credential(self) -> Any:
        """One credential for the whole process. Azure's own token cache lives inside it, so a
        second instance would re-do work the first one has already paid for."""
        if self._credential is None:
            from azure.identity import DefaultAzureCredential

            self._credential = DefaultAzureCredential()
        return self._credential


def _executor(name: str, arguments: str) -> tuple[str, int, str | None]:
    """Adapt the BFF's executor to the shape the adapter expects. No tool knowledge here (§8)."""
    result = execute(name, arguments)
    return result.output, result.duration_ms, result.error


def build_harness(
    settings: Settings,
    stream_factory: Callable[..., Any] | None = None,
    agent: AgentSummary | None = None,
    clients: AzureClients | None = None,
):
    """Return an adapter for ``agent``, or for the configured default when ``agent`` is ``None``.

    The default path is AC12 in one line: an app with no selection behaves exactly as it did before
    spec 019, driven by ``AGENT_HARNESS`` and ``AGENT_NAME``.
    """
    clients = clients or AzureClients()
    name, agent_name = _resolve(settings, agent)
    # Only the configured agent may be pinned to a version. An endpoint serves one version and
    # traffic splitting is unsupported, so a selected agent's turn goes to whatever it serves —
    # which the row already displays. Sending a version we have never sent before would be a
    # parameter §10 says we may not assume the service accepts.
    version = settings.agent_version if agent is None else None

    if name == "prompt-agent":
        from harness.prompt_agent.adapter import PromptAgentAdapter

        factory = stream_factory or _foundry_stream_factory(settings, agent_name, clients)
        adapter: HarnessAdapter = PromptAgentAdapter(
            stream_factory=factory,
            executor=_executor,
            agent_name=agent_name,
            project_name=settings.project_name,
            agent_version=version,
        )
        return adapter

    if name == "langgraph":
        from harness.langgraph.adapter import LangGraphAdapter

        return LangGraphAdapter(
            stream_factory=stream_factory or _hosted_stream_factory(settings, agent_name, clients),
            agent_name=agent_name,
            project_name=settings.project_name,
            agent_version=version,
        )

    raise ValueError(
        f"unknown harness {name!r}; AGENT_HARNESS must be 'prompt-agent' or 'langgraph'"
    )


def _resolve(settings: Settings, agent: AgentSummary | None) -> tuple[str, str]:
    """Which harness, and which agent it drives.

    A selection decides the harness from the agent's **kind**, so `AGENT_HARNESS` is the default
    rather than the law (spec 019, decision 5): an app configured for the prompt agent still drives
    a chosen hosted agent with the hosted harness.
    """
    if agent is not None:
        name = HARNESS_FOR_KIND.get(agent.kind)
        if name is None:
            raise ValueError(
                f"no harness in this build drives a {agent.kind!r} agent ({agent.name!r})"
            )
        return name, agent.name

    if settings.harness == "langgraph":
        # The agent's NAME comes from its own definition, not from AGENT_NAME. A hosted agent
        # cannot share a name with the prompt agent in one project, and an env var that can
        # disagree with the definition would be a second source of truth (§4).
        from harness._shared.agent_spec import load_agent_spec

        return "langgraph", load_agent_spec(_HOSTED_AGENT_YAML).name
    return settings.harness, settings.agent_name


def _openai_client(settings: Settings, credential: Any):
    """The OpenAI-shaped client for the Foundry project. Built lazily, so importing this module
    needs no Azure SDK and no credential — which is what lets the whole loop be tested with an
    injected stream."""
    from azure.ai.projects import AIProjectClient

    from app.settings import require_live_settings

    require_live_settings(settings)
    project = AIProjectClient(endpoint=settings.project_endpoint, credential=credential)
    return project.get_openai_client()


def _foundry_stream_factory(
    settings: Settings, agent_name: str, clients: AzureClients
) -> Callable[..., Any]:
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

    def factory(inputs, conversation_state: MutableMapping[str, Any]):
        # Built once, and once per PROCESS rather than once per adapter (spec 019): every build is
        # a fresh `DefaultAzureCredential`, and acquiring a token costs seconds — paid before the
        # first byte of the turn, and again on the leg that answers a tool call. The browser sees
        # that as a turn that sits there doing nothing.
        openai = clients.openai(settings)

        conversation_id = conversation_state.get("conversation_id")
        if not conversation_id:
            conversation_id = openai.conversations.create().id
            conversation_state["conversation_id"] = conversation_id

        request: dict[str, Any] = {
            "input": inputs,
            "conversation": conversation_id,
            "stream": True,
            "extra_body": {"agent_reference": {"name": agent_name, "type": "agent_reference"}},
        }

        stream = openai.responses.create(**request)
        try:
            for event in stream:
                yield event.model_dump() if hasattr(event, "model_dump") else dict(event)
        finally:
            if close := getattr(stream, "close", None):
                close()

    return factory


def _hosted_stream_factory(
    settings: Settings, agent_name: str, clients: AzureClients
) -> Callable[..., Any]:
    """The real stream for a hosted agent: its OWN endpoint, not the project's Responses API.

    A hosted agent is reached at
    `{project_endpoint}/agents/{name}/endpoint/protocols/openai/responses`, live as soon as it is
    deployed — publishing is not required. Two details cost a turn each to discover, so they are
    written down rather than left in a commit message (§10, observed 2026-09-16):

    - **`api-version=v1` is required** and the documented endpoint shape omits it. Without it the
      service answers `400 BadRequest — Missing required query parameter: api-version`. `azd deploy`
      prints the URL with it, which is the accurate source.
    - **There is no tool round trip**: the container owns its loop; one request is the whole turn.
      This does NOT establish multi-turn continuity. The BFF supplies `conversation_id`, while
      this factory reads `response_id`; recorded completions supply no conversation pointer.
      See `docs/how-it-works/hosted-continuity.md` (issue #35) for the blocked regression and
      documented alternatives. Response, conversation and sandbox ids are not interchangeable.
    """
    import httpx

    def factory(messages, conversation_state: MutableMapping[str, Any]):
        from app.settings import require_live_settings

        require_live_settings(settings)
        endpoint = settings.project_endpoint.rstrip("/")
        url = (
            f"{endpoint}/agents/{agent_name}/endpoint/protocols/openai/responses"
            f"?api-version={HOSTED_API_VERSION}"
        )
        token = clients.credential().get_token(_AZURE_AI_SCOPE).token

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
