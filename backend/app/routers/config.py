"""`GET /config` — what the frontend is talking to."""

from __future__ import annotations

from fastapi import APIRouter, Request
from harness._shared.contract import EVENT_TYPES
from harness.prompt_agent.events import mapping_report

router = APIRouter()


@router.get("/config")
async def config(request: Request) -> dict:
    """Describe the running configuration, including what is *not* yet verified.

    ``event_mapping`` reports how many raw Foundry event names the normaliser has actually observed
    versus inferred from documented shapes. Surfacing that in the API rather than a code comment is
    the point: a reader can see the gap without reading the source (§5, §10).
    """
    settings = request.app.state.settings
    return {
        "harness": settings.harness,
        "agent_name": settings.agent_name,
        "agent_version": settings.agent_version,
        "model": settings.model,
        "uses_gateway": settings.uses_gateway,
        "project_name": settings.project_name,
        "speech": {"enabled": request.app.state.synthesize is not None},
        "voice": {
            "enabled": request.app.state.voice_connect is not None,
            # Two endpoints, two api-versions — observed 2026-09-15. Reported rather than hidden:
            # the WebRTC control route exists only on the preview version, and when that changes
            # this is the first place anyone will look.
            "webrtc_api_version": settings.voice_webrtc_api_version,
        },
        "event_types": sorted(EVENT_TYPES),
        "event_mapping": mapping_report(),
    }
