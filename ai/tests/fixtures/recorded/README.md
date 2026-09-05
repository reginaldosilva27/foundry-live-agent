# Recorded fixtures

**This directory is empty on purpose.**

Files here are event streams **recorded from real Foundry runs** — never written by hand. A fixture
is a claim about how Foundry behaves, so a fabricated one is a lie that would then shape the event
normaliser built on top of it (constitution §5).

Spec 001 has no live agent to record, so it records nothing. The synthetic event sequences inside
`tests/test_contract.py` are inline unit-test inputs for our own validator — they assert what
`validate_event` and `check_stream` do, and make no claim about Foundry.

**Real recordings arrive in spec 002**, captured by the spike that also answers:

- **O-1** — the actual stream event names for reasoning summaries and MCP calls.
- **O-8** — whether the Responses API drives a prompt agent whose model sits behind a BYOM gateway.
- **O-9** — whether reasoning summaries survive the `chat/completions` hop to a BYOM model.

## Format

One JSON object per line (JSONL), each a raw Foundry stream event, in arrival order. Redact
`response_id`/`conversation_id` before committing; the `.raw.jsonl` suffix is gitignored for
un-redacted captures.
