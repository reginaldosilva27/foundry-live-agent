"""Configuration, read once and validated eagerly.

Misconfiguration fails fast with a typed error (constitution §5). A BFF that starts with a missing
endpoint and only fails on the first user message wastes the operator's time and looks like a bug in
the agent rather than in the environment.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

__all__ = ["Settings", "SettingsError", "load_settings"]


class SettingsError(RuntimeError):
    """The environment is not usable."""


@dataclass(frozen=True)
class Settings:
    project_endpoint: str
    project_name: str
    agent_name: str
    model: str
    harness: str
    agent_version: str | None = None

    @property
    def uses_gateway(self) -> bool:
        """A `<connection>/<model>` name routes through the bring-your-own-model gateway.

        A plain name silently bypasses it, which is easy to do by accident — hence surfacing this
        in ``GET /config`` rather than leaving it to be discovered from a billing report.
        """
        return "/" in self.model


def load_settings(**overrides: object) -> Settings:
    """Build settings from the environment, with test overrides."""
    values = {
        "project_endpoint": os.environ.get("FOUNDRY_PROJECT_ENDPOINT", ""),
        "project_name": os.environ.get("FOUNDRY_PROJECT_NAME", ""),
        "agent_name": os.environ.get("AGENT_NAME", "foundry-live-agent"),
        "model": os.environ.get("FOUNDRY_MODEL_DEPLOYMENT", ""),
        "harness": os.environ.get("AGENT_HARNESS", "prompt-agent"),
        "agent_version": os.environ.get("AGENT_VERSION") or None,
    }
    values.update({k: v for k, v in overrides.items() if v is not None})
    return Settings(**values)  # type: ignore[arg-type]


def require_live_settings(settings: Settings) -> None:
    """Check the settings needed to actually reach Foundry. Not called when a stream is injected."""
    missing = [
        name
        for name, value in (
            ("FOUNDRY_PROJECT_ENDPOINT", settings.project_endpoint),
            ("FOUNDRY_MODEL_DEPLOYMENT", settings.model),
        )
        if not value
    ]
    if missing:
        raise SettingsError(
            f"missing required environment variable(s): {', '.join(missing)}. "
            "Copy .env.example to .env and fill it in."
        )
