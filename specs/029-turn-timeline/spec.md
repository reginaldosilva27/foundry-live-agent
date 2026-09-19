# Spec: The shape of a turn — a measured timeline

| | |
|---|---|
| **ID** | 029-turn-timeline |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 · clarified 2026-09-19 |

## Problem / motivation

The most counter-intuitive fact this project has measured is invisible in the app. Spec 015 recorded
it in a comment: a turn with seven tool-calling legs answered every call in about a millisecond and
spent all of its seconds on the model in between. Everyone who watches a tool row appear assumes the
tool is what is slow. It almost never is.

The app currently shows a turn as a vertical stack — tool rows in the order they happened, each with
a duration — and a total latency at the end. From that, the reader can compute where the time went,
and nobody does. The trace panel draws bars under the calls, deliberately without a time axis,
because their lengths are `duration_ms` and nothing else was measured (spec 014).

Now something else has been measured. Application Insights is connected and spans are read back
(spec 005, unblocked 2026-09-16), and a span has a start and an end. That is the missing ingredient:
a real axis, from real timestamps, for the one picture that explains the turn.

## Goals

- **One horizontal band per turn** showing where its time actually went: model, tool execution, the
  second leg of the round trip.
- Every position and every length comes from a **measurement**, never from an arrangement.
- A turn whose spans have not arrived shows **what it has**, and says the axis is not available.

## Non-goals

- **No drawn bars without timestamps.** Spec 014 refused to draw a time axis from durations alone and
  that refusal stands; this spec earns the axis from spans, or renders no axis (§5).
- **No flame graph, no zoom, no pan, no cross-turn timeline.** One turn, one band.
- **No estimation of gaps.** Time not covered by a span is drawn as unattributed, not assigned to
  whichever span is adjacent.
- No change to the `AgentEvent` set (§9).
- **No backend change at all.** `GET /trace/{response_id}` already returns `start_ms` — milliseconds
  after the run's earliest span — and `duration_ms` per span, and `frontend/src/types/trace.ts`
  already mirrors them. This spec is entirely a frontend one.
- **No stitching of the two legs.** A turn with a function-call round trip is **two OTel traces**,
  a separate `operation_Id` and `gen_ai.response.id` per leg (verified 2026-09-16,
  `docs/REFERENCES.md`). Joining them would mean `trace_ids` carrying an id per leg — a §9 change
  that needs its own spec — plus a backend change and a shared axis across two traces whose clocks
  may not align. Out of scope, and the band says so rather than implying it drew the whole turn.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**The band** sits in the trace panel, above the calls it explains. It runs left to right over the
turn's real duration, with the axis labelled in seconds. Each span is a segment, coloured by what it
is — model inference, a function tool this app executed, an MCP call Foundry executed — with the
legend naming the three.

**The band draws the leg the turn holds, and says that is what it is.** A turn with a tool round
trip is two OTel traces; the turn carries the response id of the leg that produced the answer, so
that is the leg with spans. Drawing it while implying it were the whole turn would be the §5 failure
this spec exists to avoid, so a turn whose stream contained a tool round trip carries one sentence
saying the earlier leg is a separate trace.

**The classes are the ones that exist.** A function tool *this app* executes produces **no span** —
Foundry traces what Foundry runs, which is the §8 boundary showing up in telemetry (verified
2026-09-16). So the legend names what the band can actually contain: the run, model inference, and
a call Foundry executed. The app's own tool time appears as **unattributed**, and that is not a
shortcoming of the picture — it is the picture. Spec 015 measured tool calls answering in about a
millisecond while the model spent the seconds, and a band whose gaps are hairlines beside long model
segments is that finding, drawn.

**Unattributed time is drawn as unattributed** — a gap in the band, not a stretched neighbour. When
the spans do not account for the whole leg, that gap is the honest finding, and often the
interesting one.

**The axis is the spans' own extent, not the browser's wall clock.** `start_ms` is measured from the
run's earliest span, and the turn's `startedAt`/`endedAt` are a different machine's clock including
network time. Laying one over the other would produce an axis that is part measurement and part
arithmetic between two clocks, which is precisely the kind of drawn-but-not-measured picture spec
014 refused. The band is labelled with what it is.

**A hosted-harness turn gets no band**, for the same reason it gets no trace today: its spans carry
no `gen_ai.response.id`, so the query resolves to nothing (spec 018). This is stated where the
absence appears, not silently.

**Hovering or focusing a segment** names it and gives its duration, and selecting it brings the
matching call into view in the list below — the panel's existing selection behaviour (spec 010).

**Before the spans arrive**, the band is absent and the panel says the timeline needs the spans,
alongside the retry the panel already offers. Tracing disabled in `GET /config` means the band never
appears and says why once, not per turn.

## Acceptance criteria

1. **AC1** — With spans available, the trace panel renders a band whose total width represents the
   turn's measured duration and whose axis is labelled.
2. **AC2** — Each span renders as a segment positioned and sized from its own start and end
   timestamps.
3. **AC3** — Segments are classified as the run, model inference, or a call Foundry executed, and a
   legend names them alongside unattributed time. A tool **this app** executed is never drawn as a
   segment, because it produces no span.
4. **AC4** — A turn whose stream contained a tool round trip renders the leg it holds and states,
   once, that the earlier leg is a separate trace. It never implies it drew the whole turn.
5. **AC5** — Time not covered by any span renders as an unattributed gap and is labelled as such.
6. **AC6** — With no spans, no band is rendered and the panel states the timeline needs them; the
   existing retry remains available.
7. **AC7** — With tracing disabled in `GET /config`, no band and no retry are offered, and the reason
   is stated once.
8. **AC8** — Selecting a segment selects the matching call in the list below; a segment with no
   matching call is selectable but selects nothing.
9. **AC9** — No segment position or width is derived from anything but a timestamp — in particular,
   not from event arrival order (asserted against a fixture with out-of-order spans).
10. **AC10** — The band is operable by keyboard and each segment has an accessible name carrying its
    kind and duration.
11. **AC11** — The band's axis is built from `start_ms`/`duration_ms` alone; no position or width is
    derived from the turn's `startedAt`/`endedAt`, which are a different clock (asserted as a test).
12. **AC12** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **`GET /trace/{response_id}`** | **Unchanged.** It already returns `start_ms` (ms after the run's earliest span) and `duration_ms` per span — `backend/app/traces.py` computes them and `frontend/src/types/trace.ts` already mirrors them, with a comment saying they are "what puts bars on a shared axis". The groundwork was laid by spec 005 and this spec spends it. |
| **Fixtures (§5)** | The timeline is only as honest as its fixtures. Every fixture is recorded from a real run — including one with a tool round trip and one with unattributed time — never hand-built to make the picture look right. |
| **Docs** | `docs/how-it-works/` — the streaming-events and round-trip pages gain the picture they have been describing in words. |

## Out of scope / deferred

- Comparing two turns' bands (spec 020's business).
- Any aggregate view across a session.
- Drawing anything about the Voice Live session, whose timing is not in these spans.
