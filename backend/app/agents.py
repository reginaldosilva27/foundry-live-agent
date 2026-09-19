"""Listing the Foundry project's agents (spec 019).

Everything Azure about agents lives here, so the router stays a router and the browser stays
credential-free — the shape `app/traces.py` already has.

**Verified against the live project on 2026-09-16 before any of this was designed** (§10, and the
lesson spec 018 paid for). One request answers the whole screen:

    GET {project_endpoint}/agents?api-version=v1     audience: https://ai.azure.com

    data[].name                              the agent
    data[].state                             enabled | disabled
    data[].versions.latest.version           the served version
    data[].versions.latest.status            active | creating | failed | …
    data[].versions.latest.definition.kind   prompt | hosted | workflow

`kind` being *in the listing* is what spec 019's AC2 was unsure about: no second call per agent is
needed. `versions` carries only `latest`, which matches the documented rule that an agent endpoint
serves one version and that traffic splitting is unsupported.

**Two shapes that bite.** A *prompt* agent's definition carries `model`; a *hosted* agent's does
not — it carries `cpu`, `memory`, `container_configuration`, and its deployment name inside
`environment_variables`. And an agent whose definition names no `kind` is reported as `unknown`
rather than guessed from its name: a mapper that read the name would offer a row to a harness that
cannot drive it.

**No user-facing prose leaves this module.** `reason` is a code the frontend translates, because
§7 requires every rendered string to exist in `en` and `pt`, and a sentence composed here would be
English by construction.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

__all__ = [
    "AgentDetail",
    "AgentSummary",
    "AgentsUnavailable",
    "ContainerInfo",
    "ToolInfo",
    "build_agent_detail_reader",
    "build_agent_lister",
    "detail_of",
    "find_detail",
    "list_agents",
    "read_listing",
    "select_agent",
    "summarise",
]

# Observed 2026-09-16. The audience is Foundry's own, NOT cognitiveservices.azure.com — verified by
# calling the same route with both: the latter answers 401 "audience is incorrect".
API_VERSION = "v1"
AZURE_AI_SCOPE = "https://ai.azure.com/.default"

#: Documented version statuses; only `active` serves traffic.
ACTIVE = "active"


class AgentsUnavailable(RuntimeError):
    """The project's agents could not be listed.

    Carries a ``code``, not a message: AC3 wants a failure the UI can *render*, and rendering means
    translating (§7). An empty list is never used to mean this — a project with no agents and a
    project we cannot read are different facts, and conflating them is the dishonesty §5 names.
    """

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(detail or code)
        self.code = code
        self.detail = detail


@dataclass(frozen=True)
class AgentSummary:
    """One row of the agents screen. The single source of truth for `GET /agents`' shape (§4)."""

    name: str
    #: From the service. ``unknown`` when the definition does not say — never inferred.
    kind: str
    version: str
    version_status: str
    #: ``""`` when the service reports none. Not invented (§5).
    model: str
    #: Which harness would drive it, or ``""`` when none can. The header renders a harness badge,
    #: and re-deriving this in TypeScript would give `HARNESS_FOR_KIND` a second home (§4).
    harness: str
    selectable: bool
    #: ``""`` when selectable; otherwise ``no_harness`` · ``disabled`` · ``version_not_active``.
    reason: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "kind": self.kind,
            "version": self.version,
            "version_status": self.version_status,
            "model": self.model,
            "harness": self.harness,
            "selectable": self.selectable,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class ToolInfo:
    """One tool on an agent's definition (spec 030).

    ``kind`` is decided **here** and nowhere else. The service types every tool — ``"function"`` or
    ``"mcp"`` in the recorded listing — and the projection narrows that to the two this app knows
    how to render, treating anything else as a function tool rather than dropping it. A rule like
    that re-derived in TypeScript is the §4 violation spec 019 warned about when `harness` was the
    field in question.

    ``executor`` reuses the contract's own vocabulary (``app`` | ``foundry``) rather than inventing
    a third word for the distinction this repository exists to teach.

    ``parameters`` is a JSON **string**: the browser renders and copies it verbatim and never
    inspects it, so re-serialising it there would be a second opinion about its formatting.
    """

    kind: str
    name: str
    executor: str
    description: str = ""
    #: Function tools only; ``None`` when the service reported no schema.
    parameters: str | None = None
    #: MCP tools only.
    server_label: str = ""
    server_url: str = ""
    require_approval: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "name": self.name,
            "executor": self.executor,
            "description": self.description,
            "parameters": self.parameters,
            "server_label": self.server_label,
            "server_url": self.server_url,
            "require_approval": self.require_approval,
        }


@dataclass(frozen=True)
class ContainerInfo:
    """What a hosted agent *is* — it has no instructions, tools or model (observed 2026-09-16).

    **Its environment is deliberately absent.** The recorded listing carries `KEY_VAULT_URI` among
    a container's environment variables, and a browser that never receives a field cannot leak it
    later. The one variable the screen needs, the model deployment name, already travels as
    ``AgentSummary.model``.
    """

    image: str
    cpu: str
    memory: str
    #: ``"<protocol> <version>"`` per entry — flattened so the browser renders and never parses.
    protocols: list[str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "image": self.image,
            "cpu": self.cpu,
            "memory": self.memory,
            "protocols": list(self.protocols),
        }


