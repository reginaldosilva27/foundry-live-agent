#!/usr/bin/env python3
"""Can Voice Live attach to a HOSTED agent? (spec 018, AC9 · T17)

    az login
    python scripts/spike_hosted_voice.py

Nobody knows, the documentation does not say, and §10 forbids guessing — so this asks the service
and records whichever answer it gives. **Not attempting is a failing case** (AC9), which is why this
script exists at all rather than a sentence saying voice "probably" works.

It opens the Voice Live WebSocket with the same `agent_name` + `agent_project_name` query the
prompt agent uses (`harness/_shared/voice_events.attachment_query`) — the pair that was itself
discovered by observation on 2026-09-15, because the published quickstart names `project_name` and
the service rejects it. The only thing changed here is WHICH agent is named.

Three outcomes, all of them results:

  attaches          voice works on both harnesses; the frames are recorded as a fixture.
  refuses politely  the service closes with a reason; the reason goes into docs/REFERENCES.md and
                    the UI disables the control with a bilingual message.
  refuses obscurely  also a result — the raw close code and body are the finding.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness._shared.agent_spec import load_agent_spec  # noqa: E402
from harness._shared.voice_events import attachment_query  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tests" / "fixtures" / "recorded"
HOSTED_AGENT_YAML = ROOT / "harness" / "langgraph" / "agent.yaml"

# The plain WebSocket route works on all four api-versions observed 2026-09-15; the WebRTC control
# route exists only on 2026-01-01-preview. This probe uses the WebSocket route because attachment —
# not audio — is the question.
WS_API_VERSION = "2026-04-10"


def resource_host(project_endpoint: str) -> str:
    """Voice Live lives on the RESOURCE, not the project path."""
    return project_endpoint.split("://", 1)[-1].split("/", 1)[0]


async def probe(agent: str, project: str, endpoint: str) -> int:
    import websockets
    from azure.identity.aio import DefaultAzureCredential

    query = {"api-version": WS_API_VERSION, **attachment_query(agent=agent, project=project)}
    url = f"wss://{resource_host(endpoint)}/voice-live/realtime?{urlencode(query)}"

    print(f"{'=' * 72}\nATTACHING Voice Live to the HOSTED agent\n{'=' * 72}")
    print(f"  agent:   {agent}")
    print(f"  project: {project}")
    print(f"  url:     {url}\n")

    async with DefaultAzureCredential() as credential:
        token = (await credential.get_token("https://ai.azure.com/.default")).token

    frames: list[dict] = []
    try:
        async with websockets.connect(
            url, additional_headers={"Authorization": f"Bearer {token}"}
        ) as socket:
            print("  socket OPEN — the service accepted the attachment")
            # Read whatever it says first. `session.created` / `session.updated` means it really
            # attached; an `error` frame means it accepted the socket and refused the agent.
            for _ in range(5):
                try:
                    frame = json.loads(await asyncio.wait_for(socket.recv(), timeout=20))
                except TimeoutError:
                    print("  (no further frames)")
                    break
                frames.append(frame)
                print(f"  <- {frame.get('type')}")
                if frame.get("type") == "error":
                    print(f"     {json.dumps(frame.get('error'), indent=6)[:700]}")
                    break
    except Exception as exc:  # noqa: BLE001 - the failure IS the finding (§5)
        print(f"\n  REFUSED: {type(exc).__name__}: {exc}")
        frames.append({"type": "__probe_error__", "error": f"{type(exc).__name__}: {exc}"})

    stamp = datetime.now(UTC).strftime("%Y%m%d")
    out = FIXTURES / f"langgraph-hosted-voice-{stamp}.raw.jsonl"
    FIXTURES.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(json.dumps(f) for f in frames))
    print(f"\nrecorded {len(frames)} frames -> {out.relative_to(ROOT)}")

    attached = any(str(f.get("type", "")).startswith("session.") for f in frames)
    print(f"\n{'=' * 72}\nAC9: voice {'ATTACHES' if attached else 'DOES NOT ATTACH'}\n{'=' * 72}")
    if not attached:
        print("-> the harness reports voice unavailable, the UI disables the control with a")
        print("   bilingual reason, and this refusal goes into docs/REFERENCES.md.")
    return 0


def main() -> int:
    endpoint = os.environ.get("FOUNDRY_PROJECT_ENDPOINT")
    project = os.environ.get("FOUNDRY_PROJECT_NAME")
    if not (endpoint and project):
        print(
            "error: FOUNDRY_PROJECT_ENDPOINT and FOUNDRY_PROJECT_NAME must be set.",
            file=sys.stderr,
        )
        return 1
    return asyncio.run(probe(load_agent_spec(HOSTED_AGENT_YAML).name, project, endpoint))


if __name__ == "__main__":
    raise SystemExit(main())
