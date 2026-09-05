"""`get_current_datetime` — a client-side function tool.

Foundry decides *that* this should be called and with what timezone. This module decides nothing:
it converts an argument into an answer.

Note the return shape. An unknown timezone comes back as a **result** describing the failure, never
as a raised exception. A tool that raises produces a function call nobody answers, and Foundry waits
on an unanswered call until the run expires ten minutes later — a failure that looks, from the
browser, like the stream simply stopped.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

__all__ = ["SCHEMA", "get_current_datetime"]

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "timezone": {
            "type": "string",
            "description": (
                "IANA timezone name, for example 'America/Sao_Paulo', 'Europe/Lisbon' or 'UTC'."
            ),
        }
    },
    "required": ["timezone"],
    "additionalProperties": False,
}


def get_current_datetime(timezone: str) -> dict[str, Any]:
    """Return the current date and time in ``timezone``.

    On success: ``iso``, ``timezone``, ``utc_offset`` and a human-readable ``formatted``.
    On an unrecognised zone: ``error`` and ``message``, so the agent can tell the user and move on.
    """
    try:
        zone = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        return {
            "error": "unknown_timezone",
            "message": (
                f"{timezone!r} is not a recognised IANA timezone. "
                "Expected something like 'America/Sao_Paulo' or 'UTC'."
            ),
        }

    now = datetime.now(zone)
    offset = now.strftime("%z")
    return {
        "iso": now.isoformat(),
        "timezone": timezone,
        "utc_offset": f"{offset[:3]}:{offset[3:]}" if offset else "+00:00",
        "formatted": now.strftime("%A, %d %B %Y, %H:%M"),
    }
