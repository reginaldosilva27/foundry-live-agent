# Plan: A spoken answer does not read URLs out loud

> The HOW. One rule in one file, and two live recordings that decide whether it worked.

## Approach

Spec 016 established the lever and this spec reuses it: the agent definition is the only place that
can change what the agent says, because `instructions` is unsupported on a Voice Live session with
a custom agent and the BFF rewriting the agent's words would be the app speaking for it (§8).

What is new is that the rule must be **conditional**, and the condition is the modality — which
nothing in the session states in words. The bet is that the model can tell: in a spoken session its
input arrives as a transcript of speech and its output is read aloud. The instruction therefore
describes the situation rather than naming a flag ("when you are being listened to rather than
read"), and **the recording decides whether the bet paid**. If it did not, the spec says so and the
choice comes back to the user (drop citations in both, or keep them in both) — no silent guess, no
BFF-side scrubbing as a consolation prize.

The written citation rule is left exactly where it is. The new rule sits next to it and says which
one wins when the answer is spoken, so a reader of the instructions sees both at once.

## Affected files

- `ai/harness/prompt_agent/agent.yaml` — one paragraph: in a spoken conversation, give the answer
  without URLs or a sources block; in a written one, cite as before.
- `ai/tests/test_agent_spec.py` — AC1 and AC2 on the shipped definition.
- `ai/tests/test_voice_events.py` — AC3, AC5, AC6 against a new voice fixture.
- `ai/tests/test_recorded_turn.py` — AC4 against a new text fixture.
- `ai/tests/fixtures/recorded/` + `README.md` — the two recordings and their rows.
- `docs/REFERENCES.md` — the observation, dated, including the answer to the open question; plus
  the two Voice Live facts read today (the cascade, and the DragonHD voice list).
- `docs/how-it-works/voice-live-lifecycle.md` — one paragraph, next to spec 016's.
- `CHANGELOG.md`, `specs/README.md`.

## Contract / data model changes (constitution §4)

None. No event, no schema, no config default. The agent definition is the source of truth and the
applied version number is the record that it is live.

## i18n strings (constitution §7)

n/a — no new UI string.

| key / location | en | pt |
|---|---|---|
| — | — | — |

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | `test_the_shipped_agent_keeps_urls_out_of_speech` | `ai/tests/test_agent_spec.py` |
| AC2 | `test_the_written_citation_rule_survives` | `ai/tests/test_agent_spec.py` |
| AC3 | `test_the_spoken_answer_carries_no_url` — no `http` in the audio transcript of a live turn | `ai/tests/test_voice_events.py` |
| AC4 | `test_the_written_answer_still_cites_its_sources` — the same probe, URLs present | `ai/tests/test_recorded_turn.py` |
| AC5 | `test_the_spoken_answer_still_answers` — the transcript is non-trivial | `ai/tests/test_voice_events.py` |
| AC6 | spec 016's ordering assertion, re-run on the new recording | `ai/tests/test_voice_events.py` |

The recordings are taken with the same one-off scripts spec 016 used — the shipped agent by
`agent_reference` (text) and by `agent_name` + `agent_project_name` (voice) — and redacted with
`ai/scripts/redact_fixture.py`. **Neither is edited to make a test pass** (§5).

## Risks / trade-offs

- **The model may not perceive the modality.** The central risk, and the reason AC3 and AC4 are a
  matched pair rather than one assertion: a rule that drops citations *everywhere* would pass AC3
  and fail AC4, and only running both catches it.
- **A voice turn's links are lost from the chat transcript** (spec 007 carries the spoken words).
  Accepted, and stated in the spec rather than discovered later.
- **Prompt length.** The instructions grow a fourth behavioral rule; each one competes for the
  model's attention with the ones before it. Watched by keeping spec 016's ordering assertion in
  the same recording (AC6) — if the new rule pushes the preamble out, the test says so.
