"""`GET /agents` — which agents the Foundry project has, and which of them this build can drive."""

from __future__ import annotations

from fastapi import APIRouter, Request

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
