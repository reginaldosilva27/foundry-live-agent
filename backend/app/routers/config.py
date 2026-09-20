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
    body = {
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
            # What the browser may choose from (spec 043). One entry means no chooser renders,
            # which is every deployment that has not opted in.
            "voice": settings.voicelive_voice,
            "voices": settings.offered_voices,
        },
        # Whether this deployment may roll an agent back to an earlier version (spec 031). The
        # BFF is the source of truth: a screen that offered a control the server always refuses is
        # exactly the dishonesty §5 names, so the UI renders nothing at all when this is false.
        "agents": {
            "can_promote": settings.allow_version_promote,
            # Nothing here writes; the flag gates a surface, not a permission (spec 041).
            "can_propose": settings.allow_proposals,
        },
        # Its own switch (spec 042): the playground spends a metered key, unlike anything else
        # a reader can turn on here.
        "playground": {"enabled": settings.allow_playground},
        "event_types": sorted(EVENT_TYPES),
        "event_mapping": _mapping_report(settings.harness),
    }

    # Absent unless this build IS a replay (spec 050). There is no `false` to report: a live BFF
    # never mentions the key, which is the same "absent is not false" the panel already renders for
    # tracing and pricing (§5) — and here the distinction is load-bearing, because a browser that
    # read `demo: false` from a build that had never heard of demo mode would be reading a claim
    # nobody made.
    #
    # Read off `app.state`, never imported: `config.py` is reachable from `app.main`, and importing
    # `app.demo` here would put the replay module on the production path — the one thing spec 050
    # is arranged to prevent, and a test walks the import graph for it.
    demo = getattr(request.app.state, "demo", None)
    if demo is not None:
        body["demo"] = {"recorded_at": demo["recorded_at"], "current": demo["current"]}

    # Absent, not empty (spec 028 AC3). `{"rates": {}}` would be this BFF claiming to have a rate
    # table with nothing in it; the truth is that nobody declared one, and the browser must render
    # no money at all rather than a zero. The rates are per MILLION tokens, which is how every
    # price page reads them — the factor is reported so nothing downstream has to assume it.
    if settings.pricing_enabled:
        body["pricing"] = {
            "currency": settings.rates_currency,
            "recorded_at": settings.rates_recorded_at,
            "per_tokens": 1_000_000,
            "rates": settings.model_rates,
        }

    return body
