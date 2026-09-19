# Plan: The shape of a turn — a measured timeline

> The HOW. Written after `spec.md` is `clarified`.

## Approach

**A pure frontend spec, and a small one, because spec 005 already paid for it.**
`GET /trace/{response_id}` returns `start_ms` and `duration_ms` per span; `types/trace.ts` already
mirrors them. Nothing is queried, computed or stored that does not exist today — the band is a
*projection* of spans the panel has already fetched.

Two modules:

1. **`state/timeline.ts`** — pure. Spans in, a laid-out band out: the extent, the segments with
   their fractional offsets and widths, and the **gaps** between them. Everything the picture needs
   is decided here, so the picture itself is untestable-by-accident rather than untested.
2. **`components/Timeline.tsx`** — draws it, and is a list of buttons rather than an SVG.

**Why buttons and not SVG.** AC8 wants a segment to select the matching call, AC10 wants keyboard
operation and an accessible name per segment. A `<button>` with a percentage width gets focus, keys,
names and hit-testing from the platform; an SVG would need all four rebuilt. The band is a bar
chart, not a drawing, so the DOM is the right medium.

**The gap is computed, never drawn as decoration.** `layout` returns gaps as first-class items with
their own offsets — a segment list with holes in it, not a background showing through. AC5 is then
an assertion about data, and it cannot drift from what is painted.

**Nesting is deliberately flattened.** `invoke_agent` is the root and every other span is inside it,
so drawing them as siblings would stack the whole run on top of itself. The root becomes the
**extent** — the band's total — and only its descendants become segments. That also makes AC5's gaps
meaningful: a gap is time inside the run that no child accounted for.

**Alternative rejected:** laying the spans over the turn's `startedAt`/`endedAt`. It would give a
"real" wall clock including the network, and it would be two clocks on one axis — the drawn-but-not-
measured picture spec 014 refused. AC11 is a test that nobody quietly does it later.

## Affected files

**New**
- `frontend/src/state/timeline.ts` (+ test) — `layout(spans)`.
- `frontend/src/components/Timeline.tsx` (+ test) — the band, the axis, the legend.

**Changed**
- `frontend/src/panes/TraceDrawer.tsx` (+ test) — render the band above the calls; pass the
  round-trip flag and the selection handler it already has.
- `frontend/src/i18n/strings.ts` — new strings, `en` + `pt`.
- `frontend/src/styles/app.css` — the band.
- `docs/how-it-works/streaming-events.md` · `function-call-round-trip.md` — the picture they have
  been describing in words, and why it is one leg.

**Unchanged, deliberately:** `backend/`, `ai/`, the `AgentEvent` set.

## Contract / data model changes (§4)

None. `Span` already carries `start_ms` and `duration_ms`; the layout is derived and stored nowhere.

## i18n strings (§7)

| key | en | pt |
|---|---|---|
| `timeline.title` | Where the time went | Onde o tempo foi |
| `timeline.axisNote` | Measured from the spans of this leg | Medido a partir dos spans desta perna |
| `timeline.legendRun` | the run | a execução |
| `timeline.legendModel` | model | modelo |
| `timeline.legendTool` | executed by Foundry | executado pelo Foundry |
| `timeline.legendGap` | unattributed | não atribuído |
| `timeline.otherLeg` | This turn had a tool round trip. The earlier leg is a separate trace and is not drawn. | Este turno teve um round trip de tool. A perna anterior é outro trace e não está desenhada. |

**Two strings this plan listed and the implementation dropped, both for §4.** `timeline.gapNote`
would have repeated `trace.clientSideNote`, which `SpanTree` already renders a few rows below the
band in the same column — one fact, two spellings. `timeline.needsSpans` would have been a second
sentence beside `trace.spansPending`, which already says the spans have not arrived and already
carries the retry; the band simply does not render, and the existing line serves both (AC6).

## Test strategy (§2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | `layout` returns an extent equal to the root span's duration; the band renders an axis | `state/timeline.test.ts` · `components/Timeline.test.tsx` |
| AC2 | each segment's offset and width come from its own `start_ms`/`duration_ms` | `state/timeline.test.ts` |
| AC3 | segments carry `run`/`model`/`tool`; a legend names them and unattributed | `timeline.test.ts` · `Timeline.test.tsx` |
| AC4 | a turn with a round trip renders the other-leg sentence, once; one without does not | `components/Timeline.test.tsx` |
| AC5 | time inside the root that no child covers comes back as a `gap` item, and renders labelled | `state/timeline.test.ts` · `Timeline.test.tsx` |
| AC6 | no spans → no band, the panel's existing state line says so, retry still offered | `panes/TraceDrawer.test.tsx` |
| AC7 | tracing disabled → no band, no retry, reason stated once | `panes/TraceDrawer.test.tsx` |
| AC8 | clicking a segment marks the matching row in the span list below; a gap is not a button | `components/Timeline.test.tsx` · `panes/TraceDrawer.test.tsx` |
| AC9 | spans supplied **out of order** lay out identically to the same spans in order | `state/timeline.test.ts` |
| AC10 | every segment is a button with an accessible name carrying kind and duration | `components/Timeline.test.tsx` |
| AC11 | `layout` takes no wall-clock argument, and `Timeline.tsx` references no `startedAt` | `state/timeline.test.ts` (source scan) |
| AC12 | every key in `en` + `pt` | `i18n/strings.test.ts` (exists) |

## Risks / trade-offs

- **A one-leg band can be read as the whole turn.** That is what AC4's sentence is for, and it is
  the one thing in this spec that is prose rather than geometry.
- **Sub-millisecond segments vanish at any width.** A segment is given a minimum visible width so a
  1 ms call is not invisible; the *label* still carries the true duration, and the layout returns
  the true fraction — only the paint is clamped, and the test asserts the data is not.
- **Ingestion is staggered** (`docs/REFERENCES.md`): a trace may be incomplete rather than absent, so
  a band drawn from three spans may gain a fourth on retry. The panel's existing `pending`/retry
  handling covers it; the band simply redraws.
