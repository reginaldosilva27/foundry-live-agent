# Tasks: Every turn knows what day it is

> The work, ordered, as a TDD checklist. Each implementation task is preceded by the
> test that should fail first (red → green → refactor). Check boxes as you go.

## Tasks

- [x] **T1 — test first**: AC2 + AC4 — the sentence at a pinned clock; its shape (`ai/tests/test_current_moment.py`)
- [x] **T2 — implement**: `ai/harness/_shared/current_moment.py`
- [x] **T3 — test first**: AC3 — an unknown `AGENT_TIMEZONE` refuses to load
- [x] **T4 — implement**: `Settings.agent_timezone`
- [x] **T5 — test first**: AC1 + AC5 + AC8 — the route's messages; one moment per turn, not per leg
- [x] **T6 — implement**: `turn_messages` in the chat route
- [x] **T7 — test first**: AC7 — two context items when a voice session opens
- [x] **T8 — implement**: `current_moment_frame`; `VoiceSession` takes the timezone
- [x] **T9 — test first**: AC6 — the hosted graph keeps its instructions beside a developer item
- [x] **T10 — implement**: `graph.py`
- [x] **T11 — constitution + docs** (§4, §6, §7): §8 amendment; `CLAUDE.md` ↔ `AGENTS.md`; READMEs; voice
      lifecycle doc; `REFERENCES.md`; `.env.example`; stale "single/spent" comments
- [x] **T12 — gates**: `verify-gates`
- [ ] **T13 — live (owner's go-ahead)**: redeploy the hosted agent, then probe both harnesses and a
      voice call (AC9); record in `docs/REFERENCES.md`

- [ ] **T14 — owner's decision**: the São Paulo time example no longer calls a tool (spec, *Open*);
      move it to another city (and re-record the journey GIFs) or accept it

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test (AC9 is live: text verified
      2026-11-14, hosted and voice pending T13)
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] (If bilingual) all new user-facing text exists in en **and** pt — none added; READMEs mirrored
- [ ] `spec.md` status updated to `done`
