# Tasks: Side by side — one question, two agents, two streams

Ordered TDD. Each implement task is preceded by the failing test that drives it.

- [x] **T1 — test**: `useAgentStream` mints ids under a prefix, and the default is today's `turn_N`
      (the collision that would open the wrong payload in the trace panel).
- [x] **T2 — implement**: the prefix, and `firstTokenAt` stamped on the first `text_delta`.
- [x] **T3 — test**: `MetaLine` renders time to first token when there is one, and nothing — not a
      zero — when the turn produced no text (AC4).
- [x] **T4 — implement**: the figure, and `Conversation` passing it.
- [x] **T5 — test**: one send reaches both agents, same text, neither waiting on the other; the two
      requests share no conversation id (AC1, AC10).
- [x] **T6 — implement**: `useComparison` — the two streams, the second agent, send and stop.
- [x] **T7 — test**: each column renders only its own events, its own activity inline, its own
      numbers, and the hosted one's cost caveat (AC2, AC3, AC4, AC5, AC6, AC12).
- [x] **T8 — implement**: `Compare` — the picker, two `Conversation` columns, one `Composer`; the
      route and the rail item.
- [x] **T9 — test**: one column fails and the other finishes; stop settles both (AC8, AC9).
- [x] **T10 — test**: each column's trace link opens that run's spans (AC7).
- [x] **T11 — implement**: whatever T9 and T10 find in `App`'s trace wiring.
- [x] **T12 — test**: two agents of the same kind compare; voice is refused with a reason; leaving
      returns the chat intact (AC11, AC13, AC14).
- [x] **T13 — i18n + styles**: the strings in `en`/`pt`; the grid in tokens only.
- [x] **T14 — a11y**: the compare screen joins `a11y.test.tsx`'s walk.
- [x] **T15 — docs**: `/compare` stops being reserved; `harness-comparison.md` gains the section and
      records the dated samples; `REFERENCES.md` records AC16's historical closure (2026-09-20).
- [x] **T16 — spec**: status `planned → done`; AC16 closed by the later recorded live run on 2026-09-20.

## Definition of done

- [x] Every acceptance criterion maps to a passing test or recorded live evidence
      (AC16 met 2026-09-20; recorded in `docs/REFERENCES.md`)
- [x] Lint clean · Tests green · `verify-gates` green (historical implementation checks, not rerun
      by the documentation reconciliation)
