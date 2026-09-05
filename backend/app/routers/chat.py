"""`POST /chat` — stream a turn to the browser as SSE."""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.sse import format_event

router = APIRouter()


class ChatRequest(BaseModel):
    """One user turn.

    Deliberately *not* a message history: Foundry owns conversation state, keyed by
    ``conversation_id``. Accepting history from the client would duplicate state the platform
    already holds, and duplicated state drifts (§8).
    """

    message: str = Field(min_length=1)
    conversation_id: str | None = None


@router.post("/chat")
async def chat(body: ChatRequest, request: Request) -> StreamingResponse:
    harness = request.app.state.harness

    async def frames() -> AsyncIterator[str]:
        """Re-stream the harness as SSE, guaranteeing a terminal frame no matter what.

        The harness already promises to terminate (§9). This is a second belt at the transport
        layer: if it breaks that promise, or breaks while breaking it, the browser still receives an
        `error` rather than a connection that goes quiet.
        """
        terminated = False
        try:
            messages = [{"role": "user", "content": body.message}]
            state = {"conversation_id": body.conversation_id} if body.conversation_id else {}
            async for event in harness.stream_response(messages, state):
                if event["type"] in {"done", "error"}:
                    terminated = True
                yield format_event(event)
        except Exception as exc:  # noqa: BLE001 - a terminal frame is a promise to the client
            terminated = True
            yield format_event(
                {
                    "type": "error",
                    "message": f"{type(exc).__name__}: {exc}",
                    "code": "bff_error",
                }
            )
        finally:
            if not terminated:
                yield format_event(
                    {
                        "type": "error",
                        "message": "the harness stream ended without a terminal event",
                        "code": "missing_terminal",
                    }
                )

    return StreamingResponse(
        frames(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
