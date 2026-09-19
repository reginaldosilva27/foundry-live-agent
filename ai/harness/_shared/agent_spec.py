"""Loader and validator for `agent.yaml` — the agent definition as code.

**This schema is ours, not Foundry's.** Foundry's own `agent.yaml` (AgentSchema) is deprecated,
superseded by `azure.yaml` for *hosted* agents — which is not a prompt-agent format. Rather than
teach a retired schema or invent a hosted-agent file for an agent that isn't hosted, this is a small
declared format of our own, marked `schema_version: foundry-live-agent/v1` so nobody mistakes it for
a Microsoft one. See `docs/harness-comparison.md`.

`extends:` (spec 018) is the other thing this loader does. Two harnesses that must answer
identically cannot each carry their own copy of the model, the instructions and the tool list — that
is the drift §4 forbids, and "a reviewer will notice" is not a control. So the shared half lives in
`_shared/agent_core.yaml` and each harness's `agent.yaml` names it. The merge is deliberately dull:
one key, shallow, the local file wins, no per-list overriding. Anything cleverer would be a second
schema pretending to be a convenience.

The validation that earns its keep is the registry cross-check: a definition naming a function tool
nobody implements is rejected **at load time**. Without it, that mistake reaches production as an
agent that emits a call the BFF cannot answer — and an unanswered call hangs the run for ten minutes
while looking, from the browser, like the stream just stopped.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from harness._shared.tools import registry

__all__ = ["AgentSpec", "AgentSpecError", "FunctionToolSpec", "McpToolSpec", "load_agent_spec"]

SCHEMA_VERSION = "foundry-live-agent/v1"
_REQUIRED = ("schema_version", "name", "model", "instructions", "tools")

# Observed 2026-09-15: Foundry rejects `reasoning` on the request with 400 invalid_payload,
# "Not allowed when agent is specified" — so it belongs to the definition or nowhere.
_REASONING_KEYS = ("summary", "effort", "mode", "context")
_SUMMARY_VALUES = ("auto", "concise", "detailed")

# The sandbox a hosted agent runs in (spec 018, AC11). Validated rather than passed through for
# the same reason `reasoning` is: a size Foundry does not offer fails at deploy time, long after
# the typo, and the three documented sizes are a closed set.
_HOSTED_KEYS = ("protocol", "cpu", "memory_gib", "idle_timeout_minutes")
_PROTOCOLS = ("responses", "invocations")
_SANDBOX_SIZES = ((0.5, 1), (1, 2), (2, 4))
_IDLE_RANGE = (2, 60)


class AgentSpecError(ValueError):
    """The agent definition is malformed or refers to something that doesn't exist."""


@dataclass(frozen=True)
class FunctionToolSpec:
    """A tool Foundry asks us to run. Schema and description come from the registry."""

    name: str
    description: str
    schema: dict[str, Any]


@dataclass(frozen=True)
class McpToolSpec:
    """A remote MCP server Foundry calls itself."""

    name: str
    server_url: str
    require_approval: str = "never"
    allowed_tools: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ExampleQuestion:
    """A question this agent is worth asking (spec 037).

    Bilingual in the definition itself, because the app is bilingual and so is the agent: a
    suggestion that only existed in English would be an English-only string shipped through a side
    door (§7). Nothing generates these — the app never asks a model what to ask it (§8).
    """

    en: str
    pt: str

    def as_dict(self) -> dict[str, str]:
        return {"en": self.en, "pt": self.pt}


@dataclass(frozen=True)
class AgentSpec:
    """A validated agent definition."""

    name: str
    model: str
    instructions: str
    function_tools: list[FunctionToolSpec]
    mcp_tools: list[McpToolSpec]
    description: str = ""
    reasoning: dict[str, str] | None = None
    # Present only for a harness Foundry runs as a container. `None` means "not applicable",
    # which is a different statement from an empty block meaning "unset".
    hosted: dict[str, Any] | None = None
    #: What this agent is worth being asked. Empty for an agent we did not write (spec 037).
    examples: list[ExampleQuestion] = field(default_factory=list)

    @property
    def uses_gateway(self) -> bool:
        """True when the model routes through a bring-your-own-model connection.

        A plain model name means the agent talks to a normal Foundry deployment and **bypasses the
        gateway** — easy to do by accident, and invisible unless something says so.
        """
        return "/" in self.model


