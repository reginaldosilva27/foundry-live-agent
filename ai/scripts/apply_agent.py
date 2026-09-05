#!/usr/bin/env python3
"""Apply an agent definition to Microsoft Foundry.

    just agent                      # applies the harness selected by AGENT_HARNESS
    python scripts/apply_agent.py --harness prompt-agent --dry-run

Reads `ai/harness/<harness>/agent.yaml`, validates it, and creates an agent **version** through the
Agent Service SDK. Every run creates a new immutable version — that is the rollback story, so
running this twice is normal, not an error.

Auth is Microsoft Entra ID via DefaultAzureCredential. There are no API keys in this design; run
`az login` first.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness._shared.agent_spec import AgentSpec, AgentSpecError, load_agent_spec  # noqa: E402

HARNESS_DIR = Path(__file__).resolve().parent.parent / "harness"


def build_tools(spec: AgentSpec) -> list:
    """Map our schema onto the SDK's tool objects.

    Imported lazily so `--dry-run` works without the Azure SDK installed, which keeps the
    validation path usable in CI where there is no credential.
    """
    from azure.ai.projects.models import FunctionTool, MCPTool

    tools: list = []
    for tool in spec.function_tools:
        tools.append(
            FunctionTool(
                name=tool.name,
                description=tool.description,
                parameters=tool.schema,
                strict=True,
            )
        )
    for mcp in spec.mcp_tools:
        kwargs = {
            "server_label": mcp.name,
            "server_url": mcp.server_url,
            "require_approval": mcp.require_approval,
        }
        if mcp.allowed_tools:
            kwargs["allowed_tools"] = mcp.allowed_tools
        tools.append(MCPTool(**kwargs))
    return tools


def apply(spec: AgentSpec, endpoint: str) -> tuple[str, str]:
    from azure.ai.projects import AIProjectClient
    from azure.ai.projects.models import PromptAgentDefinition
    from azure.identity import DefaultAzureCredential

    project = AIProjectClient(endpoint=endpoint, credential=DefaultAzureCredential())
    version = project.agents.create_version(
        agent_name=spec.name,
        definition=PromptAgentDefinition(
            model=spec.model,
            instructions=spec.instructions,
            tools=build_tools(spec),
        ),
    )
    return version.name, version.version


def describe(spec: AgentSpec) -> str:
    lines = [
        f"  name          {spec.name}",
        f"  model         {spec.model}",
        f"  via gateway   {'yes' if spec.uses_gateway else 'NO — bypasses the gateway'}",
        f"  instructions  {len(spec.instructions)} chars",
        "  tools",
    ]
    for mcp in spec.mcp_tools:
        lines.append(f"    [foundry] mcp      {mcp.name}  ->  {mcp.server_url}")
    for fn in spec.function_tools:
        lines.append(f"    [bff]     function {fn.name}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--harness", default=os.environ.get("AGENT_HARNESS", "prompt-agent"))
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="validate and print the definition without calling Azure",
    )
    args = parser.parse_args()

    path = HARNESS_DIR / args.harness.replace("-", "_") / "agent.yaml"
    try:
        spec = load_agent_spec(path)
    except AgentSpecError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"Agent definition ({path.relative_to(HARNESS_DIR.parent)}):")
    print(describe(spec))

    if args.dry_run:
        print("\nDry run — nothing was applied.")
        return 0

    endpoint = os.environ.get("FOUNDRY_PROJECT_ENDPOINT")
    if not endpoint:
        print(
            "\nerror: FOUNDRY_PROJECT_ENDPOINT is not set."
            " Copy .env.example to .env and fill it in.",
            file=sys.stderr,
        )
        return 1

    name, version = apply(spec, endpoint)
    print(f"\nApplied. Agent {name!r} is now at version {version}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
