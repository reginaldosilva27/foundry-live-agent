# Recorded fixtures

Event streams **recorded from real Foundry runs** — never written by hand. A fixture is a claim
about how Foundry behaves, so a fabricated one is a lie that would then shape the event normaliser
built on top of it (constitution §5).

| File | What it records |
|---|---|
| `prompt-agent-turn-20260915.jsonl` | 310 events. One whole turn with reasoning summaries, two function calls the app executes, two MCP calls Foundry executes, streamed answer text, and the function-call round trip. The canonical recording. |
| `prompt-agent-no-reasoning-20260915.jsonl` | 131 events. The same agent, same tools, same probe — with `reasoning` absent from the definition. Kept for the contrast: not one summary event. |
| `prompt-agent-preamble-20260916.jsonl` | 437 events, three legs. The turn spec 016 exists for: asked in Portuguese for Corinthians' last match, the agent **says what it is about to do before it calls a tool** — *"Vou verificar na web e confirmar a data atual para identificar o jogo mais recente."* — then calls `get_current_datetime` and `search_web`. The 2026-09-15 recordings go straight to the tool, which is what makes the pair a before/after. |
| `voice-live-no-urls-20260916.jsonl` | 173 frames, spec 017. A voice turn driven by **real audio** (macOS `say` into `input_audio_buffer.append`, so the user item is speech and gets transcribed) with the session's `role: system` context item. The agent answers the question and **says no URL**. |
| `voice-live-urls-spoken-20260916.jsonl` | 207 frames — **the negative control**, and the reason the pair is worth two files. Same agent version, same spoken question, same audio; only the context item removed. The URL is read out loud again. |
| `prompt-agent-written-citations-20260916.jsonl` | 360 events. The same question in the text path on the same agent version, where no context item is sent: the written answer still cites `https://…`. Proves spec 017 made citations conditional rather than deleting them. |
| `voice-live-preamble-20260916.jsonl` | 86 control-channel frames. The same probe over Voice Live: `session.updated` negotiating **`pt-BR-Thalita:DragonHDLatestNeural`** with `modalities ["audio","text"]`, the spoken preamble as `response.audio_transcript.delta` (*"Vou verificar isso na internet agora."*), `response.audio.delta` frames proving the HD voice actually rendered, and only then `response.function_call_arguments.done`. |

Both were captured on **2026-09-15** against project `ai-admin2354ai223634534-project` (resource
`ai-admin2354ai223634534338`, eastus2) on model `gpt-5.5`, by `ai/scripts/spike.py` and a follow-up
reasoning probe. The findings they answer — O-1, O-3, O-8, O-9 — are written up in
[`docs/REFERENCES.md`](../../../../docs/REFERENCES.md).

The two **`…-preamble-20260916`** recordings were taken the same day against the same project, on
agent version **6** — the first version carrying spec 016's narration rule. Both were captured by
one-off scripts rather than `spike.py`, because they had to talk to the *shipped* agent by
`agent_reference` (text) and by `agent_name` + `agent_project_name` (voice) rather than to a
throwaway spike agent. Re-record by asking the shipped agent anything that needs a tool.

**One edit was made to the voice recording, and it is the only one**: the base64 payload of each
`response.audio.delta` was blanked to `""`. The frames are kept where they happened — their
presence is the evidence that the HD voice produced audio — but 6 frames of PCM do not belong in
git. Nothing else was touched: no frame removed, no order changed, no field rewritten beyond the
identifier redaction every fixture here gets.

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

