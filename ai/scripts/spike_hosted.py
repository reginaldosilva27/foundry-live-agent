#!/usr/bin/env python3
"""Observation spike for the HOSTED agent — records what the container actually streams.

    az login
    python scripts/spike_hosted.py                    # both probes
    python scripts/spike_hosted.py --probe learn      # just one

Spec 018, T15. Nothing in `harness/langgraph/events.py` is written until this has run. That order
is not ceremony: spec 002 built a normaliser against *inferred* Foundry shapes and the first real
recording contradicted three of them. §10 says the same thing in one line — no Foundry API from
memory.

**What this script does NOT do, and that absence is the point.** `spike.py` answers function calls:
Foundry emits them, stops, and hangs for ten minutes if nobody replies. Here the container owns the
loop and runs its own tools, so there is nothing for this script to answer. It opens one stream and
reads until it ends. If it turns out that a function call *does* come back, that is a finding worth
more than this spec's plan, and the script says so loudly rather than hanging.

The two probes exist because AC3 and AC4 are different claims:

  learn     needs Microsoft Learn. With the prompt agent this produces an `mcp_call`, because
            Foundry is the MCP client. Here the CONTAINER is the client (decision 5), so the
            prediction is a plain tool call — and the recorded pair of fixtures is the finding.
  function  needs a function tool the BFF would have run for the prompt agent. Here the container
            runs it, so the prediction is `executor: "foundry"` on a tool the app never saw.

It also answers, from the same recordings:

  AC13  does a hosted turn emit reasoning summaries at all?
  AC10  what response_id does it report, for the trace panel to query?

Raw streams land in tests/fixtures/recorded/ as `.raw.jsonl` (gitignored). Redact with
scripts/redact_fixture.py, then commit the `.jsonl` (§5).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness._shared.agent_spec import load_agent_spec  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tests" / "fixtures" / "recorded"
HOSTED_AGENT_YAML = ROOT / "harness" / "langgraph" / "agent.yaml"

# Deliberately the same questions the prompt-agent fixtures were recorded with, so the two sets can
# be read side by side. A different question would make the comparison a guess.
PROBES = {
    "learn": (
        "What do the Microsoft Foundry docs say about hosted agents? Cite the page you used."
    ),
    "function": (
        "What time is it right now in Sao Paulo, and what does this repository's knowledge base "
        "say about its harnesses? Answer both parts."
    ),
}


def banner(text: str) -> None:
    print(f"\n{'=' * 72}\n{text}\n{'=' * 72}")


# The documented endpoint shape omits it; the service rejects a request without it. Observed
# 2026-09-16: `400 BadRequest — Missing required query parameter: api-version`. `azd deploy` prints
# the same URL WITH `?api-version=v1`, so the deploy output is the accurate source here (§10).
API_VERSION = "v1"


def responses_url(project_endpoint: str, agent_name: str) -> str:
    """The hosted agent's own endpoint.

    Read 2026-09-16: `{project_endpoint}/agents/{name}/endpoint/protocols/openai/responses`, live as
    soon as the agent is deployed — publishing is not required for programmatic access. The
    `api-version` the doc leaves off is added here; see API_VERSION.
    """
    base = f"{project_endpoint.rstrip('/')}/agents/{agent_name}/endpoint/protocols/openai/responses"
    return f"{base}?api-version={API_VERSION}"


def record(probe_name: str, question: str, agent_name: str, endpoint: str) -> dict:
    """Stream one turn against the deployed hosted agent and write down everything it said."""
    import httpx
    from azure.identity import DefaultAzureCredential

    url = responses_url(endpoint, agent_name)
    token = DefaultAzureCredential().get_token("https://ai.azure.com/.default").token

    banner(f"PROBE {probe_name!r} -> {url}")
    print(f"  {question}\n")

    raw: list[dict] = []
    seen: Counter[str] = Counter()
    calls: dict[str, str] = {}
    answered: set[str] = set()

    with (
        httpx.Client(timeout=300.0) as client,
        client.stream(
            "POST",
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
            json={"input": question, "stream": True},
        ) as response,
    ):
        if response.status_code >= 400:
            body = b"".join(response.iter_bytes()).decode("utf-8", "replace")
            raise SystemExit(f"HTTP {response.status_code} from {url}\n{body[:2000]}")

        for line in response.iter_lines():
            if not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if not payload or payload == "[DONE]":
                continue
            event = json.loads(payload)
            etype = event.get("type", "<no type>")
            seen[etype] += 1
            raw.append(event)
            print(f"  <- {etype}")

            # The prediction this spec rests on is that nothing comes back for US to run.
            #
            # A `function_call` item alone does NOT mean that. Observed 2026-09-16: the hosted
            # agent emits `function_call` AND `function_call_output` with the same call_id in one
            # stream — it is *reporting* a call it already made and answered, which is exactly the
            # tool_call/tool_result pair AC3 and AC4 ask for. Only an UNANSWERED call would mean
            # the container expects us to answer, so the check is on the pairing, not the presence.
            item = event.get("item") or {}
            if etype == "response.output_item.done":
                if item.get("type") == "function_call":
                    calls[item["call_id"]] = item.get("name") or "<unnamed>"
                elif item.get("type") == "function_call_output":
                    answered.add(item["call_id"])

    stamp = datetime.now(UTC).strftime("%Y%m%d")
    out = FIXTURES / f"langgraph-hosted-{probe_name}-{stamp}.raw.jsonl"
    out.write_text("\n".join(json.dumps(e) for e in raw))
    print(f"\nrecorded {len(raw)} events -> {out.relative_to(ROOT)}")
    print("  (.raw.jsonl is gitignored — redact ids, then commit as .jsonl)")

    return {
        "probe": probe_name,
        "events": seen,
        "count": len(raw),
        "fixture": out,
        "raw": raw,
        "calls": calls,
        "unanswered": {cid: name for cid, name in calls.items() if cid not in answered},
    }


def report(result: dict) -> None:
    """Print the answers this recording gives, in the words the acceptance criteria use."""
    seen = result["events"]
    raw = result["raw"]
    banner(f"FINDINGS — probe {result['probe']!r} — paste into docs/REFERENCES.md")

    print(f"{result['count']} events, {len(seen)} distinct types:")
    for etype, count in sorted(seen.items(), key=lambda kv: -kv[1]):
        print(f"  {count:>5}  {etype}")

    items = [
        (e.get("item") or {}).get("type")
        for e in raw
        if e.get("type") == "response.output_item.done"
    ]
    print("\noutput item types:", dict(Counter(t for t in items if t)))

    # AC3 — is there an mcp_call, or did the container act as the MCP client?
    mcp = [e for e in raw if "mcp" in e.get("type", "")]
    print(f"\nAC3  mcp_* events: {len(mcp)}")
    print(
        "     -> the container is the MCP client, as decision 5 predicted"
        if not mcp
        else "     -> FINDING: the hosted agent DID emit mcp events; decision 5 was wrong"
    )

    # AC13 — reasoning summaries, or an empty card?
    summaries = sum(v for k, v in seen.items() if "reasoning_summary" in k)
    print(f"\nAC13 reasoning summary events: {summaries}")
    print(
        "     -> none; the reasoning card stays empty, which spec 015 already made survivable"
        if not summaries
        else "     -> present; the card fills on this harness too"
    )

    # AC10 — what the trace panel will have to query.
    completed = [e for e in raw if e.get("type") == "response.completed"]
    if completed:
        response = completed[-1].get("response") or {}
        print(f"\nAC10 response_id: {response.get('id')}")
        print(f"     usage:       {response.get('usage')}")
        print(f"     response.completed count: {len(completed)}")
        if len(completed) > 1:
            print("     -> more than one: usage must be summed and `done` held back, as with the")
            print("        prompt agent. The adapter's single-leg assumption needs revisiting.")

    calls, unanswered = result["calls"], result["unanswered"]
    print(f"\nAC4  tool calls: {len(calls)} — {sorted(calls.values())}")
    print(f"     answered by the container in the same stream: {len(calls) - len(unanswered)}")
    if unanswered:
        banner("!! FINDING — the hosted agent asked US to run a tool")
        print("unanswered:", unanswered)
        print(
            "The plan assumed the container answers its own calls. It does not. This is worth\n"
            "more than the plan: write it into spec.md before changing any code."
        )
    elif calls:
        print("     -> every call answered by the container. The BFF has nothing to submit, which")
        print("        is what makes this adapter a single leg with no loop.")

    # The contract allows `usage` to be absent; every surface that reads it must survive that.
    if completed and (completed[-1].get("response") or {}).get("usage") is None:
        print("\nFINDING: response.completed carries `usage: null`. The prompt agent reports")
        print("         tokens; this harness does not.")
        print("         The cost line and spec 020's comparison must survive its absence")
        print("         rather than render a zero.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probe", choices=sorted(PROBES), action="append")
    parser.add_argument(
        "--agent",
        help="agent name; defaults to the name in harness/langgraph/agent.yaml",
    )
    args = parser.parse_args()

    endpoint = os.environ.get("FOUNDRY_PROJECT_ENDPOINT")
    if not endpoint:
        print(
            "error: FOUNDRY_PROJECT_ENDPOINT is not set. Copy .env.example to .env and fill it in.",
            file=sys.stderr,
        )
        return 1

    agent_name = args.agent or load_agent_spec(HOSTED_AGENT_YAML).name
    FIXTURES.mkdir(parents=True, exist_ok=True)

    for name in args.probe or sorted(PROBES):
        report(record(name, PROBES[name], agent_name, endpoint))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
