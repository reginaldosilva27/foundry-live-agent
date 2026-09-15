# Recorded fixtures

Event streams **recorded from real Foundry runs** — never written by hand. A fixture is a claim
about how Foundry behaves, so a fabricated one is a lie that would then shape the event normaliser
built on top of it (constitution §5).

| File | What it records |
|---|---|
| `prompt-agent-turn-20260915.jsonl` | 310 events. One whole turn with reasoning summaries, two function calls the app executes, two MCP calls Foundry executes, streamed answer text, and the function-call round trip. The canonical recording. |
| `prompt-agent-no-reasoning-20260915.jsonl` | 131 events. The same agent, same tools, same probe — with `reasoning` absent from the definition. Kept for the contrast: not one summary event. |

Both were captured on **2026-09-15** against project `ai-admin2354ai223634534-project` (resource
`ai-admin2354ai223634534338`, eastus2) on model `gpt-5.5`, by `ai/scripts/spike.py` and a follow-up
reasoning probe. The findings they answer — O-1, O-3, O-8, O-9 — are written up in
[`docs/REFERENCES.md`](../../../../docs/REFERENCES.md).

The synthetic event sequences inside `tests/test_events.py` are a different thing: inline unit-test
inputs for our own validator. They assert what `validate_event` and `check_stream` do, and make no
claim about Foundry.

## Recording another one

```bash
python scripts/spike.py                                   # writes …raw.jsonl (gitignored)
python scripts/redact_fixture.py tests/fixtures/recorded/<file>.raw.jsonl
```

## Format

One JSON object per line (JSONL), each a raw Foundry stream event, in arrival order.
`redact_fixture.py` rewrites identifiers — `id`, `item_id`, `call_id`, `response_id` and friends —
to stable per-file counters that keep their prefix, so cross-references between events survive, and
blanks the opaque `encrypted_content` blob on reasoning items. Nothing else is touched: event order,
event types, arguments, tool output and token counts are exactly what Foundry sent. The `.raw.jsonl`
suffix is gitignored, so an un-redacted capture cannot be committed by accident.
