# Spec: The shape of a turn — a measured timeline

| | |
|---|---|
| **ID** | 029-turn-timeline |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

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
- No new backend query beyond what `GET /trace/{response_id}` already returns, unless the plan shows
  the timestamps are missing from it.

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**The band** sits in the trace panel, above the calls it explains. It runs left to right over the
turn's real duration, with the axis labelled in seconds. Each span is a segment, coloured by what it
is — model inference, a function tool this app executed, an MCP call Foundry executed — with the
legend naming the three.

**The two legs are visible as two.** A turn with a tool round trip contains two model segments with
the tool between them, which is the picture that makes `docs/how-it-works/` legible at a glance.

**Unattributed time is drawn as unattributed** — a gap in the band, not a stretched neighbour. When
the spans do not account for the whole turn, that gap is the honest finding, and often the
interesting one.

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
3. **AC3** — Segments are classified as model, app-executed tool, or platform-executed call, and a
   legend names the three.
4. **AC4** — A turn with a tool round trip renders two model segments with the tool between them.
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
11. **AC11** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **`GET /trace/{response_id}`** | May need to carry span start/end timestamps if it does not already. If it does, the frontend `Trace` type mirrors the backend shape, as it does today (§4). |
| **Fixtures (§5)** | The timeline is only as honest as its fixtures. Every fixture is recorded from a real run — including one with a tool round trip and one with unattributed time — never hand-built to make the picture look right. |
| **Docs** | `docs/how-it-works/` — the streaming-events and round-trip pages gain the picture they have been describing in words. |

## Open questions (clarify before planning)

- [ ] Does `GET /trace/{response_id}` already return per-span start and end, or only durations?
      This decides whether the spec touches the backend at all.
- [ ] Are the span clocks comparable to the browser's `startedAt`/`endedAt`, or is the band's total
      the spans' own extent rather than the turn's wall clock?
- [ ] Does a hosted-harness run produce spans of the same shape, or does the container's own loop
      report differently (spec 018's measurement)?
- [ ] Does the band belong to the trace panel only, or is a compact version worth putting under the
      turn in the chat?

## Out of scope / deferred

- Comparing two turns' bands (spec 020's business).
- Any aggregate view across a session.
- Drawing anything about the Voice Live session, whose timing is not in these spans.
