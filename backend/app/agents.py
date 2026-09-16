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
    "AgentSummary",
    "AgentsUnavailable",
    "build_agent_lister",
    "list_agents",
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
    if not endpoint:
        raise AgentsUnavailable("unconfigured", "FOUNDRY_PROJECT_ENDPOINT is not set")

    url = f"{endpoint.rstrip('/')}/agents?api-version={API_VERSION}"
    try:
        return summarise(fetch(url))
    except PermissionError as exc:
        raise AgentsUnavailable("forbidden", str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - every other failure renders the same way
        raise AgentsUnavailable("unavailable", f"{type(exc).__name__}: {exc}") from exc


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


def build_agent_lister(
    settings, credential: Callable[[], Any] | None = None
) -> Callable[[], list[AgentSummary]]:
    """The production lister. Built lazily, so importing this module needs no Azure SDK.

    ``credential`` is the process's shared credential (`AzureClients.credential`). A listing is now
    on the path of every turn that names an agent, so constructing a fresh `DefaultAzureCredential`
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

    return lambda: list_agents(settings.project_endpoint, fetch)


def _credential(shared: Callable[[], Any] | None) -> Any:
    if shared is not None:
        return shared()
    from azure.identity import DefaultAzureCredential

    return DefaultAzureCredential()
