"""`GET /config` — what the frontend is talking to."""

from __future__ import annotations

from fastapi import APIRouter, Request
from harness._shared.contract import EVENT_TYPES

router = APIRouter()

# Each harness normalises a different raw stream, so each has its own mapping report. Importing one
# unconditionally made `/config` describe the prompt agent's coverage no matter which harness was
# running — a small bug that only a second harness could expose, which is spec 018 doing its job.
_MAPPING_REPORTS = {
    "prompt-agent": "harness.prompt_agent.events",
    "langgraph": "harness.langgraph.events",
}


def _mapping_report(harness: str) -> dict:
    """The selected harness's observed-vs-inferred split, or an honest blank for an unknown one."""
    from importlib import import_module

    module = _MAPPING_REPORTS.get(harness)
    if module is None:
        return {"total": 0, "verified": 0, "unverified": [], "note": f"unknown harness {harness!r}"}
    return import_module(module).mapping_report()


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
        # ASK THE HARNESS which agent it drives, don't report AGENT_NAME. The header renders this,
        # and `settings.agent_name` is the PROMPT agent's: on the hosted harness the badge named
        # `foundry-live-agent` while every turn went to `foundry-live-agent-hosted` (spec 018).
        # `voice_attachment_params()` is the Protocol's answer to "which agent is this?" — it is
        # named for its first caller, not limited to it.
        "agent_name": request.app.state.harness.voice_attachment_params()["agent_name"],
        "agent_version": settings.agent_version,
        "model": settings.model,
        "uses_gateway": settings.uses_gateway,
        "project_name": settings.project_name,
        "speech": {"enabled": request.app.state.synthesize is not None},
        # Whether spans can be read, never where they live: the resource id is a deployment
        # detail the browser has no use for (spec 005, AC9). `gateway_logged` is false until an
        # APIM diagnostic setting exists, which is a deliberate non-goal of spec 005's first pass —
        # so the panel's gateway line is driven by config rather than hardcoded.
        "tracing": {
            "enabled": request.app.state.read_trace is not None,
            "gateway_logged": False,
        },
        "voice": {
            "enabled": request.app.state.voice_connect is not None,
            # Two endpoints, two api-versions — observed 2026-09-15. Reported rather than hidden:
            # the WebRTC control route exists only on the preview version, and when that changes
            # this is the first place anyone will look.
            "webrtc_api_version": settings.voice_webrtc_api_version,
        },
        "event_types": sorted(EVENT_TYPES),
        "event_mapping": _mapping_report(settings.harness),
    }
