"""The container's startup decisions (spec 018, AC7 · AC11).

`host.py` is mostly I/O and is proven by a real deployment, not a unit test. Two things it decides
before any I/O happens are worth pinning down here, because both are easy to get wrong in a way
that only shows up in production:

1. **How the secret arrives.** AC7 — never from the image, never from a plaintext env var on the
   agent version. A vault address, read with the agent's own identity.
2. **Which model deployment it talks to.** The two Microsoft docs disagree about the variable name,
   so the container reads both rather than betting on one.
"""

import pytest

langgraph = pytest.importorskip(
    "langgraph",
    reason="the hosted agent's own dependencies are not installed; see tests/test_hosted_graph.py",
)

from harness.langgraph.agent import host  # noqa: E402

# --- the secret (AC7) -----------------------------------------------------


def test_no_vault_configured_is_a_supported_deployment(monkeypatch):
    """Blank means "this deployment has no web search", which the agent's instructions already
    handle: `search_web` answers `search_unavailable` and the agent says so plainly."""
    monkeypatch.delenv("KEY_VAULT_URI", raising=False)
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    host.load_secrets(reader=_never_called)

    assert "TAVILY_API_KEY" not in host.os.environ


def test_the_secret_is_read_from_the_vault_into_the_environment(monkeypatch):
    """The value reaches the tool the way the tool already expects it — the registry reads
    TAVILY_API_KEY from the environment — without the *agent version* ever carrying it (§4, AC7)."""
    monkeypatch.setenv("KEY_VAULT_URI", "https://kv.vault.azure.net/")
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    seen = {}

    def reader(vault_uri: str, name: str) -> str:
        seen["vault"] = vault_uri
        seen["name"] = name
        return "tvly-from-the-vault"

    host.load_secrets(reader=reader)

    assert seen == {"vault": "https://kv.vault.azure.net/", "name": host.TAVILY_SECRET_NAME}
    assert host.os.environ["TAVILY_API_KEY"] == "tvly-from-the-vault"


def test_a_configured_vault_that_cannot_be_read_fails_the_container(monkeypatch):
    """§5 — misconfiguration fails fast. A vault named but unreadable is a broken deployment, and
    degrading to "web search is off" would hide a missing role assignment behind a working agent
    that quietly stopped searching."""
    monkeypatch.setenv("KEY_VAULT_URI", "https://kv.vault.azure.net/")

    def reader(*_args):
        raise RuntimeError("Forbidden")

    with pytest.raises(host.StartupError, match="KEY_VAULT_URI"):
        host.load_secrets(reader=reader)


# --- the model deployment -------------------------------------------------


def test_the_platform_injected_model_name_wins(monkeypatch):
    monkeypatch.setenv("FOUNDRY_MODEL_NAME", "injected-by-the-platform")
    monkeypatch.setenv("MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME", "from-azure-yaml")

    assert host.model_deployment(fallback="from-agent-yaml") == "injected-by-the-platform"


def test_the_azure_yaml_variable_is_the_fallback(monkeypatch):
    """The `azure.yaml` reference forbids declaring FOUNDRY_-prefixed variables in `env`, while the
    LangGraph guide's code reads FOUNDRY_MODEL_NAME. Reading both is how the container survives
    either doc being the accurate one."""
    monkeypatch.delenv("FOUNDRY_MODEL_NAME", raising=False)
    monkeypatch.setenv("MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME", "from-azure-yaml")

    assert host.model_deployment(fallback="from-agent-yaml") == "from-azure-yaml"


def test_the_agent_definition_is_the_last_word(monkeypatch):
    """Neither variable set is normal for a local run, and the definition already names the model —
    the same value the prompt agent uses, from the same shared file (AC5)."""
    monkeypatch.delenv("FOUNDRY_MODEL_NAME", raising=False)
    monkeypatch.delenv("MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME", raising=False)

    assert host.model_deployment(fallback="from-agent-yaml") == "from-agent-yaml"


def _never_called(*_args):  # pragma: no cover - the assertion is that it is not called
    raise AssertionError("no vault is configured, so nothing should be read")
