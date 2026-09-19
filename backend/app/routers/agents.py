"""`GET /agents` — which agents the project has, and `GET /agents/{name}` — what one of them is."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.agents import AgentsUnavailable

router = APIRouter()


@router.get("/agents")
async def agents(request: Request) -> dict:
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
async def agent(name: str, request: Request, response: Response) -> dict:
    """One agent, inspected (spec 030).

    Answered from the **same listing** `GET /agents` reads — the service returns every agent's whole
    definition, so there is no second upstream call to make. Read-only, like its sibling: this route
    describes an agent and never changes one. Editing has a spec of its own (041) and a reason to
    stay out of the browser (§4).

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
