#!/usr/bin/env python3
"""The measured comparison — spec 020's AC16, and spec 033's open question.

    az login
    just backend                                  # the BFF must be up; this measures through it
    python scripts/compare_harnesses.py --base-url http://127.0.0.1:8077

**Why through the BFF and not through the adapters.** AC16 asks what happens when *the comparison*
runs, and a comparison is two ordinary `POST /chat` calls (spec 020) — the screen adds no transport
of its own. Driving the adapters directly would measure something the app never does and would put
a second client in the repository for the thing `chat.py` already is (§4). The cost of that choice
is honest and stated in the output: every number here includes one localhost hop.

**What it measures, and what it refuses to.** First token, total wall time, the event mix, and the
`usage` figures each harness reports. It does **not** score, rank or pick a winner — the app says
nothing about which answer is better (spec 020), and a script that did would be arguing for it.

Two probes, because they answer different questions:

  round-trip  The same question spike.py used: one app-executed function call AND one
              Foundry-executed MCP call in a single turn. Identical work, so the difference is the
              harness. This is AC16.
  chart       A question whose answer is a comparison, which is when `agent_core.yaml` tells the
              agent a `foundry-chart` block is appropriate. Spec 033 proved the instructions and
              the renderer agree; nobody had checked whether the model follows them. Whatever comes
              back is the finding — including nothing.

Recordings land in tests/fixtures/recorded/ as JSONL, one event per line, dated. They are what §5
means by recorded rather than hand-written, and `redact_fixture.py` is the same step it always was.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tests" / "fixtures" / "recorded"

PROMPT_AGENT = "foundry-live-agent"
HOSTED_AGENT = "foundry-live-agent-hosted"

PROBES = {
    # Identical to spike.py's, deliberately: the recorded prompt-agent turn it produced is the
    # thing these numbers are comparable against.
    "round-trip": (
        "What time is it right now in Sao Paulo, and what do the Microsoft Foundry docs say about "
        "hosted agents? Answer both parts."
    ),
    # A comparison, but a QUALITATIVE one — and the instruction says "a comparison of quantities".
    # Kept as a probe because declining here is the correct behaviour and worth having recorded:
    # the repository's own comparison doc carries no numbers, so a chart would mean inventing them,
    # which the same instruction forbids.
    "chart-qualitative": (
        "Compare the two harnesses this project ships — the prompt agent and the hosted agent — "
        "on what each one costs to operate and what it gives you. Use the repository's own "
        "knowledge base."
    ),
    # The real test of the open question: quantities the agent can actually obtain, in an answer
    # that IS a comparison. Deliberately never says "chart" or "draw" — the question is whether the
    # model reaches for one unprompted, which is the only thing spec 033 could not prove.
    "chart-quantities": (
        "How many people live in Sao Paulo, Rio de Janeiro and Brasilia? Compare the three."
    ),
}

FENCE = re.compile(r"^```(foundry-chart|mermaid)\b", re.MULTILINE)


def stream(base_url: str, agent: str, message: str) -> tuple[list[dict], float, float]:
    """One `POST /chat`, read as SSE. Returns the events, seconds-to-first-token, total seconds.

    "First token" is the first `text_delta`, not the first frame: a `trace_ids` arriving instantly
    is not the agent starting to answer, and timing to it would flatter both harnesses equally and
    tell the reader nothing.
    """
    body = json.dumps({"message": message, "agent": agent}).encode()
    request = Request(
        f"{base_url}/chat",
        data=body,
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
    )
    events: list[dict] = []
    started = time.monotonic()
    first_text: float | None = None

    with urlopen(request, timeout=600) as response:  # noqa: S310 - a localhost URL we built
        for raw in response:
            line = raw.decode("utf-8").strip()
            if not line.startswith("data:"):
                continue
            event = json.loads(line[5:].strip())
            events.append(event)
            if event.get("type") == "text_delta" and first_text is None:
                first_text = time.monotonic() - started

    total = time.monotonic() - started
    return events, (first_text if first_text is not None else float("nan")), total


def usage_of(events: list[dict]) -> dict | None:
    """The summed `usage`, or ``None`` when the harness reported none.

    ``None`` is a real answer here — spec 018 measured a hosted turn reporting `usage: null`, and
    the comparison column is built to render its absence as normal rather than as a zero (§5).
    """
    rows = [e for e in events if e.get("type") == "usage"]
    if not rows:
        return None
    total: dict[str, int] = {}
    for row in rows:
        for key, value in row.items():
            if isinstance(value, int):
                total[key] = total.get(key, 0) + value
    return total or None


def text_of(events: list[dict]) -> str:
    return "".join(e.get("text", "") for e in events if e.get("type") == "text_delta")


def record(events: list[dict], probe: str, agent: str, stamp: str) -> Path:
    path = FIXTURES / f"compare-{probe}-{agent}-{stamp}.jsonl"
    path.write_text("".join(json.dumps(e, ensure_ascii=False) + "\n" for e in events))
    return path


def run(base_url: str, probe: str, agents: list[str]) -> list[dict]:
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    results = []
    for agent in agents:
        print(f"\n--- {probe} / {agent}", flush=True)
        try:
            events, first, total = stream(base_url, agent, PROBES[probe])
        except (HTTPError, URLError, TimeoutError) as exc:
            print(f"    FAILED: {type(exc).__name__}: {exc}")
            results.append({"agent": agent, "probe": probe, "error": f"{type(exc).__name__}"})
            continue

        text = text_of(events)
        kinds: dict[str, int] = {}
        for event in events:
            kinds[event.get("type", "?")] = kinds.get(event.get("type", "?"), 0) + 1
        fences = FENCE.findall(text)
        path = record(events, probe, agent, stamp)

        result = {
            "agent": agent,
            "probe": probe,
            "first_token_s": round(first, 2) if first == first else None,
            "total_s": round(total, 2),
            "events": len(events),
            "kinds": kinds,
            "usage": usage_of(events),
            "chars": len(text),
            "fences": fences,
            "fixture": path.name,
        }
        results.append(result)
        print(
            f"    first token {result['first_token_s']}s · total {result['total_s']}s · "
            f"{len(events)} events"
        )
        print(f"    kinds   {kinds}")
        print(f"    usage   {result['usage']}")
        print(f"    fences  {fences or 'none'}")
        print(f"    recorded {path.relative_to(ROOT)}")
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--probe", choices=sorted(PROBES), action="append")
    parser.add_argument("--agent", action="append", help="defaults to both of ours")
    args = parser.parse_args()

    FIXTURES.mkdir(parents=True, exist_ok=True)
    agents = args.agent or [PROMPT_AGENT, HOSTED_AGENT]
    everything = []
    for probe in args.probe or sorted(PROBES):
        everything.extend(run(args.base_url, probe, agents))

    # Written, not only printed: the wall-clock numbers exist nowhere else. The JSONL recordings
    # carry the events, but a terminal that scrolls loses the one thing AC16 actually asks for.
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    summary = FIXTURES / f"compare-summary-{stamp}.json"
    existing = json.loads(summary.read_text()) if summary.exists() else []
    summary.write_text(json.dumps(existing + everything, indent=2, ensure_ascii=False) + "\n")

    print("\n=== paste-ready ===")
    print(json.dumps(everything, indent=2, ensure_ascii=False))
    print(f"\nsummary appended to {summary.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
