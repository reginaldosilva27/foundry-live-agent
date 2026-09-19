# Tasks: The shape of a turn — a measured timeline

> Each implementation task is preceded by the test that should fail first.

## Tasks

### The layout, pure — `state/timeline.ts`

- [x] **T1 — test**: the root span becomes the extent; its descendants become segments.
- [x] **T2 — implement**: `layout(spans)`.
- [x] **T3 — test**: each segment's offset/width comes from its own `start_ms`/`duration_ms` (AC2).
- [x] **T4 — test**: spans supplied out of order lay out identically to the same spans in order (AC9).
- [x] **T5 — test**: time inside the root no child covers returns as a `gap` item (AC5).
- [x] **T6 — implement**: gaps, as first-class items rather than background.
- [x] **T7 — test**: `layout` accepts no wall clock, and no source references `startedAt` (AC11).

### The band — `components/Timeline.tsx`

- [x] **T8 — test**: renders an axis and one button per segment, each named with kind and duration
      (AC1, AC10).
- [x] **T9 — implement**: the band.
- [x] **T10 — test**: the legend names run, model, Foundry-executed and unattributed (AC3).
- [x] **T11 — implement**: legend and the gap note.
- [x] **T12 — test**: the round-trip sentence renders once, and not on a single-leg turn (AC4).
- [x] **T13 — implement**: it.
- [x] **T14 — test**: clicking a segment selects the matching call; one with no match selects
      nothing (AC8).
- [x] **T15 — implement**: selection, through the handler the panel already has.

### The panel

- [x] **T16 — test**: `TraceDrawer` — spans → band; no spans → no band, message, retry still there
      (AC6); tracing disabled → no band, no retry, reason once (AC7).
- [x] **T17 — implement**: wire it.

### Closing

- [x] **T18 — i18n**: the new strings, `en` + `pt`.
- [x] **T19 — styles**: `app.css` — the band, the axis, the legend.
- [x] **T20 — docs**: `how-it-works/` gains the picture, and why it is one leg.
- [x] **T21 — verify**: `verify-gates`; flip `spec.md` to `done`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] All new user-facing text exists in en **and** pt
- [x] `spec.md` status updated to `done`
