"""Execute the function tools Foundry asks for.

**This module executes; it never chooses.** Foundry picked the name and the arguments; the code here
resolves the name through the registry and calls it. There is no branching on tool names, no list of
tools, and no per-tool special case — constitution §8, enforced by a test that reads this package's
source for tool-name literals.

Everything is caught. A tool that raises, a name nobody implements, arguments that are not JSON,
arguments with the wrong keys — all four produce an :class:`ExecutionResult` carrying an error
rather than propagating. That is not defensive habit: an exception escaping here would abandon a
function call the agent is waiting on, and Foundry waits until the run expires ten minutes later.
The browser sees a stream that just stops.

Answering with an error is strictly better than not answering. The agent can say what failed.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass

from harness._shared.tools import registry

__all__ = ["ExecutionResult", "execute"]


@dataclass(frozen=True)
class ExecutionResult:
    """The outcome of one tool call. ``output`` is always a JSON string, always safe to submit."""

    name: str
    output: str
    duration_ms: int
    ok: bool
    error: str | None = None


def _failure(name: str, code: str, message: str, started: float) -> ExecutionResult:
    return ExecutionResult(
        name=name,
        output=json.dumps({"error": code, "message": message}),
        duration_ms=int((time.perf_counter() - started) * 1000),
        ok=False,
        error=message,
    )


def execute(name: str, arguments: str) -> ExecutionResult:
    """Run the tool called ``name`` with the JSON string ``arguments``.

    Never raises. Every failure mode comes back as a result whose ``output`` can be submitted to the
    agent as a ``function_call_output``.
    """
    started = time.perf_counter()

    try:
        spec = registry.get(name)
    except registry.UnknownToolError as exc:
        return _failure(name, "unknown_tool", str(exc), started)

    try:
        parsed = json.loads(arguments or "{}")
    except json.JSONDecodeError as exc:
        return _failure(name, "invalid_arguments", f"arguments were not valid JSON: {exc}", started)

    if not isinstance(parsed, dict):
        return _failure(
            name,
            "invalid_arguments",
            f"arguments must be a JSON object, got {type(parsed).__name__}",
            started,
        )

    try:
        result = spec.call(**parsed)
    except TypeError as exc:
        # Wrong or missing keyword arguments — the model built a call the schema does not fit.
        return _failure(name, "invalid_arguments", f"{name}({arguments}) rejected: {exc}", started)
    except Exception as exc:  # noqa: BLE001 - see module docstring: nothing may escape
        return _failure(name, "tool_failed", f"{type(exc).__name__}: {exc}", started)

    return ExecutionResult(
        name=name,
        output=json.dumps(result, ensure_ascii=False, default=str),
        duration_ms=int((time.perf_counter() - started) * 1000),
        ok=True,
    )
