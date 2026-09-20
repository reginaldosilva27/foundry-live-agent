"""`GET /tools` and `POST /tools/{name}/run` — the function tools, runnable (spec 042).

**The §8 question deserves an answer rather than a reflex.** "A screen that calls tools" describes
the thing the constitution forbids. The distinction is *who chose*. §8 forbids the **app** choosing
which tool to call — a loop, a heuristic, a re-prompt on model output. A person typing arguments
into a field and pressing run has chosen, exactly as a person choosing which agent answers is
configuration and not a loop (spec 019).

What makes it safe is that it is visibly **outside** the conversation: no `conversation_id` is
created, sent or stored, nothing here reaches a model, and nothing lands in a transcript. Those are
assertions in `test_tool_playground.py`, not intentions.

**It reuses the execution path rather than copying it.** `tool_executor.execute` is the same
function `harness_factory` hands to every adapter, so what runs here is what runs when Foundry asks.
A second implementation would be exactly the §4 failure this project avoided by implementing the
tools once in `ai/harness/_shared/tools/`.

Off by default: an enabled playground is an unauthenticated way to spend a metered third-party key.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Request, Response
from harness._shared.tools import registry
from pydantic import BaseModel

router = APIRouter()


def _enabled(request: Request) -> bool:
    return bool(request.app.state.settings.allow_playground)


@router.get("/tools")
async def tools(request: Request, response: Response) -> dict:
    """The function tools this build can execute — **the registry**, projected.

    Not a list maintained here. The names, descriptions and schemas are the same objects Foundry is
    given at `create_version` time, which is the only way the screen can honestly claim that what
    the reader types is what the model sends.
    """
    if not _enabled(request):
        response.status_code = 403
        return {"tools": [], "error": "playground_disabled"}

    return {
        "tools": [
            {"name": spec.name, "description": spec.description, "schema": spec.schema}
            for spec in registry.specs()
        ],
        "error": None,
    }


class RunRequest(BaseModel):
    """What Foundry sends: a JSON **string**.

    Not a parsed object. The reader is here to understand a function call, and `arguments` arriving
    as text is part of what a function call is — spec 002's contract keeps it a raw string for the
    same reason.
    """

    arguments: str = "{}"


@router.post("/tools/{name}/run")
def run(name: str, body: RunRequest, request: Request, response: Response) -> dict:
    """Run one tool with the given arguments, through the path a real function call takes.

    `def`, not `async def`: `search_web` is an HTTP round trip to a third-party service, and
    running it on the event loop would freeze the app for its duration.

    A failure is rendered as the failure it was. A tool that raised, and a tool that returned
    `search_unavailable` because no key is configured, are different facts and the second one is
    not an error at all — it is the tool's documented answer, and smoothing it into an error box
    would hide the most instructive case this screen has (§5).
    """
    if not _enabled(request):
        response.status_code = 403
        return {"output": "", "duration_ms": 0, "error": "playground_disabled"}

    try:
        spec = registry.get(name)
    except registry.UnknownToolError:
        response.status_code = 404
        return {"output": "", "duration_ms": 0, "error": "unknown_tool"}

    invalid = _validation_error(body.arguments, spec.schema)
    if invalid:
        # Refused before execution: the schema is what Foundry is given, so arguments that would
        # not satisfy it are not a thing the model could have sent.
        response.status_code = 422
        return {"output": "", "duration_ms": 0, "error": invalid}

    from app.tool_executor import execute

    result = execute(name, body.arguments)
    return {
        "output": result.output,
        "duration_ms": result.duration_ms,
        "error": result.error or "",
    }


def _validation_error(arguments: str, schema: dict[str, Any]) -> str:
    """The first reason these arguments do not satisfy the schema, or ``""``.

    `jsonschema` rather than a hand-rolled check: the schema is the document Foundry is given, and
    reading it a second way here would be a second opinion about what the model may send.
    """
    try:
        parsed = json.loads(arguments or "{}")
    except json.JSONDecodeError as exc:
        return f"arguments is not valid JSON: {exc}"

    if not isinstance(parsed, dict):
        return "arguments must be a JSON object"

    import jsonschema

    try:
        jsonschema.validate(parsed, schema)
    except jsonschema.ValidationError as exc:
        return exc.message
    except jsonschema.SchemaError as exc:  # a broken schema is our bug, and says so
        return f"the tool's own schema is invalid: {exc.message}"
    return ""
