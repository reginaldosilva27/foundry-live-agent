# Tasks: 066-turn-flow

> The work, ordered, as a TDD checklist. Each implementation task is preceded by the
> test that should fail first (red → green → refactor). Check boxes as you go.

## Tasks

- [x] **T1 — test first**: `state/flow.test.ts` — AC1, AC2, AC3, AC7 (typed hops, app round trip,
      Foundry-side calls, nothing unmeasured numbered)
- [x] **T2 — implement**: `buildFlow` for typed turns
- [x] **T3 — test first**: `flow.test.ts` — AC4 (`gatewayState`), AC5/AC6 (model and tool
      durations from spans), AC9 (harness)
- [x] **T4 — implement**: `gatewayState`, `toolSpanDuration`, model durations, measurement state
- [x] **T5 — test first**: `flow.test.ts` — AC8 (spoken path) and AC10 (failed, stopped);
      `voiceLog.test.ts` — `isSpokenTurn`
- [x] **T6 — implement**: spoken hops, unfinished turns, `isSpokenTurn`
- [x] **T7 — test first**: `flow.test.ts` — AC17 (`layoutFlow` horizontal and vertical)
- [x] **T8 — implement**: `layoutFlow`
- [x] **T9 — test first**: `route.test.ts` — the flow address round-trips (AC13)
- [x] **T10 — implement**: `route.ts`
- [x] **T11 — test first**: `TurnFlow.test.tsx` — AC5 (notes, retry), AC8 (spoken notes), AC9,
      AC11 (stepping, play, pause), AC14, AC16
- [x] **T12 — implement**: `TurnFlow.tsx`, `FlowIcon`, `flow.*` strings (en + pt)
- [x] **T13 — test first**: `AnswerActions.test.tsx`, `TraceDrawer.test.tsx` — the doors (AC13)
- [x] **T14 — implement**: `onOpenFlow` in `AnswerActions`, `Conversation`, `TraceDrawer`
- [x] **T15 — test first**: `App.routing.test.tsx` — AC13 (opens from a turn; address), AC15,
      AC20
- [x] **T16 — implement**: `App.tsx` wiring
- [x] **T17 — test first**: `layout.test.ts` — AC12, AC17, AC18; `a11y.test.tsx` — AC16
- [x] **T18 — implement**: `.flow*` styles
- [x] **T19 — e2e**: open a replayed turn's flow in the demo; 320px without overflow
- [x] **T20 — docs**: `CLAUDE.md` ↔ `AGENTS.md` (§6), `docs/how-it-works/tracing-and-gateway.md`,
      `CHANGELOG.md`, `specs/README.md`
- [ ] **T21 — refactor + gates**: `verify-gates` — every gate this change touches is green; two
      **pre-existing** security gates are red on `main` and block *done*: `npm audit` (vite
      8.3.0–8.3.2, high — Dependabot PR #73 bumps it) and `pip-audit` (28 findings in aiohttp,
      certifi, filelock, langgraph-sdk; possibly a stale venv)

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] All new user-facing text exists in en **and** pt
- [ ] `spec.md` status updated to `done` (after T21)
