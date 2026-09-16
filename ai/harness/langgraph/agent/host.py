"""The container entrypoint — what Foundry starts (spec 018, decision 10).

    python -m harness.langgraph.agent.host

Builds the model client, loads the tools, compiles the graph, and hands it to
`ResponsesHostServer`, which serves `POST /responses` and — once deployed — is reached at
`{project_endpoint}/agents/{name}/endpoint/protocols/openai/responses`. Responses rather than
Invocations because the platform then manages conversation history and the streaming lifecycle,
which is precisely the state this harness must not own (decision 10).

Three startup decisions are made before any I/O, and each is a test in
`ai/tests/test_hosted_host.py` rather than something discovered in production:

**The secret.** `search_web` needs `TAVILY_API_KEY`, and the hosted-agent documentation is explicit
that secrets belong in neither the image nor the environment of an agent version. So the version
carries `KEY_VAULT_URI` — an address — and the value is read here with the **dedicated Entra agent
identity Foundry creates at deploy time**, which `DefaultAzureCredential` picks up inside the
sandbox. No vault configured is a supported deployment; a vault configured and unreadable is a
broken one, and fails the container (§5).

**The model deployment.** The two Microsoft docs disagree: the `azure.yaml` reference reserves the
`FOUNDRY_` prefix and passes the deployment as `MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME`, while the
LangGraph hosting guide's own sample reads `FOUNDRY_MODEL_NAME`. Reading both, platform value first,
costs one line and survives either doc being the accurate one. The agent definition is the last
word, so a local run needs no variables at all.

**The instructions.** Read from `harness/langgraph/agent.yaml`, which `extends:` the same
`_shared/agent_core.yaml` the prompt agent uses. One definition, two harnesses (§4, AC5).
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import Callable

from harness._shared.agent_spec import AgentSpec, load_agent_spec
from harness.langgraph.agent.graph import AGENT_YAML, build_graph
from harness.langgraph.agent.tools import function_tools, load_mcp_tools

__all__ = ["StartupError", "load_secrets", "main", "model_deployment"]

# Read 2026-09-16: Foundry's own inference scope.
AZURE_AI_SCOPE = "https://ai.azure.com/.default"
# The default `ResponsesHostServer` port; the platform sets PORT.
DEFAULT_PORT = 8088
TAVILY_SECRET_NAME = "tavily-api-key"


class StartupError(RuntimeError):
    """The container cannot start with this configuration."""


def model_deployment(fallback: str) -> str:
    """Which model deployment to call. See the module docstring for why two names are read."""
    return (
        os.environ.get("FOUNDRY_MODEL_NAME")
        or os.environ.get("MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME")
        or fallback
    )


def load_secrets(reader: Callable[[str, str], str] | None = None) -> None:
    """Put `TAVILY_API_KEY` in the environment, from the vault the agent version points at.

    The registry already reads the key from the environment, so this is the whole integration: the
    *value* never appears in the image or on the agent version, only its address does. ``reader``
    is injected so the decision this function makes can be tested without a vault or a credential.
    """
    vault_uri = os.environ.get("KEY_VAULT_URI", "").strip()
    if not vault_uri:
        # A deployment with no web search. The instructions already tell the agent what to do when
        # `search_web` answers `search_unavailable`, so this degrades honestly rather than silently.
        return

    try:
        os.environ["TAVILY_API_KEY"] = (reader or _read_key_vault_secret)(
            vault_uri, TAVILY_SECRET_NAME
        )
    except Exception as exc:  # noqa: BLE001 - every failure here means the same thing
        raise StartupError(
            f"KEY_VAULT_URI is set to {vault_uri!r} but secret {TAVILY_SECRET_NAME!r} could not be "
            f"read: {type(exc).__name__}: {exc}. The agent identity needs the 'Key Vault Secrets "
            "User' role on that vault — see ai/harness/langgraph/README.md. Unset KEY_VAULT_URI to "
            "run without web search."
        ) from exc


def _read_key_vault_secret(vault_uri: str, name: str) -> str:
    """The real read, with the agent's own Entra identity. Imported lazily so the module loads
    without the Azure SDK — which is what lets the tests above run in CI."""
    from azure.identity import DefaultAzureCredential
    from azure.keyvault.secrets import SecretClient

    return SecretClient(vault_uri, DefaultAzureCredential()).get_secret(name).value


def build_chat_model(spec: AgentSpec):
    """The chat model, reached through the project's OpenAI-compatible endpoint.

    `FOUNDRY_PROJECT_ENDPOINT` is injected by the platform and must not be declared on the agent
    version; read here, never set (read 2026-09-16).
    """
    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential, get_bearer_token_provider
    from langchain_openai import ChatOpenAI

    endpoint = os.environ.get("FOUNDRY_PROJECT_ENDPOINT", "").rstrip("/")
    if not endpoint:
        raise StartupError(
            "FOUNDRY_PROJECT_ENDPOINT is not set. The platform injects it into a hosted container; "
            "for a local run, export it yourself."
        )

    credential = DefaultAzureCredential()
    openai_client = AIProjectClient(endpoint=endpoint, credential=credential).get_openai_client()
    return ChatOpenAI(
        model=model_deployment(fallback=spec.model),
        base_url=str(openai_client.base_url),
        api_key=get_bearer_token_provider(credential, AZURE_AI_SCOPE),
    )


async def build() -> object:
    """Everything the server needs, assembled once at startup."""
    spec = load_agent_spec(AGENT_YAML)
    load_secrets()
    tools = [*function_tools(), *await load_mcp_tools(spec)]
    return build_graph(build_chat_model(spec), tools, instructions=spec.instructions)


def main() -> None:
    from langchain_azure_ai.agents.hosting import ResponsesHostServer

    graph = asyncio.run(build())
    ResponsesHostServer(graph).run(port=int(os.environ.get("PORT", DEFAULT_PORT)))


if __name__ == "__main__":
    main()