@dataclass(frozen=True)
class AgentDetail:
    """Everything `GET /agents/{name}` answers. The single source of truth for its shape (§4).

    A **second projection** beside :class:`AgentSummary` rather than a widening of it: the listing
    screen wants ten cheap rows and this wants one rich one, carrying two thousand characters of
    instructions that no row needs.

    ``None`` means **the service did not report it** and is not the same as empty. A definition with
    no ``tools`` key and a definition with an empty tool list are different facts, and conflating
    them is the dishonesty §5 names. Nothing here is ever filled in from this repository's own
    YAML — that would show a reader our intention as if it were the deployment's state.
    """

    summary: AgentSummary
    instructions: str | None
    tools: list[ToolInfo] | None
    reasoning: dict[str, Any] | None
    container: ContainerInfo | None

    # Read-through, so callers and tests say `detail.model` rather than `detail.summary.model`.
    @property
    def name(self) -> str:
        return self.summary.name

    @property
    def kind(self) -> str:
        return self.summary.kind

    @property
    def model(self) -> str:
        return self.summary.model

    @property
    def version(self) -> str:
        return self.summary.version

    @property
    def harness(self) -> str:
        return self.summary.harness

    @property
    def selectable(self) -> bool:
        return self.summary.selectable

    @property
    def reason(self) -> str:
        return self.summary.reason

    def as_dict(self) -> dict[str, Any]:
        return {
            **self.summary.as_dict(),
            "instructions": self.instructions,
            "tools": None if self.tools is None else [tool.as_dict() for tool in self.tools],
            "reasoning": self.reasoning,
            "container": None if self.container is None else self.container.as_dict(),
        }


def detail_of(agent: dict[str, Any]) -> AgentDetail:
    """Project one agent of the listing into its detail. Pure, so the recording drives it."""
    definition = ((agent.get("versions") or {}).get("latest") or {}).get("definition") or {}
    summary = _summarise_one(agent)

    return AgentDetail(
        summary=summary,
        instructions=_reported_str(definition.get("instructions")),
        tools=_tools(definition, summary.harness),
        reasoning=definition.get("reasoning") or None,
        container=_container(definition),
    )


def find_detail(listing: dict[str, Any], name: str) -> AgentDetail:
    """The named agent's detail, or :class:`AgentsUnavailable` with the listing's own code."""
    for agent in listing.get("data") or []:
        if (agent.get("name") or agent.get("id")) == name:
            return detail_of(agent)
    raise AgentsUnavailable("unknown_agent", name)


def _reported_str(value: Any) -> str | None:
    """``None`` when the service said nothing; the value when it said something, even empty."""
    return None if value is None else str(value)


def _tools(definition: dict[str, Any], harness: str) -> list[ToolInfo] | None:
    raw = definition.get("tools")
    if raw is None:
        return None
    return [_tool(entry, harness) for entry in raw]


def _tool(entry: dict[str, Any], harness: str) -> ToolInfo:
    import json as _json

    if entry.get("type") == "mcp":
        label = str(entry.get("server_label") or "")
        return ToolInfo(
            kind="mcp",
            name=label,
            executor="foundry",
            server_label=label,
            server_url=str(entry.get("server_url") or ""),
            require_approval=str(entry.get("require_approval") or ""),
        )

    parameters = entry.get("parameters")
    return ToolInfo(
        kind="function",
        name=str(entry.get("name") or ""),
        # Function calling is client-side execution by definition — it cannot live in a Toolbox and
        # it cannot be run by Foundry. That is why this is a constant and not a lookup.
        executor="app",
        description=str(entry.get("description") or ""),
        parameters=(
            None if parameters is None else _json.dumps(parameters, indent=2, sort_keys=True)
        ),
    )


def _container(definition: dict[str, Any]) -> ContainerInfo | None:
    """A hosted agent's shape. ``None`` for anything that is not a container."""
    if definition.get("kind") != "hosted":
        return None

    protocols = [
        f"{entry.get('protocol', '')} {entry.get('version', '')}".strip()
        for entry in definition.get("protocol_versions") or []
    ]
    return ContainerInfo(
        image=str((definition.get("container_configuration") or {}).get("image") or ""),
        cpu=str(definition.get("cpu") or ""),
        memory=str(definition.get("memory") or ""),
        protocols=protocols,
    )


def summarise(listing: dict[str, Any]) -> list[AgentSummary]:
    """Turn the service's listing into rows.

    Pure, which is what lets a recorded fixture drive it.
    """
    return [_summarise_one(agent) for agent in listing.get("data") or []]


def _summarise_one(agent: dict[str, Any]) -> AgentSummary:
    latest = (agent.get("versions") or {}).get("latest") or {}
    definition = latest.get("definition") or {}

    from app.harness_factory import HARNESS_FOR_KIND

    kind = definition.get("kind") or "unknown"
    status = latest.get("status") or "unknown"
    enabled = agent.get("state", "enabled") != "disabled"

    reason = _reason(kind, enabled, status)
    return AgentSummary(
        name=agent.get("name") or agent.get("id") or "",
        kind=kind,
        version=str(latest.get("version") or ""),
        version_status=status,
        model=_model(definition),
        harness=HARNESS_FOR_KIND.get(kind, ""),
        selectable=not reason,
        reason=reason,
    )


