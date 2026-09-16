#!/usr/bin/env python3
"""Generate `ai/azure.yaml` from the hosted harness's `agent.yaml`.

    python scripts/build_hosted_config.py            # write it
    python scripts/build_hosted_config.py --check    # fail if the committed file drifted

`azure.yaml` is **Microsoft's** schema for a hosted agent; `agent.yaml` is ours. Both describe the
same agent, which is the drift §4 forbids — so one is generated from the other and a test runs this
script in `--check` mode. The committed file is what `azd` reads, so AC8's promise ("a cloner can
deploy from committed configuration") survives the generator being a convenience.

Everything written here comes from a doc read on **2026-09-16** and cited in docs/REFERENCES.md:
the service shape, the `container.resources` spelling, the reserved `FOUNDRY_`/`AGENT_` prefixes,
and the rule against declaring `FOUNDRY_PROJECT_ENDPOINT` in `env` (§10).

**One thing is deliberately not written.** The session idle timeout is configurable per agent
version (2-60 minutes, 15 by default), but the `azure.ai.agent` field reference documents no key
for it. Inventing `idleTimeout` would be exactly the Foundry API from memory §10 forbids, so the
value we intend is stated in a comment and the platform default stands. See docs/REFERENCES.md,
open question O-18-1.
"""

from __future__ import annotations

import argparse
import sys
import textwrap
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from harness._shared.agent_spec import AgentSpec, AgentSpecError, load_agent_spec  # noqa: E402

AI = Path(__file__).resolve().parent.parent
HOSTED_AGENT_YAML = AI / "harness" / "langgraph" / "agent.yaml"
AZURE_YAML = AI / "azure.yaml"

# The azd project root is `ai/`, so the Docker build context is `ai/` — which is the whole point:
# the image needs `harness/_shared/`, and a context rooted at the agent directory could not see it.
# Vendoring a copy instead would break the one-implementation rule the tools live by (§4, AC6).
SERVICE = "foundry-live-agent-hosted"
DOCKERFILE = "./harness/langgraph/agent/Dockerfile"
STARTUP_COMMAND = "python -m harness.langgraph.agent.host"

# Read 2026-09-16 from the azure.yaml reference. Pinned so a reader knows which schema this was
# generated against, and so an extension upgrade that changes the shape fails loudly.
REQUIRED_VERSIONS = {
    "azd": ">=1.27.1",
    "extensions": {
        "azure.ai.agents": ">=1.0.0-beta.8",
        "azure.ai.projects": ">=1.0.0-beta.4",
    },
}


