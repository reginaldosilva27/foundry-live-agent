# Tasks: Where an answer came from

> Each implementation task is preceded by the test that should fail first.

## Phase 1 — reading the payloads (AC1 · AC2 · AC5 · AC9 · AC11 · AC12)

- [x] **T1 — test**: the **recorded** Learn payload yields its `contentUrl`s, and no link that
      appears only inside `content`.
- [x] **T2 — implement**: `state/sources.ts` with the successive-JSON decoder and the Learn reader.
- [x] **T3 — test**: a `search_web` payload yields `url` per result; an errored one yields a failed
      row distinct from none.
- [x] **T4 — test**: a `lookup_knowledge` payload yields passages named by `source`, with no `url`.
- [x] **T5 — implement**: the other two readers.
- [x] **T6 — test**: the same URL from two calls appears once, bound to the first (AC9).
- [x] **T7 — test (guard)**: `sources.ts` never reads the answer text (AC6).

## Phase 2 — the strip (AC3 · AC4 · AC7 · AC10)

- [x] **T8 — test**: a settled turn renders the strip; a streaming one renders nothing.
- [x] **T9 — test**: selecting a source opens the producing call; a passage is not a link.
- [x] **T10 — test**: rendering issues no request.
- [x] **T11 — implement**: `components/Sources.tsx` and its place in `MessageBubble`.

## Phase 3 — the record (AC8 · AC13)

- [x] **T12 — test**: the Markdown export carries the sources.
- [x] **T13 — implement**: the export section.
- [x] **T14 — i18n**, **T15 — styles**, **T16 — docs**, **T17 — refactor**.
- [x] **T18 — spec**: flip to `done`.

## Definition of done

- [x] Every acceptance criterion maps to a passing test
- [x] Lint clean · Tests green · `verify-gates` green