def _reason(kind: str, enabled: bool, status: str) -> str:
    """Why this row cannot be chosen, or ``""``.

    Ordered deliberately. A disabled agent's endpoint is offline whatever its version says, so that
    is the fact worth reporting; a row whose reason flipped between two true statements would be
    noise. `no_harness` comes first because it is a property of *this build*, and true even if the
    agent were perfectly healthy.
    """
    from app.harness_factory import HARNESS_FOR_KIND

    if kind not in HARNESS_FOR_KIND:
        return "no_harness"
    if not enabled:
        return "disabled"
    if status != ACTIVE:
        return "version_not_active"
    return ""


def _model(definition: dict[str, Any]) -> str:
    """The model deployment, wherever this kind of agent keeps it.

    A prompt agent says `model`. A hosted agent does not: it is a container, and its deployment
    name arrives as an environment variable on the agent version (observed 2026-09-16). Where
    neither exists the row simply shows no model.
    """
    if model := definition.get("model"):
        return str(model)
    env = definition.get("environment_variables") or {}
    for name in ("MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME", "FOUNDRY_MODEL_NAME"):
        if value := env.get(name):
            return str(value)
    return ""


def list_agents(endpoint: str, fetch: Callable[[str], dict[str, Any]]) -> list[AgentSummary]:
    """Fetch and summarise, or raise :class:`AgentsUnavailable`.

    ``fetch`` is injected so the whole path above is testable without Azure — the same seam the
    harness stream factory uses, and what keeps CI credential-free.
    """
    return summarise(read_listing(endpoint, fetch))


def select_agent(lister: Callable[[], list[AgentSummary]], name: str) -> AgentSummary:
    """The row the browser named, or :class:`AgentsUnavailable` saying why it cannot have it.

    Checked against the *service*, not against what the browser claims: the browser names an agent,
    it does not describe one. So an agent that was selectable when the screen rendered and has since
    been disabled is refused here rather than built and failed somewhere downstream.

    The refusal reuses the **row's own reason code**. The screen dims a row for a stated reason, and
    a refusal that invented a second vocabulary could disagree with it (§4).
    """
    for row in lister():  # AgentsUnavailable from here passes straight through: "the project could
        if row.name == name:  # not be listed" is a different problem from "that agent is wrong".
            if not row.selectable:
                raise AgentsUnavailable(row.reason or "not_selectable", name)
            return row
    raise AgentsUnavailable("unknown_agent", name)


def read_listing(endpoint: str, fetch: Callable[[str], dict[str, Any]]) -> dict[str, Any]:
    """The raw listing, or :class:`AgentsUnavailable` saying why not.

    Split out of :func:`list_agents` when spec 030 needed the same response projected a second way.
    One reader, two projections — the alternative was a second upstream call answering a question
    this one already answers.
    """
    if not endpoint:
        raise AgentsUnavailable("unconfigured", "FOUNDRY_PROJECT_ENDPOINT is not set")

    url = f"{endpoint.rstrip('/')}/agents?api-version={API_VERSION}"
    try:
        return fetch(url)
    except PermissionError as exc:
        raise AgentsUnavailable("forbidden", str(exc)) from exc
    except AgentsUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 - every other failure renders the same way
        raise AgentsUnavailable("unavailable", f"{type(exc).__name__}: {exc}") from exc


def _http_fetch(credential: Callable[[], Any] | None) -> Callable[[str], dict[str, Any]]:
    """The production fetch. Built lazily, so importing this module needs no Azure SDK.

    ``credential`` is the process's shared credential (`AzureClients.credential`). A listing is on
    the path of every turn that names an agent, so constructing a fresh `DefaultAzureCredential`
    per call would put a token acquisition in front of each message.
    """

    def fetch(url: str) -> dict[str, Any]:
        import httpx

        token = _credential(credential).get_token(AZURE_AI_SCOPE).token
        response = httpx.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30.0)
        if response.status_code in (401, 403):
            raise PermissionError(f"{response.status_code}: {response.text[:200]}")
        response.raise_for_status()
        return response.json()

    return fetch


def build_agent_lister(
    settings, credential: Callable[[], Any] | None = None
) -> Callable[[], list[AgentSummary]]:
    fetch = _http_fetch(credential)
    return lambda: list_agents(settings.project_endpoint, fetch)


def build_agent_detail_reader(
    settings, credential: Callable[[], Any] | None = None
) -> Callable[[str], AgentDetail]:
    """One agent, inspected (spec 030). Reads the **same listing** the rows come from."""
    fetch = _http_fetch(credential)
    return lambda name: find_detail(read_listing(settings.project_endpoint, fetch), name)


def _credential(shared: Callable[[], Any] | None) -> Any:
    if shared is not None:
        return shared()
    from azure.identity import DefaultAzureCredential

    return DefaultAzureCredential()