def render(spec: AgentSpec) -> str:
    """The whole file, as text.

    Hand-rendered rather than `yaml.dump`ed: the comments are the point. A generated config that
    explains none of its choices teaches nothing, and this repository is teaching material.
    """
    hosted = spec.hosted or {}
    cpu = f"{hosted['cpu']:.1f}"
    memory = f"{hosted['memory_gib']}Gi"
    idle = hosted["idle_timeout_minutes"]
    # Folded into a `>` scalar at the file's own width; one 300-character line is valid YAML
    # and unreadable, and a generated file nobody wants to read is a generated file nobody
    # checks.
    description = "\n      ".join(textwrap.wrap(" ".join(spec.description.split()), width=92))

    return f"""\
# GENERATED FILE — do not edit by hand.
#
#   source     ai/harness/langgraph/agent.yaml
#   generator  ai/scripts/build_hosted_config.py   (`just hosted-config`)
#   drift test ai/tests/test_hosted_config.py
#
# Microsoft's schema for a hosted agent. Ours is agent.yaml; this is generated from it so the two
# cannot disagree (§4). Edit agent.yaml and re-run the generator.
#
# The azd project root is `ai/`, which is also the Docker build context: the image needs
# `harness/_shared/` — the same tool implementations the BFF runs — and a context rooted at the
# agent directory could not see them (spec 018, AC6).
#
# SESSION IDLE TIMEOUT: {idle} minutes, which is the platform default (the range is 2-60). It is NOT
# set below, because the azure.ai.agent field reference documents no key for it. Setting an invented
# key would be a Foundry API written from memory (§10) — see docs/REFERENCES.md, open question
# O-18-1. If a key turns out to exist, it belongs here, generated from agent.yaml like everything
# else.
#
# SECRETS: none are declared here, and that is the point. `search_web` needs TAVILY_API_KEY, and
# the hosted-agent documentation is explicit that secrets belong in neither the image nor the
# environment. KEY_VAULT_URI below is an address, not a secret: the container reads the value at
# startup with the dedicated Entra agent identity Foundry creates at deploy time. The one step that
# cannot be expressed here — Key Vault Secrets User on that identity, which does not exist until
# after the first deploy — is a documented manual step, not unverified IaC (§5, AC7).

# yaml-language-server: $schema=https://raw.githubusercontent.com/Azure/azure-dev/main/schemas/v1.0/azure.yaml.json

name: {SERVICE}

requiredVersions:
  azd: "{REQUIRED_VERSIONS["azd"]}"
  extensions:
    azure.ai.agents: "{REQUIRED_VERSIONS["extensions"]["azure.ai.agents"]}"
    azure.ai.projects: "{REQUIRED_VERSIONS["extensions"]["azure.ai.projects"]}"

services:
  # The Foundry project this repository already provisions. `endpoint` points azd at the existing
  # project instead of creating one, and the model deployment is not declared here: the prompt
  # agent already runs on it, and declaring it twice is the drift this file exists to avoid.
  ai-project:
    host: azure.ai.project
    endpoint: ${{FOUNDRY_PROJECT_ENDPOINT}}

  {SERVICE}:
    host: azure.ai.agent
    kind: hosted
    name: {spec.name}
    description: >
      {description}
    uses:
      - ai-project
    project: .
    language: docker
    docker:
      path: {DOCKERFILE}
      context: .
    startupCommand: {STARTUP_COMMAND}
    protocols:
      - protocol: {hosted["protocol"]}
        version: 2.0.0
    # FOUNDRY_PROJECT_ENDPOINT is deliberately absent: the platform injects it, and the FOUNDRY_
    # and AGENT_ prefixes are reserved. Declaring it risks shadowing the platform value.
    env:
      MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME: ${{MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME}}
      # An address, not a secret. Blank is a supported state: `search_web` then answers
      # `search_unavailable`, which the instructions already tell the agent how to handle.
      KEY_VAULT_URI: ${{KEY_VAULT_URI}}
    # One session's allocation, not the agent's total: every session gets its own sandbox and
    # billing sums CPU+memory across active sessions, so oversizing multiplies by concurrency.
    container:
      resources:
        cpu: "{cpu}"
        memory: {memory}

# Foundry synthesises the infrastructure from the services above; there is no infra/ directory and
# no Bicep. Without this block azd falls back to its default bicep provider and fails looking for
# `infra/main.bicep` — observed 2026-09-16. The value is the one `azd ai agent init` writes itself,
# confirmed by running it against this project rather than inferred from prose (§10).
infra:
  provider: microsoft.foundry
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero if the committed azure.yaml differs from what this would write",
    )
    args = parser.parse_args()

    try:
        spec = load_agent_spec(HOSTED_AGENT_YAML)
    except AgentSpecError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if spec.hosted is None:
        print(
            f"error: {HOSTED_AGENT_YAML} has no 'hosted:' block, so it does not describe a "
            "container agent.",
            file=sys.stderr,
        )
        return 1

    generated = render(spec)

    if not args.check:
        AZURE_YAML.write_text(generated)
        print(f"Wrote {AZURE_YAML.relative_to(AI.parent)}")
        return 0

    committed = AZURE_YAML.read_text() if AZURE_YAML.exists() else ""
    if committed == generated:
        print(f"{AZURE_YAML.relative_to(AI.parent)} is up to date.")
        return 0

    print(
        f"error: {AZURE_YAML.relative_to(AI.parent)} does not match its source.\n"
        "It is generated from ai/harness/langgraph/agent.yaml — edit that, then run:\n"
        "    just hosted-config",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
