# Tasks: What a turn cost

> The work, ordered, as a TDD checklist. Each implementation task is preceded by the
> test that should fail first (red → green → refactor). Check boxes as you go.

## Tasks

### The contract learns about cache (§9) — `ai/`

- [ ] **T1 — test**: `ai/tests/test_contract.py` — a `usage` event carrying `cached_input_tokens`
      validates; one carrying a non-int does not.
- [ ] **T2 — implement**: `contract.py` — `Usage.cached_input_tokens: NotRequired[int]` and the
      `_SCHEMA` optional beside it.
- [ ] **T3 — test**: `ai/tests/test_recorded_turn.py` — replaying the **recorded** Foundry turn
      yields `cached_input_tokens: 1024` (the value in the fixture), and the no-cache leg omits the
      field rather than sending `0`.
- [ ] **T4 — implement**: `prompt_agent/events.py` — read `input_tokens_details.cached_tokens`.
- [ ] **T5 — test**: voice events — the recorded Voice Live turn yields the field from
      `input_token_details` (**singular**), which is how that API spells it.
- [ ] **T6 — implement**: `_shared/voice_events.py`.

### The BFF owns the rates — `backend/`

- [ ] **T7 — test**: settings — a well-formed table parses; a malformed one raises `SettingsError`;
      an absent one leaves the rates unset.
- [ ] **T8 — implement**: `settings.py`.
- [ ] **T9 — test**: `GET /config` reports `pricing` when configured and **omits the key entirely**
      when not.
- [ ] **T10 — implement**: `routers/config.py`; `.env.example` placeholders.

### The arithmetic — `frontend/src/state/cost.ts`

- [ ] **T11 — test**: `cost.test.ts` — cached input is a **subset**: `(input − cached) × input rate
      + cached × cached rate`, never `input × rate + cached × cached rate`.
- [ ] **T12 — test**: `cost.test.ts` — a turn with reasoning costs exactly what the same turn's
      `output_tokens` cost; reasoning is never added.
- [ ] **T13 — test**: `cost.test.ts` — no usage → `undefined`; unknown model → `undefined`; a known
      model beside it still prices.
- [ ] **T14 — implement**: `estimateTurn`, `RateTable`, the breakdown it returns.
- [ ] **T15 — test**: `cost.test.ts` — `estimateConversation` sums, and reports how many turns it
      could not price.
- [ ] **T16 — implement**: `estimateConversation`.
- [ ] **T17 — test**: `format.test.ts` — money formats per language, and a sub-cent amount does not
      render as zero.
- [ ] **T18 — implement**: `formatMoney` in `components/format.ts`.

### The surfaces

- [ ] **T19 — test**: `MetaLine.test.tsx` — the figure with its qualifier; nothing at all without
      rates; nothing for a turn with no usage.
- [ ] **T20 — implement**: `MetaLine.tsx`.
- [ ] **T21 — test**: `MetaLine.test.tsx` — a hosted turn renders the container-compute sentence
      once; a prompt-agent turn does not.
- [ ] **T22 — implement**: the qualifier, threaded from the answering agent's harness.
- [ ] **T23 — test**: `TraceNumbers.test.tsx` — the turn figure, the conversation total, the partial
      marker with its count, and the rate breakdown with the recorded date.
- [ ] **T24 — implement**: `TraceNumbers.tsx`.
- [ ] **T25 — implement**: thread `pricing` and the harness through `config.ts`, `App.tsx`,
      `Conversation.tsx`, and `events.ts`/`turn.ts` for the new field.

### The §4 guard and the closing

- [ ] **T26 — test**: `noPriceLiterals.test.ts` — no price literal anywhere under `frontend/src/`.
- [ ] **T27 — i18n**: the new strings, `en` + `pt`; `cost.estimate` declared identical.
- [ ] **T28 — styles**: `app.css` — the breakdown block.
- [ ] **T29 — docs**: `REFERENCES.md` (the reasoning-billing citation, dated),
      `how-it-works/` (the new field), `harness-comparison.md` (what the estimate covers).
- [ ] **T30 — §6**: `CLAUDE.md` ↔ `AGENTS.md`, same commit.
- [ ] **T31 — verify**: run the `verify-gates` skill; flip `spec.md` to `done`.

## Definition of done

- [ ] Every acceptance criterion in `spec.md` maps to a passing test
- [ ] Lint clean
- [ ] Tests green
- [ ] Type-check / build passes
- [ ] Docs updated in the same change; cross-cutting contract in sync (§4)
- [ ] (If bilingual) all new user-facing text exists in en **and** pt
- [ ] `spec.md` status updated to `done`
