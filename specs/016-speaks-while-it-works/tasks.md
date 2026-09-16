# Tasks: The agent speaks while it works — and sounds better doing it

> Red → green → refactor. The two halves are independent: the voice default (T6–T9) can land
> without the narration, and vice versa. The live captures (T10–T12) are what make either honest.

## Tasks

### The preamble — the agent definition

- [x] **T1 — test first (AC1)**: `test_the_shipped_agent_narrates_before_a_tool_call` in
      `ai/tests/test_agent_spec.py` — fails against today's definition.
- [x] **T2 — test first (AC2)**: `test_the_narration_rule_stays_out_of_jargon_and_off_repeat` —
      the rule asks for no tool identifiers and does not demand a line per call.
- [x] **T3 — implement**: add the rule to `instructions:` in
      `ai/harness/prompt_agent/agent.yaml`; T1 and T2 go green.
- [ ] **T4 — apply**: `just agent` — a new immutable agent version. Record the version number; the
      behavior does not exist in Foundry until this runs.

### The voice — one configuration default

- [x] **T5 — test first (AC5)**: extend the session-config test in `backend/tests/test_voice.py` to
      assert the HD voice name and `azure-standard`.
- [x] **T6 — test first (AC6)**: `test_the_documented_default_voice_matches_the_code_default` —
      reads `.env.example`, compares with `Settings`; fails while they disagree.
- [x] **T7 — implement**: change the default in `backend/app/settings.py` (both statements of it)
      and in `.env.example`, keeping the Flash voice listed as the documented way back with its
      latency trade. T5, T6 green.
- [x] **T8 — docs in the same change (§4)**: `docs/how-it-works/voice-live-lifecycle.md` sample
      frame + log line; the dated amendment under spec 012's "Clarified decisions".

### The evidence (§5, §10) — nothing above is done without this

- [ ] **T9 — record (AC3)**: a live text turn that calls a tool, via `ai/scripts/spike.py`;
      redact with `ai/scripts/redact_fixture.py`; commit as
      `prompt-agent-preamble-YYYYMMDD.jsonl` and add its row to the fixtures README.
- [ ] **T10 — test (AC3)**: replay it in `ai/tests/test_recorded_turn.py` — a `text_delta` precedes
      the turn's first `tool_call`. **If it does not, stop**: revert T3, record the finding in the
      spec, and say so plainly. Do not edit the fixture.
- [ ] **T11 — record + test (AC4)**: the same over the Voice Live control channel, the way
      `voice-live-tool-call-20260915.jsonl` was taken; assert the ordering in
      `ai/tests/test_voice_events.py`.
- [ ] **T12 — verify live (AC7)**: start a real voice session with the HD voice; confirm
      `session.created`/`session.updated` echoes `pt-BR-Thalita:DragonHDLatestNeural` **and that it
      is audible**; record both in `docs/REFERENCES.md` with the date. If it is accepted but mute or
      not served in `eastus2`, revert T7 and record that instead.
- [ ] **T13 — listen (the point of all this)**: one spoken turn that calls `search_web`, in
      Portuguese. Does the agent speak before it goes quiet? Does the HD voice sound better than
      Flash? Both answers go in the spec as observations with a date.

### Closing

- [ ] **T14 — AC8**: `just verify` — every existing suite unchanged and green.
- [ ] **T15 — bookkeeping**: `CHANGELOG.md`, the `specs/README.md` index row, spec status → `done`.

## Definition of done

- [ ] Every acceptance criterion in `spec.md` maps to a passing test, or — for AC7 and the live
      halves of AC3/AC4 — to a dated observation recorded in `docs/REFERENCES.md`
- [ ] Lint clean
- [ ] Tests green
- [ ] Type-check / build passes
- [ ] Docs updated in the same change; the default voice states the same value in all four places (§4)
- [ ] (Bilingual) n/a — no new UI string; the preamble is the model's, in the user's language
- [ ] The agent version applied by T4 is recorded, so the behavior is reproducible
- [ ] `spec.md` status updated to `done`
