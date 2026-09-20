"""`GET /demo` and `POST /demo/recording` — which recorded turn is being replayed (spec 050).

**Mounted by `app.demo.create_demo_app` and by nothing else.** A production BFF has no `/demo`
route at all, and `tests/test_demo.py` asserts it.

Why the pick is not a field on `POST /chat`: that body has exactly three keys — `message`,
`conversation_id`, `agent` — and `App.routing.test.tsx` pins them deliberately, to keep this
browser's own choices out of the state Foundry owns (spec 021, spec 045). Spending that pin on a
local convenience would be a poor trade, so the choice lives on its own route and in this process.

The rows carry **codes**, never prose. What a recording demonstrates is a sentence, and a sentence
belongs in `frontend/src/i18n/strings.ts` where it exists in both languages (§7).
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.demo import RECORDED_AT, RECORDINGS

router = APIRouter()


@router.get("/demo")
def demo(request: Request) -> dict:
    """The catalogue, and which of it is being replayed."""
    return {
        "recorded_at": RECORDED_AT,
        "current": request.app.state.demo["current"],
        "recordings": [
            {"id": recording.id, "recorded_at": recording.recorded_at} for recording in RECORDINGS
        ],
    }


class Pick(BaseModel):
    id: str


@router.post("/demo/recording")
def choose(body: Pick, request: Request, response: Response) -> dict:
    """Replay a different turn from the next question onwards.

    A turn already in flight keeps the recording it started with: the adapter is part way through
    its legs, and swapping underneath it would splice two conversations into one.
    """
    if body.id not in {recording.id for recording in RECORDINGS}:
        response.status_code = 404
        return {"current": request.app.state.demo["current"], "error": "unknown_recording"}

    request.app.state.demo["current"] = body.id
    return {"current": body.id, "error": None}
