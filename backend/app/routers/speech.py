"""`POST /speech` — one piece of text, one voice, MP3 back (spec 008).

The browser holds no Azure credential, so synthesis happens here. Nothing about the agent passes
through: this endpoint reads text aloud and knows nothing about turns, tools or conversations.

`def`, not `async def`: synthesis is a blocking `httpx.post`, and a spoken answer calls this
once per sentence *while* the answer is streaming — the worst possible moment to own the loop.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

router = APIRouter()


class SpeechRequest(BaseModel):
    """What to say, and in which of the two languages the app ships (§7)."""

    text: str = Field(min_length=1, max_length=4000)
    lang: Literal["en", "pt"]


@router.post("/speech")
def speech(body: SpeechRequest, request: Request) -> Response:
    synthesize = request.app.state.synthesize
    if synthesize is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "speech is not configured on this server: set SPEECH_ENDPOINT and "
                "SPEECH_RESOURCE_ID. See .env.example."
            ),
        )

    settings = request.app.state.settings
    audio = synthesize(body.text, settings.voice_for(body.lang))
    return Response(content=audio, media_type="audio/mpeg")
