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

## `appinsights-spans-20260916.jsonl`

Eight spans read back out of Application Insights
`ai-admin2354ai223634534-project-appinsights-2442` on **2026-09-16**, after two runs fired through
the BFF against agent version `foundry-live-agent:3`. One row per span, as the
`dependencies` table returns it.

Three traces, chosen because together they cover the cases spec 005 has to render:

| `operation_Id` | Spans | Why it is here |
|---|---|---|
| `6691317d…` | `invoke_agent`, `chat` | First leg of a function-call round trip |
| `7188bc6e…` | `invoke_agent`, `chat` | **Second leg of the same turn** — a different trace id |
| `2aa77039…` | `invoke_agent`, `execute_tool` ×2, `chat` | An MCP turn: Foundry-side tools *do* get spans |

**Scrubbed**, and what that removed: the subscription id (replaced with `<subscription-id>`), the
`_MS.*` internal pointers, and the four content-bearing attributes — `gen_ai.input.messages`,
`gen_ai.output.messages`, `gen_ai.tool.definitions` and
`microsoft.foundry.content_filter.results` — which carry whole conversations. Every attribute *name*
that matters is kept, because the names are what the code reads.

The recording script is not committed: this was `az monitor app-insights query` against the
`dependencies` table plus the scrub above. Re-record by firing a turn and querying the same table —
never by editing this file to make a test pass (§5).

