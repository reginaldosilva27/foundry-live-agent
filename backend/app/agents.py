"""Listing the Foundry project's agents (spec 019).

Everything Azure about agents lives here, so the router stays a router and the browser stays
credential-free — the shape `app/traces.py` already has.

**Verified against the live project on 2026-09-16 before any of this was designed** (§10, and the
lesson spec 018 paid for). One request answers the whole screen:

    GET {project_endpoint}/agents?api-version=v1     audience: https://ai.azure.com

    data[].name                              the agent
    data[].state                             enabled | disabled
    data[].versions.latest.version           the NEWEST version (see below)
    data[].versions.latest.status            active | creating | failed | …
    data[].versions.latest.definition.kind   prompt | hosted | workflow

`kind` being *in the listing* is what spec 019's AC2 was unsure about: no second call per agent is
needed. `versions` carries only `latest`, which matches the documented rule that an agent endpoint
serves one version and that traffic splitting is unsupported.

**The newest version is not necessarily the one that answers** (spec 031). An agent endpoint can
pin a version through `agent_endpoint.version_selector`, and once anything does, "latest" and
"serving" are different facts. :func:`served_version` is the one place that distinction is decided.
No agent in the recorded listing carries an `agent_endpoint` key, so the listing always takes the
fallback — and it is the wrong place to learn about a pin anyway: the field is absent here, and
`GET /agents/{name}` is what resolves it (spec 031, AC12).

That per-agent read was verified against the live service on 2026-09-20, and the answer corrected
an assumption: **every** agent carries an `agent_endpoint`, and an untouched one names
:data:`LATEST_SENTINEL` rather than a version. So the presence of a selector is not a pin — only a
rule naming a version is — and reading the sentinel as one made a healthy agent report
`version_not_active`.

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
from dataclasses import dataclass, field, replace
from typing import Any

__all__ = [
    "AgentDetail",
    "AgentVersion",
    "AgentSummary",
    "AgentsUnavailable",
    "ContainerInfo",
    "ToolInfo",
    "build_agent_detail_reader",
    "build_agent_lister",
    "build_version_promoter",
    "detail_of",
    "find_detail",
    "list_agents",
    "promote_version",
    "read_listing",
    "versions_of",
    "select_agent",
    "served_version",
    "summarise",
]

# Observed 2026-09-16. The audience is Foundry's own, NOT cognitiveservices.azure.com — verified by
# calling the same route with both: the latter answers 401 "audience is incorrect".
API_VERSION = "v1"
AZURE_AI_SCOPE = "https://ai.azure.com/.default"

#: Documented version statuses; only `active` serves traffic.
ACTIVE = "active"

#: What a `version_selection_rule` names when nothing has been pinned: "whatever is newest".
#: Recorded from the live service on 2026-09-20 — every agent's default endpoint carries a rule,
#: and this sentinel is what it holds. It is not a version, and must never be read as one.
LATEST_SENTINEL = "@latest"


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
    #: What this agent is worth being asked (spec 037). Empty for one we did not write — the
    #: service has no field that could carry these, so the BFF joins its rows against our own
    #: definitions by name. Last, with a default, so every existing construction is unchanged.
    suggestions: list[dict[str, str]] = field(default_factory=list)
    #: ``""`` when selectable; otherwise ``no_harness`` · ``disabled`` · ``version_not_active``.
    reason: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "kind": self.kind,
            "version": self.version,
            "version_status": self.version_status,
            "model": self.model,
            "harness": self.harness,
            "suggestions": [dict(s) for s in self.suggestions],
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
class AgentVersion:
    """One version of an agent, as the rollback story needs it read (spec 031).

    ``None`` means **the service did not report it**, the same rule the detail already uses: a
    version with no ``model`` and a version whose model is the empty string are different facts. A
    hosted version simply has no model, which is that rule and not a special case (spec 030).
    """

    version: str
    #: ``creating`` · ``active`` · ``failed`` · ``deleting`` · ``deleted``, or ``None``.
    status: str | None
    #: The service's own Unix seconds, passed through — formatting a date here would be prose (§7).
    created_at: int | None
    model: str | None
    #: Whether this is the version the endpoint actually serves.
    served: bool
    #: Whether this version can be rolled back to. Never true for the served one (spec 031, AC3).
    promotable: bool = False
    #: ``""`` when promotable; otherwise ``served`` · ``not_owned``. A CODE, never prose (§7).
    promote_reason: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "status": self.status,
            "created_at": self.created_at,
            "model": self.model,
            "served": self.served,
            "promotable": self.promotable,
            "promote_reason": self.promote_reason,
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
    #: The version the endpoint serves. Equal to ``latest_version`` until someone rolls back.
    served_version: str = ""
    #: The newest version that exists, which is what the listing's rows report (spec 031, AC12).
    latest_version: str = ""
    #: Whether a `version_selector` chose the served version, rather than it simply being newest.
    pinned: bool = False
    #: ``None`` when the service did not report them — not the same as an agent with no versions.
    versions: list[AgentVersion] | None = None

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
    def version_status(self) -> str:
        return self.summary.version_status

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
            "served_version": self.served_version,
            "latest_version": self.latest_version,
            "pinned": self.pinned,
            "versions": None if self.versions is None else [v.as_dict() for v in self.versions],
        }


def detail_of(
    agent: dict[str, Any], raw_versions: list[dict[str, Any]] | None = None
) -> AgentDetail:
    """Project one agent into its detail. Pure, so the recording drives it.

    ``raw_versions`` is what `agents.list_versions()` returned, or ``None`` when it was not read.
    It is what makes this the **authoritative** place for the served version (spec 031): the
    listing does not carry `agent_endpoint`, and the served version's *status* lives in the version
    list rather than in `versions.latest`. So a pinned agent's row here reports the pinned version
    and that version's health — not the newest one's, which is what the rail shows and says so.
    """
    definition = ((agent.get("versions") or {}).get("latest") or {}).get("definition") or {}
    summary = _summarise_one(agent)
    versions = versions_of(agent, raw_versions)

    served = served_version(agent)
    latest = str(((agent.get("versions") or {}).get("latest") or {}).get("version") or "")
    pinned = _pinned_version(agent) != ""

    if pinned:
        # The pinned version's own status decides selectability. Unknown when the version list was
        # not read or does not contain it — a pin at something we cannot see is not servable, and
        # reporting the newest version's health in its place would be the §5 lie this spec exists
        # to remove.
        status = next((v.status for v in versions or [] if v.version == served), None) or "unknown"
        summary = replace(
            summary,
            version=served,
            version_status=status,
            reason=(reason := _reason(summary.kind, _enabled(agent), status)),
            selectable=not reason,
        )

    return AgentDetail(
        summary=summary,
        instructions=_reported_str(definition.get("instructions")),
        tools=_tools(definition, summary.harness),
        reasoning=definition.get("reasoning") or None,
        container=_container(definition),
        served_version=served,
        latest_version=latest,
        pinned=pinned,
        versions=versions,
    )


def _enabled(agent: dict[str, Any]) -> bool:
    return agent.get("state", "enabled") != "disabled"


def _pinned_version(agent: dict[str, Any]) -> str:
    """The version the endpoint was *pinned* to, or ``""`` when it simply tracks the newest.

    The one place the selector is read (§4). Only the first rule is considered: the service
    documents one version at 100% and forbids traffic splitting, so a second rule would be a shape
    this app has no opinion about (spec 031, out of scope).

    :data:`LATEST_SENTINEL` is **not** a pin. Every agent's endpoint carries a rule — an untouched
    one names `@latest` — so the presence of a selector says nothing, and only a rule naming a
    version does.

    Defensive about *shape*, never about *facts*: a selector with no rules falls back rather than
    raising, because a read of ten agents must not die on one unfamiliar endpoint.
    """
    rules = ((agent.get("agent_endpoint") or {}).get("version_selector") or {}).get(
        "version_selection_rules"
    ) or []
    for rule in rules:
        if (pinned := str((rule or {}).get("agent_version") or "")) != LATEST_SENTINEL:
            return pinned
    return ""


def versions_of(
    agent: dict[str, Any], raw: list[dict[str, Any]] | None
) -> list[AgentVersion] | None:
    """Project the service's version list, newest first, marking the one that is served.

    ``None`` in, ``None`` out — "the service did not report this agent's versions" is a different
    fact from "it has none", and the screen renders them differently (§5).

    Ordered by the service's own ``created_at`` rather than by the version identifier, because a
    version identifier is not documented to be numeric — drafts are ``draft-{timestamp}`` — and
    sorting text as if it were a number is how ``v10`` ends up before ``v9``.
    """
    if raw is None:
        return None

    from app.harness_factory import OWNED_AGENT_NAMES

    served = served_version(agent)
    owned = (agent.get("name") or agent.get("id") or "") in OWNED_AGENT_NAMES
    rows = []
    for entry in raw:
        version = str(entry.get("version") or "")
        # Ordered: not-ours is the fact worth reporting even about the served version, because it
        # is true of the whole agent and will not change by picking a different row.
        reason = "not_owned" if not owned else ("served" if version == served else "")
        rows.append(
            AgentVersion(
                version=version,
                status=_reported_str(entry.get("status")),
                created_at=entry.get("created_at"),
                model=_reported_str(_model(entry.get("definition") or {}) or None),
                served=version == served,
                promotable=not reason,
                promote_reason=reason,
            )
        )
    return sorted(rows, key=lambda r: r.created_at or 0, reverse=True)


def find_detail(listing: dict[str, Any], name: str) -> AgentDetail:
    """The named agent's detail, or :class:`AgentsUnavailable` with the listing's own code."""
    return detail_of(_find_agent(listing, name))


def _find_agent(listing: dict[str, Any], name: str) -> dict[str, Any]:
    for agent in listing.get("data") or []:
        if (agent.get("name") or agent.get("id")) == name:
            return agent
    raise AgentsUnavailable("unknown_agent", name)


def served_version(agent: dict[str, Any]) -> str:
    """Which version this agent's endpoint actually serves.

    The version the endpoint was pinned to, and the newest version when it was not.
    **One concept, two branches** — the alternative was teaching every reader two words ("latest"
    and "serving") for something that is the same thing until someone rolls back (spec 031).

    The selector shape is `azure-ai-projects` 2.6.0's `VersionSelector` →
    `FixedRatioVersionSelectionRule`, the same one :func:`promote_version` builds; what counts as
    a pin is :func:`_pinned_version`.
    """
    return _pinned_version(agent) or str(
        ((agent.get("versions") or {}).get("latest") or {}).get("version") or ""
    )


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

    from app.harness_factory import EXAMPLES_FOR_AGENT, HARNESS_FOR_KIND

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
        suggestions=EXAMPLES_FOR_AGENT.get(agent.get("name") or agent.get("id") or "", []),
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


def promote_version(agents: Any, name: str, version: str, *, owned: bool) -> None:
    """Make ``version`` the one this agent's endpoint serves. **The first write in this app.**

    There is no promote verb. Going back to a version is a merge-patch on the endpoint's routing —
    `update_details` with a `version_selector` naming one version at 100%. Two properties follow,
    and both are tested:

    - **Nothing authoring can travel.** The payload has a version identifier and a percentage, and
      nowhere to put a definition. Creating an agent stays with `apply_agent.py` (spec 031
      non-goals), and this route cannot become a second way to do it even by accident.
    - **One rule, 100%.** The type models a *list* of weighted rules, while the service documents
      one version per endpoint and no traffic splitting. This app sends the documented shape and
      records the disagreement rather than exploring it.

    ``owned`` is decided by the caller from `OWNED_AGENT_NAMES`, and refused **here** rather than
    only on the screen: a restriction the server does not keep is not a restriction (AC13).

    **Verified against the live service on 2026-09-20** (§10): this exact call pinned
    `foundry-live-agent` to version 7 and a second one restored it to `@latest`, which is accepted
    as a write and not only returned as a read — so a rollback demonstration is reversible. The
    call shape originally came from the `azure-ai-projects` 2.6.0 typespec and did not change.

    The route is still off by default, and never was only because of that gap: the flag is a
    *permission*. Anyone who can reach this BFF could change what the whole project serves, and
    this app has no notion of a user to record. See `SECURITY.md`. Which role is the *minimum* is
    still unknown — the identity that verified it was Owner.
    """
    if not owned:
        raise AgentsUnavailable("not_owned", name)

    from azure.ai.projects.models import (
        AgentEndpointConfig,
        FixedRatioVersionSelectionRule,
        VersionSelector,
    )

    endpoint = AgentEndpointConfig(
        version_selector=VersionSelector(
            version_selection_rules=[
                FixedRatioVersionSelectionRule(agent_version=str(version), traffic_percentage=100)
            ]
        )
    )
    try:
        agents.update_details(name, agent_endpoint=endpoint)
    except AgentsUnavailable:
        raise
    except PermissionError as exc:
        # The expected failure for a build without the role, and a configuration fact rather than
        # a bug — which is what the screen says (spec 031, AC8).
        raise AgentsUnavailable("forbidden", str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - every other failure renders the same way
        raise AgentsUnavailable(_promote_code(exc), f"{type(exc).__name__}: {exc}") from exc


def _promote_code(exc: Exception) -> str:
    """Map an upstream failure onto one of the screen's codes. Never prose (§7)."""
    status = getattr(exc, "status_code", None)
    if status in (401, 403):
        return "forbidden"
    if status == 404:
        return "unknown_version"
    return "unavailable"


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
    settings, credential: Callable[[], Any] | None = None, clients: Any = None
) -> Callable[[str], AgentDetail]:
    """One agent, inspected (spec 030), with its versions (spec 031).

    The **definition** still comes from the listing — one request, recorded, verified 2026-09-16,
    and the path every existing test drives. Spec 031 adds only what that listing genuinely does
    not carry: the agent's version list, and the `agent_endpoint` that says which version is
    served. Those go through the SDK rather than a hand-built URL, because their REST routes are
    not in `docs/REFERENCES.md` and §10 forbids inventing one.

    **Their failure is not this route's failure.** An agent that reads but whose versions do not
    comes back with ``versions=None`` — "the service did not report them" — which is a state the
    screen already renders (AC2). The inspector kept working through spec 030 without any of this,
    and a version list that cannot be read must not take it away.
    """
    fetch = _http_fetch(credential)

    def read(name: str) -> AgentDetail:
        agent = _find_agent(read_listing(settings.project_endpoint, fetch), name)
        endpoint, raw_versions = _endpoint_and_versions(clients, settings, name)
        if endpoint is not None:
            agent = {**agent, "agent_endpoint": endpoint}
        return detail_of(agent, raw_versions)

    return read