def _read(path: Path) -> dict[str, Any]:
    """One YAML file as a mapping, or a typed error naming the file."""
    try:
        raw = yaml.safe_load(path.read_text())
    except FileNotFoundError:
        raise AgentSpecError(f"no agent definition at {path}") from None
    except yaml.YAMLError as exc:
        raise AgentSpecError(f"{path} is not valid YAML: {exc}") from None

    if not isinstance(raw, dict):
        raise AgentSpecError(f"{path} must contain a mapping at the top level")
    return raw


def _resolve(path: Path, seen: list[Path]) -> dict[str, Any]:
    """Read ``path`` and merge whatever it ``extends:`` underneath it.

    The target is relative to the file that names it, not to the working directory: `just agent`
    runs from `ai/`, a test runs from wherever pytest was invoked, and a path that means two things
    is worse than no path at all.
    """
    resolved = path.resolve()
    if resolved in seen:
        chain = " -> ".join(p.name for p in [*seen, resolved])
        raise AgentSpecError(f"extends cycle: {chain}")

    raw = _read(path)
    parent = raw.pop("extends", None)
    if parent is None:
        return raw

    if not isinstance(parent, str):
        raise AgentSpecError(f"{path}: 'extends' must be a path, got {type(parent).__name__}")

    base = _resolve((path.parent / parent).resolve(), [*seen, resolved])
    # Shallow, and the local file wins. A key the child does not mention comes from the base.
    return {**base, **raw}


def load_agent_spec(path: Path | str) -> AgentSpec:
    """Load and validate an agent definition, or raise :class:`AgentSpecError`."""
    path = Path(path)
    raw = _resolve(path, seen=[])

    missing = [key for key in _REQUIRED if key not in raw]
    if missing:
        raise AgentSpecError(f"{path} is missing required field(s): {', '.join(missing)}")

    if raw["schema_version"] != SCHEMA_VERSION:
        raise AgentSpecError(
            f"{path}: unsupported schema_version {raw['schema_version']!r}; "
            f"this loader understands {SCHEMA_VERSION!r}"
        )

    function_tools: list[FunctionToolSpec] = []
    mcp_tools: list[McpToolSpec] = []

    for index, entry in enumerate(raw["tools"] or []):
        where = f"{path}: tools[{index}]"
        if not isinstance(entry, dict) or "type" not in entry or "name" not in entry:
            raise AgentSpecError(f"{where} must be a mapping with 'type' and 'name'")

        kind, name = entry["type"], entry["name"]
        if kind == "function":
            try:
                spec = registry.get(name)
            except registry.UnknownToolError as exc:
                raise AgentSpecError(
                    f"{where}: declares function tool {name!r}, which no implementation "
                    f"answers to. {exc}"
                ) from None
            function_tools.append(
                FunctionToolSpec(name=spec.name, description=spec.description, schema=spec.schema)
            )
        elif kind == "mcp":
            if not entry.get("server_url"):
                raise AgentSpecError(f"{where}: MCP tool {name!r} needs a 'server_url'")
            mcp_tools.append(
                McpToolSpec(
                    name=name,
                    server_url=entry["server_url"],
                    require_approval=entry.get("require_approval", "never"),
                    allowed_tools=list(entry.get("allowed_tools") or []),
                )
            )
        else:
            raise AgentSpecError(
                f"{where}: unknown tool type {kind!r}; expected 'function' or 'mcp'"
            )

    return AgentSpec(
        name=raw["name"],
        model=raw["model"],
        instructions=raw["instructions"],
        description=raw.get("description", ""),
        function_tools=function_tools,
        mcp_tools=mcp_tools,
        reasoning=_reasoning(raw.get("reasoning"), path),
        hosted=_hosted(raw.get("hosted"), path),
        examples=_examples(raw.get("examples"), path),
    )


