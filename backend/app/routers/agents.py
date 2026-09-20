"""`GET /agents` — which agents the project has, `GET /agents/{name}` — what one of them is,
and `POST /agents/{name}/versions/{version}/promote` — go back to one (spec 031).

**Why these handlers are `def` and not `async def`.** Everything below waits on a synchronous
client — the Azure SDKs and `httpx.get` are what this app has — and a blocking call inside an
`async def` handler owns the whole worker while it waits: every SSE stream in flight and every live
voice session stops with it. Declared `def`, FastAPI runs them in its threadpool and the loop stays
free. Asserted in `tests/test_concurrency.py`, which `TestClient` alone cannot catch because it
serves one request at a time.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.agents import AgentsUnavailable

#: Which HTTP status each refusal deserves. `not_owned` and `write_disabled` are 403 because they
#: are both "this build will not do that", which is what a reader debugging a deployment needs.
_STATUS = {
    "write_disabled": 403,
    "not_owned": 403,
    "forbidden": 403,
    "unknown_agent": 404,
    "unknown_version": 404,
    "proposals_disabled": 403,
    "invalid_definition": 502,
}

router = APIRouter()


@router.get("/agents")
def agents(request: Request) -> dict:
    """List the project's agents.

    **A failure is never an empty list** (spec 019, AC3). "The project has no agents" and "we could
    not read the project" are different facts, and a screen that renders them the same way teaches
    the reader something false. So the response always carries both keys, and `error` is a **code**
    the frontend translates — the BFF ships no user-facing prose (§7).

    Read-only by construction: this route lists, and nothing else. Creating, editing and deploying
    agents stay with `ai/scripts/apply_agent.py` and `azd` (spec 019 non-goals).
    """
    lister = request.app.state.list_agents
    try:
        rows = lister()
    except AgentsUnavailable as exc:
        return {"agents": [], "error": exc.code}

    return {"agents": [row.as_dict() for row in rows], "error": None}


@router.get("/agents/{name}")
def agent(name: str, request: Request, response: Response) -> dict:
    """One agent, inspected (spec 030).

    Mostly answered from the **same listing** `GET /agents` reads — the service returns every
    agent's whole definition, so the *definition* costs no second call. Spec 031 added what the
    listing genuinely does not carry: the agent's versions, and the `agent_endpoint` that says
    which of them is served. Those are read here and **only** here, so the agents screen keeps the
    single-request property spec 030 verified (spec 031, AC12).

    Read-only, like its sibling: this route describes an agent and never changes one. Editing has a
    spec of its own (041) and a reason to stay out of the browser (§4).

    A failure carries a **code**, never prose (§7), and never an empty detail: "this project has no
    agent by that name" and "we could not read the project" are different facts and the screen
    renders them differently (spec 019 AC3, and §5).
    """
    reader = request.app.state.agent_detail
    try:
        return {"agent": reader(name).as_dict(), "error": None}
    except AgentsUnavailable as exc:
        response.status_code = 404 if exc.code == "unknown_agent" else 502
        return {"agent": None, "error": exc.code}


@router.post("/agents/{name}/versions/{version}/promote")
def promote(name: str, version: str, request: Request, response: Response) -> dict:
    """Make an earlier version the one this agent serves (spec 031). **The app's only write.**

    **It takes no body.** The agent and the version are path parameters and there is nowhere to put
    anything else, so this route cannot become a way to author an agent — creating a version stays
    with `apply_agent.py`, from a definition in the repository (§4, AC14). A body posted anyway is
    not read.

    Two gates, and they are different things. `allow_version_promote` is **off by default** and
    decides whether this deployment offers the surface at all; `OWNED_AGENT_NAMES` decides whether
    *this* agent is one this repository authored. Neither is a permission — RBAC on the deployment
    identity is what actually enforces the write, and a build that passes both gates without the
    role gets `forbidden`, which the screen renders as the configuration fact it is (AC8).

    The answer is a **fresh read**, never an echo of the request: the served version on screen comes
    from what the service says now (AC7). A failure carries a code and no agent, because nothing on
    screen may claim a version that is not being served.
    """
    if not request.app.state.settings.allow_version_promote:
        response.status_code = 403
        return {"agent": None, "error": "write_disabled"}

    try:
        detail = request.app.state.promote_version(name, version)
    except AgentsUnavailable as exc:
        response.status_code = _STATUS.get(exc.code, 502)
        return {"agent": None, "error": exc.code}

    return {"agent": detail.as_dict(), "error": None}


@router.get("/agents/{name}/definition")
def definition(name: str, request: Request, response: Response) -> dict:
    """The definition **this build was made from**, and whether the service agrees (spec 041).

    Not "the repository" and not `main`: in a container the files are whatever was baked into the
    image, which may be neither, and the screen says exactly that.

    The comparison with what is served is the most useful thing here. A deployment serving
    something other than what this build describes is drift, and a reader about to edit needs to
    know before they start rather than after they wonder why nothing changed.
    """
    if not request.app.state.settings.allow_proposals:
        response.status_code = 403
        return {"definition": None, "error": "proposals_disabled"}

    from app.agent_definition import definition_for

    try:
        served = request.app.state.agent_detail(name).instructions
    except AgentsUnavailable as exc:
        # The file is still readable without the service; drift simply cannot be reported.
        if exc.code == "unknown_agent":
            response.status_code = 404
            return {"definition": None, "error": exc.code}
        served = None

    try:
        return {"definition": definition_for(name, served).as_dict(), "error": None}
    except AgentsUnavailable as exc:
        response.status_code = _STATUS.get(exc.code, 502)
        return {"definition": None, "error": exc.code}


class Proposal(BaseModel):
    """The one field this screen edits.

    Not tools, not the model: tools are where a bad edit breaks a harness silently, and the model's
    *shape* decides whether inference routes through the gateway.
    """

    instructions: str


@router.post("/agents/{name}/definition/proposal")
def proposal(name: str, body: Proposal, request: Request, response: Response) -> dict:
    """Validate a proposed change and answer a diff. **Writes nothing** (spec 041).

    Not the file, not Foundry. `agent_core.yaml` is the single source of truth for what the agent
    is, and it exists because two copies of those instructions drifting a sentence at a time would
    make this repository's central claim unfalsifiable. A save here creates the second copy.

    The name says proposal and so does the behaviour: the output is a diff somebody reviews,
    merges and applies with `apply_agent.py`.
    """
    if not request.app.state.settings.allow_proposals:
        response.status_code = 403
        return {"ok": False, "error": "proposals_disabled", "yaml": "", "diff": ""}

    from app.agent_definition import propose

    try:
        return propose(name, body.instructions)
    except AgentsUnavailable as exc:
        response.status_code = _STATUS.get(exc.code, 502)
        return {"ok": False, "error": exc.code, "yaml": "", "diff": ""}
