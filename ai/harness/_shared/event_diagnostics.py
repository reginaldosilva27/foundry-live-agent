"""Turn-local, content-free diagnostics. Limits are app policy, not Foundry facts."""

from __future__ import annotations

import logging
import re
from contextlib import suppress
from typing import Literal

MAX_TYPES = 16
MAX_TYPE_LENGTH = 96
MAX_COUNT = 1_000_000
_TYPE_SHAPE = re.compile(r"[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*", re.ASCII)
_LOGGER = logging.getLogger(__name__)


class EventDiagnostics:
    """Retain bounded type spellings privately; log only opaque aliases and counts."""

    def __init__(self, normalizer: Literal["prompt_agent", "langgraph"]) -> None:
        if normalizer not in {"prompt_agent", "langgraph"}:
            raise ValueError("unsupported diagnostic normalizer")
        self._normalizer = normalizer
        self._counts: dict[str, int] = {}
        self._invalid = 0
        self._omitted = 0
        self._saturated = False
        self._flushed = False

    def _increment(self, count: int) -> int:
        if count >= MAX_COUNT:
            self._saturated = True
            return MAX_COUNT
        return count + 1

    def observe(self, raw_type: object) -> None:
        if self._flushed:
            return
        # Check length before regex/hash; never stringify an untrusted value.
        if (
            type(raw_type) is not str
            or not 0 < len(raw_type) <= MAX_TYPE_LENGTH
            or _TYPE_SHAPE.fullmatch(raw_type) is None
        ):
            self._invalid = self._increment(self._invalid)
        elif raw_type in self._counts:
            self._counts[raw_type] = self._increment(self._counts[raw_type])
        elif len(self._counts) < MAX_TYPES:
            self._counts[raw_type] = 1
        else:
            # Occurrences, not distinct types: retaining overflow names would defeat the cap.
            self._omitted = self._increment(self._omitted)

    def flush(self) -> None:
        if self._flushed:
            return
        self._flushed = True
        report = {
            "normalizer": self._normalizer,
            "types": {
                f"unmapped_type_{i}": count
                for i, count in enumerate(self._counts.values(), start=1)
            },
            "invalid_type": self._invalid,
            "omitted_occurrences": self._omitted,
            "truncated": bool(self._omitted or self._saturated),
            "counts_saturated": self._saturated,
        }
        self._counts.clear()
        if not (report["types"] or self._invalid or self._omitted):
            return
        # A logging sink must not change stream cleanup, even if its handler raises.
        with suppress(Exception):
            _LOGGER.warning(
                "unmapped upstream event summary: %s", report, extra={"diagnostic": report}
            )