def _examples(raw: Any, path: Path) -> list[ExampleQuestion]:
    """Validate the optional `examples:` block (spec 037).

    Worth validating rather than passing through, for the same reason `reasoning` is: a malformed
    entry would not fail until it reached a screen, as a blank chip nobody can explain. And a
    missing `pt` is not a small thing — it is an English-only string reaching a bilingual UI
    through a side door (§7).

    Absent means the agent offers none, which is a fact and not an error: every agent in the
    project that this repository did not write is in exactly that position.
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise AgentSpecError(f"{path}: examples must be a list")

    out: list[ExampleQuestion] = []
    for index, entry in enumerate(raw):
        where = f"{path}: examples[{index}]"
        if not isinstance(entry, dict):
            raise AgentSpecError(f"{where} must be a mapping with 'en' and 'pt'")
        missing = [lang for lang in ("en", "pt") if not str(entry.get(lang) or "").strip()]
        if missing:
            raise AgentSpecError(f"{where} is missing {' and '.join(missing)}")
        out.append(ExampleQuestion(en=str(entry["en"]).strip(), pt=str(entry["pt"]).strip()))
    return out


def _reasoning(raw: Any, path: Path) -> dict[str, str] | None:
    """Validate the optional `reasoning:` block.

    Worth validating rather than passing through: a summary value Foundry does not accept fails at
    `create_version` time, long after the typo, and the symptom — an activity panel whose reasoning
    card never fills — reads as a missing feature rather than a rejected field.
    """
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise AgentSpecError(f"{path}: 'reasoning' must be a mapping")

    unknown = [key for key in raw if key not in _REASONING_KEYS]
    if unknown:
        raise AgentSpecError(
            f"{path}: unknown reasoning field(s) {', '.join(sorted(unknown))}; "
            f"expected any of {', '.join(_REASONING_KEYS)}"
        )

    summary = raw.get("summary")
    if summary is not None and summary not in _SUMMARY_VALUES:
        raise AgentSpecError(
            f"{path}: reasoning.summary is {summary!r}; "
            f"Foundry accepts {', '.join(_SUMMARY_VALUES)}"
        )

    return {key: str(value) for key, value in raw.items()}


def _hosted(raw: Any, path: Path) -> dict[str, Any] | None:
    """Validate the optional `hosted:` block — the sandbox a container agent runs in.

    Every value here is stated in this one file and generated into `azure.yaml` from it (§4), so a
    value that Foundry will reject must be caught at load time rather than at `azd deploy`, where
    the error arrives minutes later and names a generated file nobody wrote by hand.
    """
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise AgentSpecError(f"{path}: 'hosted' must be a mapping")

    missing = [key for key in _HOSTED_KEYS if key not in raw]
    if missing:
        raise AgentSpecError(f"{path}: 'hosted' is missing {', '.join(missing)}")
    unknown = [key for key in raw if key not in _HOSTED_KEYS]
    if unknown:
        raise AgentSpecError(
            f"{path}: unknown hosted field(s) {', '.join(sorted(unknown))}; "
            f"expected any of {', '.join(_HOSTED_KEYS)}"
        )

    if raw["protocol"] not in _PROTOCOLS:
        raise AgentSpecError(
            f"{path}: hosted.protocol is {raw['protocol']!r}; expected {' or '.join(_PROTOCOLS)}"
        )

    size = (raw["cpu"], raw["memory_gib"])
    if size not in _SANDBOX_SIZES:
        offered = ", ".join(f"{cpu} vCPU / {mem} GiB" for cpu, mem in _SANDBOX_SIZES)
        raise AgentSpecError(
            f"{path}: hosted sandbox {size[0]} vCPU / {size[1]} GiB is not one of the sizes "
            f"Foundry offers ({offered})"
        )

    low, high = _IDLE_RANGE
    if not low <= raw["idle_timeout_minutes"] <= high:
        raise AgentSpecError(
            f"{path}: hosted.idle_timeout_minutes is {raw['idle_timeout_minutes']}; "
            f"Foundry accepts {low}-{high}"
        )

    return dict(raw)