def _endpoint_and_versions(
    clients: Any, settings, name: str
) -> tuple[dict[str, Any] | None, list[dict[str, Any]] | None]:
    """The agent's routing and its versions, or ``(None, None)`` when they cannot be read.

    Deliberately swallowing: see :func:`build_agent_detail_reader`. Both halves are **unverified
    against the live service** (§10) — `az` was a broken build when this was written — so a
    deployment where they behave differently degrades to the inspector spec 030 shipped rather
    than to an error page.
    """
    if clients is None or not settings.project_endpoint:
        return None, None
    try:
        agents = clients.project(settings).agents
        endpoint = _as_dict(agents.get(name)).get("agent_endpoint")
        versions = [_as_dict(v) for v in agents.list_versions(name)]
    except Exception:  # noqa: BLE001 - an unreadable version list is "not reported", not a failure
        return None, None
    return endpoint, versions


def _as_dict(model: Any) -> dict[str, Any]:
    """An SDK model as plain data. They are documented as MutableMapping-compatible."""
    if hasattr(model, "as_dict"):
        return model.as_dict()
    return dict(model)


def build_version_promoter(settings, clients: Any = None) -> Callable[[str, str], AgentDetail]:
    """Promote, then **read back** (spec 031).

    The re-read is the point of AC7: what the screen shows afterwards is what the service says now,
    not what this process asked for. A promotion that silently did not take effect must look like
    one, and an echo of the request would hide exactly that.
    """
    read = build_agent_detail_reader(settings, clients.credential if clients else None, clients)

    def promote(name: str, version: str) -> AgentDetail:
        from app.harness_factory import OWNED_AGENT_NAMES

        agents = clients.project(settings).agents if clients else None
        promote_version(agents, name, version, owned=name in OWNED_AGENT_NAMES)
        return read(name)

    return promote


def _credential(shared: Callable[[], Any] | None) -> Any:
    if shared is not None:
        return shared()
    from azure.identity import DefaultAzureCredential

    return DefaultAzureCredential()
