"""The current moment, stated to the model as a fact (spec 067, AC2 · AC4).

Motivated by a real turn on 2026-11-14: asked for "o jogo do Brasil", the agent searched with no
date and reported a 2025 results table as the latest, because nothing told it the year. The fix is
one sentence, built here once, sent by the text route and the voice session alike (§4).
"""

import re
from datetime import UTC, datetime

from harness._shared.current_moment import (
    DEFAULT_TIMEZONE,
    current_moment_item,
    current_moment_text,
)
from harness._shared.tools import registry
from harness._shared.voice_events import current_moment_frame, spoken_context_item

# 01:30 UTC on the 15th is still the evening of the 14th in São Paulo — the case a UTC clock gets
# wrong, and the reason the timezone is a deployment setting at all.
LATE_EVENING = datetime(2026, 11, 15, 1, 30, tzinfo=UTC)


def test_the_default_timezone_is_sao_paulo():
    """AC2 — the audience the project was written for, declared rather than inferred."""
    assert DEFAULT_TIMEZONE == "America/Sao_Paulo"


def test_the_moment_is_the_clock_read_in_the_declared_timezone():
    """AC2 — the date that matters is the one the person is living in, not the server's UTC."""
    text = current_moment_text(DEFAULT_TIMEZONE, now=LATE_EVENING)

    assert text == (
        "Current date and time: Saturday, 14 November 2026, 22:30 (America/Sao_Paulo, UTC-03:00)."
    )


def test_another_timezone_reads_the_same_instant_differently():
    """AC2 — the setting is honoured, not decorative."""
    text = current_moment_text("UTC", now=LATE_EVENING)

    assert text == "Current date and time: Sunday, 15 November 2026, 01:30 (UTC, UTC+00:00)."


def test_without_a_pinned_clock_it_reads_the_real_one():
    """AC2 — the parameter exists for tests; production passes nothing and gets now."""
    # Read in UTC on both sides: São Paulo's year lags UTC's for three hours every New Year.
    assert str(datetime.now(UTC).year) in current_moment_text("UTC")


def test_the_moment_is_one_sentence_of_fact():
    """AC4 — constitution §8's second exception holds only while this stays a fact about the world.

    A tool name would be the app choosing a tool; an imperative would be the app prompting. Either
    one turns a timestamp into an instruction, which is exactly what the amendment does not allow.
    """
    text = current_moment_text(DEFAULT_TIMEZONE, now=LATE_EVENING)

    assert re.fullmatch(r"Current date and time: [^.]+\.", text)
    for name in registry.tool_names():
        assert name not in text
    for imperative in ("you", "use ", "call", "search", "always", "never", "must"):
        assert imperative not in text.lower()


def test_the_text_item_is_a_typed_developer_message():
    """AC1/AC4 — the Responses shape, typed.

    Observed 2026-11-14: two input items without `type` are refused —
    `400 invalid_value, param input[1]`, type `''`. With `"type": "message"` on both, accepted.
    `developer` is the role the service took beside `agent_reference`.
    """
    item = current_moment_item(DEFAULT_TIMEZONE, now=LATE_EVENING)

    assert item == {
        "type": "message",
        "role": "developer",
        "content": current_moment_text(DEFAULT_TIMEZONE, now=LATE_EVENING),
    }


def test_the_voice_frame_carries_the_same_sentence_in_spec_017s_shape():
    """AC7 — one sentence, two transports (§4). The frame is the shape the service already accepts
    for the spoken-conversation item, so the only new thing it carries is the text."""
    frame = current_moment_frame(DEFAULT_TIMEZONE, now=LATE_EVENING)

    assert frame["type"] == spoken_context_item()["type"]
    assert frame["item"]["role"] == spoken_context_item()["item"]["role"]
    assert frame["item"]["content"] == [
        {"type": "input_text", "text": current_moment_text(DEFAULT_TIMEZONE, now=LATE_EVENING)}
    ]
