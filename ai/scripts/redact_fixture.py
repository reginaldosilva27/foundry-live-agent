#!/usr/bin/env python3
"""Redact a raw Foundry capture so it can be committed as a fixture.

    python scripts/redact_fixture.py tests/fixtures/recorded/byom-2026….raw.jsonl

A fixture is a claim about how Foundry behaves, so nothing about the *shape* of the stream may
change here (constitution §5). This rewrites identifiers only:

- the value of an id-bearing **key** (``id``, ``item_id``, ``call_id``, ``response_id``, …) becomes
  a stable, per-file counter that keeps its prefix — the same id maps to the same placeholder, so
  cross-references between events survive;
- ``encrypted_content`` on reasoning items becomes ``"<redacted>"``: it is an opaque blob of model
  state, it is the bulk of the file's size, and nothing reads it.

Redaction is driven by the key, never by the shape of the value. Matching values would rewrite
literals that merely look like ids — ``"type": "mcp_call"`` among them — and silently corrupt the
recording it is supposed to preserve.

Everything else — event order, event types, argument strings, tool output, token counts — is left
exactly as Foundry sent it.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ID_KEYS = frozenset(
    {
        "id",
        "item_id",
        "call_id",
        "response_id",
        "previous_response_id",
        "approval_request_id",
        "prompt_cache_key",
        "safety_identifier",
        # Hosted agents (spec 018). `agent_session_id` identifies the sandbox a turn ran in, and
        # it is the ONLY thing that joins a hosted turn to its spans — the observed spans carry no
        # `gen_ai.response.id` at all. Redacted like any other id so the fixture keeps its
        # cross-references without carrying a real session identifier.
        "agent_session_id",
    }
)


def redact(value: Any, ids: dict[str, str]) -> Any:
    if isinstance(value, dict):
        return {key: _field(key, item, ids) for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item, ids) for item in value]
    return value


def _field(key: str, value: Any, ids: dict[str, str]) -> Any:
    if key == "encrypted_content" and isinstance(value, str):
        return "<redacted>"
    if key in ID_KEYS and isinstance(value, str) and value:
        prefix = value.split("_", 1)[0] if "_" in value else "id"
        return ids.setdefault(value, f"{prefix}_{len(ids):04d}")
    return redact(value, ids)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2

    source = Path(sys.argv[1])
    target = source.with_suffix("").with_suffix(".jsonl")  # drops ".raw"
    ids: dict[str, str] = {}

    lines = [
        json.dumps(redact(json.loads(line), ids))
        for line in source.read_text().splitlines()
        if line.strip()
    ]
    target.write_text("\n".join(lines) + "\n")

    print(f"{len(lines)} events, {len(ids)} identifiers redacted -> {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
