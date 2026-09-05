#!/usr/bin/env python3
"""Observation spike — answers open questions O-1, O-3, O-8 and O-9 with evidence.

    az login                        # must reach the subscription holding the Foundry project
    python scripts/spike.py

Nothing is built on top of this until it has run. Constitution §10 forbids writing a Foundry
integration from memory, and the four questions below cannot be answered from the documentation:

  O-1  What are the real stream event names for reasoning summaries, text, function calls and
       MCP calls? The docs describe the concepts, not the wire.
  O-3  Is `require_approval: "never"` accepted for a public MCP server, or is an approval round
       trip mandatory?
  O-8  Does `responses.create(stream=True)` drive a prompt agent whose model is a
       bring-your-own-model deployment? The BYOM page says "The Response API isn't supported at
       present", which we read as constraining the Foundry->gateway hop, not this one. If that
       reading is wrong, the whole streaming design changes.
  O-9  Do reasoning summaries survive the chat/completions hop to a BYOM model?

The script prints findings in a form you can paste into docs/REFERENCES.md, and writes the raw
stream to tests/fixtures/recorded/ so spec 003's normaliser is written against observation.

On failure it does NOT give up quietly: if the BYOM model fails, it retries on a plain deployment,
which distinguishes "BYOM is the problem" from "our request is the problem".
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness._shared.agent_spec import load_agent_spec  # noqa: E402
from harness._shared.tools import registry  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tests" / "fixtures" / "recorded"

# Forces one app-executed function call AND one Foundry-executed MCP call in a single turn.
PROBE = (
    "What time is it right now in Sao Paulo, and what do the Microsoft Foundry docs say about "
    "hosted agents? Answer both parts."
)


def banner(text: str) -> None:
    print(f"\n{'=' * 72}\n{text}\n{'=' * 72}")


def run(model: str, label: str) -> dict:
    """Create an agent on `model`, stream one turn, and record everything observed."""
    from azure.ai.projects import AIProjectClient
    from azure.ai.projects.models import PromptAgentDefinition
    from azure.identity import DefaultAzureCredential

    from scripts.apply_agent import build_tools

    endpoint = os.environ["FOUNDRY_PROJECT_ENDPOINT"]
    spec = load_agent_spec(ROOT / "harness" / "prompt_agent" / "agent.yaml")

    project = AIProjectClient(endpoint=endpoint, credential=DefaultAzureCredential())
    agent = project.agents.create_version(
        agent_name=f"spike-{label}",
        definition=PromptAgentDefinition(
            model=model, instructions=spec.instructions, tools=build_tools(spec)
        ),
    )
    print(f"agent {agent.name!r} version {agent.version} on model {model!r}")

    openai = project.get_openai_client()
    conversation = openai.conversations.create()
    agent_ref = {"agent_reference": {"name": agent.name, "type": "agent_reference"}}

    raw: list[dict] = []
    seen: Counter[str] = Counter()
    pending_calls: list[tuple[str, str, str]] = []

    def consume(stream) -> None:
        for event in stream:
            body = event.model_dump() if hasattr(event, "model_dump") else dict(event)
            etype = body.get("type", "<no type>")
            seen[etype] += 1
            raw.append(body)
            print(f"  <- {etype}")
            if etype == "response.output_item.done":
                item = body.get("item") or {}
                if item.get("type") == "function_call":
                    pending_calls.append(
                        (item["call_id"], item["name"], item.get("arguments", "{}"))
                    )

    consume(
        openai.responses.create(
            input=PROBE, conversation=conversation.id, stream=True, extra_body=agent_ref
        )
    )

    # Answer the function calls, or the run hangs until it expires ten minutes from now.
    while pending_calls:
        outputs = []
        for call_id, name, arguments in pending_calls:
            print(f"  -> executing {name}({arguments})")
            result = registry.get(name).call(**json.loads(arguments))
            outputs.append(
                {
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": json.dumps(result),
                }
            )
        pending_calls = []
        consume(
            openai.responses.create(
                input=outputs, conversation=conversation.id, stream=True, extra_body=agent_ref
            )
        )

    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    out = FIXTURES / f"{label}-{stamp}.raw.jsonl"
    out.write_text("\n".join(json.dumps(e) for e in raw))
    print(f"\nrecorded {len(raw)} events -> {out.relative_to(ROOT)}")
    print("  (.raw.jsonl is gitignored — redact ids, then commit as .jsonl)")

    return {"model": model, "events": seen, "count": len(raw), "fixture": out}


def report(result: dict) -> None:
    seen = result["events"]
    banner("FINDINGS — paste into docs/REFERENCES.md")

    print(
        f"\nObserved {result['count']} events on model {result['model']!r} "
        f"({datetime.now(UTC).date()}).\n"
    )
    print("O-1 — event types in this stream:")
    for name, count in sorted(seen.items(), key=lambda kv: -kv[1]):
        print(f"      {count:4d}  {name}")

    reasoning = [n for n in seen if "reasoning" in n]
    mcp = [n for n in seen if "mcp" in n]
    approval = [n for n in seen if "approval" in n]

    print(f"\nO-9 — reasoning summary events: {reasoning or 'NONE'}")
    if not reasoning:
        print("      Expected on gpt-4o: it is not a reasoning model, so there is nothing to")
        print("      summarise. Expose a GPT-5.x model on the connection to answer the real")
        print("      question — whether summaries survive the chat/completions hop.")

    print(f"\nO-1 — MCP event types: {mcp or 'NONE'}")
    print(f"O-3 — approval events: {approval or 'NONE — require_approval: never was accepted'}")
    print(f"\nO-8 — the Responses API DID drive a prompt agent on model {result['model']!r}.")


def main() -> int:
    if not os.environ.get("FOUNDRY_PROJECT_ENDPOINT"):
        print("error: FOUNDRY_PROJECT_ENDPOINT is not set (cp .env.example .env)", file=sys.stderr)
        return 1
    FIXTURES.mkdir(parents=True, exist_ok=True)

    gateway_model = os.environ.get("FOUNDRY_MODEL_DEPLOYMENT", "foundry-analytics-demo/gpt-4o")
    banner(f"PASS 1 — bring-your-own-model: {gateway_model}")
    try:
        report(run(gateway_model, "byom"))
        return 0
    except Exception as exc:  # noqa: BLE001 - the failure IS the finding
        print(f"\nBYOM pass failed: {type(exc).__name__}: {exc}")

    fallback = os.environ.get("FOUNDRY_FALLBACK_MODEL")
    if not fallback:
        banner("O-8 — INCONCLUSIVE")
        print("The BYOM pass failed and no FOUNDRY_FALLBACK_MODEL is set, so we cannot tell")
        print("whether BYOM is the problem or the request is. Set a plain deployment name in")
        print("FOUNDRY_FALLBACK_MODEL and run again.")
        return 1

    banner(f"PASS 2 — plain deployment: {fallback}")
    try:
        report(run(fallback, "plain"))
        banner("O-8 — ANSWERED: NO")
        print("The Responses API drove the agent on a plain deployment but NOT through BYOM.")
        print("The BYOM page's 'The Response API isn't supported at present' therefore constrains")
        print("THIS hop. PLAN.md 4.3 and the streaming design need revisiting before spec 003.")
        return 2
    except Exception as exc:  # noqa: BLE001
        print(f"\nPlain pass also failed: {type(exc).__name__}: {exc}")
        print("Both passes failed — the request is wrong, not BYOM. Fix the request first.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
