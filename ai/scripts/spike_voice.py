#!/usr/bin/env python3
"""Observation spike for Voice Live — answers O-2, O-5 and O-6 with evidence.

    az login
    python scripts/spike_voice.py

Constitution §10: nothing about Voice Live gets written from memory or from a doc alone. Three
things the documentation does not settle, and spec 006 cannot be planned without:

  O-2  Does Voice Live **agent mode** work over the **WebRTC**
       control endpoint `/voice-live/realtime/calls`, or is agent mode WebSocket-only? The docs
       cover each separately and never together. If it is WebSocket-only, the browser cannot get
       peer-to-peer audio and the BFF has to relay it — a different design with worse latency.
  O-6  Which `api-version`? Four appear across current pages — `2026-04-10`, `2026-01-01-preview`,
       `2026-06-01-preview`, `2026-07-15` — and none of them says which is current.
  O-5  Does the agent's own region (eastus2) serve Voice Live at all?

The probe is deliberately cheap: connect, read the first frame, disconnect. A `session.created`
means the endpoint accepted the agent attachment; a close code and reason means it did not, and the
reason is the finding. No audio is sent, so nothing is billed beyond the session setup.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import UTC, datetime
from urllib.parse import urlencode

API_VERSIONS = ("2026-04-10", "2026-01-01-preview", "2026-06-01-preview", "2026-07-15")
SCOPE = "https://ai.azure.com/.default"
TIMEOUT = 20


def token() -> str:
    from azure.identity import DefaultAzureCredential

    return DefaultAzureCredential().get_token(SCOPE).token


def url(host: str, path: str, api_version: str, **params: str) -> str:
    query = urlencode({"api-version": api_version, **params})
    return f"wss://{host}{path}?{query}"


async def probe(target: str, bearer: str) -> tuple[str, str]:
    """Connect, read one frame, disconnect. Returns (verdict, detail)."""
    import websockets

    try:
        async with websockets.connect(
            target,
            additional_headers={"Authorization": f"Bearer {bearer}"},
            open_timeout=TIMEOUT,
            close_timeout=5,
        ) as socket:
            raw = await asyncio.wait_for(socket.recv(), timeout=TIMEOUT)
            frame = json.loads(raw)
            return "CONNECTED", json.dumps(frame)[:1500]
    except Exception as exc:  # noqa: BLE001 - the failure IS the finding
        detail = str(exc)
        for attribute in ("status_code", "code", "reason"):
            if (value := getattr(exc, attribute, None)) not in (None, ""):
                detail += f" | {attribute}={value}"
        return "FAILED", f"{type(exc).__name__}: {detail}"[:1500]


async def main() -> int:
    endpoint = os.environ.get("VOICELIVE_ENDPOINT") or os.environ.get("FOUNDRY_PROJECT_ENDPOINT")
    if not endpoint:
        print("error: set VOICELIVE_ENDPOINT (or FOUNDRY_PROJECT_ENDPOINT)", file=sys.stderr)
        return 1

    host = endpoint.split("://", 1)[-1].split("/", 1)[0]
    agent = os.environ.get("AGENT_NAME", "foundry-live-agent")
    project = os.environ["FOUNDRY_PROJECT_NAME"]
    model = os.environ.get("VOICELIVE_MODEL", "gpt-realtime")
    bearer = token()

    print(f"host      {host}\nagent     {agent}\nproject   {project}\n")

    # Four combinations, because two independent things are unknown: does the WebRTC control
    # endpoint exist, and does agent mode work on each endpoint. A model-mode probe on each is the
    # control group — it separates "this endpoint is wrong" from "agent mode is not supported here".
    documented = {"agent_name": agent, "project_name": project}
    working = {"agent_name": agent, "agent_project_name": project}

    cases = [
        # The documented pair is probed deliberately, and it fails: the quickstart says
        # `project_name`, the service says "Missing required agent project name". Keeping the case
        # means a re-run reproduces the *finding* rather than reproducing the mistake.
        ("WS   · agent(doc)", "/voice-live/realtime", documented),
        ("WS   · agent", "/voice-live/realtime", working),
        ("WS   · model", "/voice-live/realtime", {"model": model}),
        ("WebRTC · agent", "/voice-live/realtime/calls", working),
        ("WebRTC · model", "/voice-live/realtime/calls", {"model": model}),
    ]

    results: list[tuple[str, str, str, str]] = []
    for label, path, params in cases:
        for api_version in API_VERSIONS:
            target = url(host, path, api_version, **params)
            verdict, detail = await probe(target, bearer)
            print(f"{verdict:9} {label:15} {api_version:20} {detail[:120]}")
            results.append((label, api_version, verdict, detail))

    rule = "=" * 78
    print(f"\n{rule}\nFINDINGS — {datetime.now(UTC).date()}\n{rule}")
    working = [r for r in results if r[2] == "CONNECTED"]
    if not working:
        print("Nothing connected. Full detail of the first failure per case:")
        for label in dict.fromkeys(r[0] for r in results):
            first = next(r for r in results if r[0] == label)
            print(f"\n{label}:\n  {first[3]}")
        return 2

    for label in dict.fromkeys(r[0] for r in working):
        versions = [r[1] for r in working if r[0] == label]
        print(f"{label:15} works on: {', '.join(versions)}")
    webrtc = any(r[0] == "WebRTC · agent" for r in working)
    print(f"\nO-2 — WebRTC agent mode: {'YES' if webrtc else 'NO'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
