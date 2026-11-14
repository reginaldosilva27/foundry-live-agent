"""The current moment, stated to the model as a fact (spec 067).

**Why the app says anything at all.** The model cannot see a clock. On 2026-11-14, asked for "o jogo
do Brasil", the agent searched with no date and reported a 2025 results table as the latest — it did
not know the year. The agent definition already told it to call `get_current_datetime` rather than
guess, and it did not: an instruction that depends on the model noticing what it does not know is
conditioned on the very thing it cannot see. With this sentence beside the question, measured the
same day, it answered "que dia é hoje?" with no tool call and searched with today's date.

**Why this is not the app prompting the agent** (constitution §8, second bounded exception): it is
one sentence of *fact about the world* — date, time, timezone, and nothing else — read from the
server clock in a timezone the deployment declares. It names no tool, gives no instruction, carries
nothing the person or the model said, and is equally true whichever harness answers. The tests
assert each of those, because the day this sentence grows an imperative it becomes a prompt.

One function builds the text; the text route and the voice session both send it (§4).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

__all__ = ["DEFAULT_TIMEZONE", "current_moment_item", "current_moment_text"]

# The audience this project was written for. A deployment elsewhere sets AGENT_TIMEZONE.
DEFAULT_TIMEZONE = "America/Sao_Paulo"

# Spelled out rather than `%A`/`%B`, which follow the process locale: a container started with a
# Portuguese locale would otherwise change the sentence the tests pin.
_DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_MONTHS = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)


def current_moment_text(timezone: str, now: datetime | None = None) -> str:
    """``Current date and time: Saturday, 14 November 2026, 22:30 (America/Sao_Paulo, UTC-03:00).``

    ``now`` is for tests; production passes nothing and reads the clock. ``timezone`` must already
    be valid — the settings refuse an unknown one at startup, not on the first turn.
    """
    local = (now or datetime.now(UTC)).astimezone(ZoneInfo(timezone))
    offset = local.strftime("%z") or "+0000"
    return (
        f"Current date and time: {_DAYS[local.weekday()]}, {local.day:02d} "
        f"{_MONTHS[local.month - 1]} {local.year}, {local:%H:%M} "
        f"({timezone}, UTC{offset[:3]}:{offset[3:]})."
    )


def current_moment_item(timezone: str, now: datetime | None = None) -> dict[str, Any]:
    """The sentence as a Responses input item, sent ahead of the person's message.

    `developer` is the role the service accepted beside `agent_reference` (observed 2026-11-14).
    The ``type`` is not optional decoration: two untyped items are refused, see
    `docs/REFERENCES.md`.
    """
    return {"type": "message", "role": "developer", "content": current_moment_text(timezone, now)}
