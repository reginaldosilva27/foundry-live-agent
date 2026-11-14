# Spec: A turn's journey, drawn

| | |
|---|---|
| **ID** | 066-turn-flow |
| **Status** | in-progress |
| **Author** | Reginaldo Silva |
| **Date** | 2026-11-14 |

> Fill the WHAT and the WHY. **No implementation detail here** — that belongs in
> `plan.md`. If you catch yourself naming a file or a function, move it to the plan.

## Problem / motivation

The trace panel (specs 005, 014, 029) is accurate and textual: identifiers, token counts, a time
band, a list of calls. It answers *"what did this turn cost and where did its time go"* for someone
who already knows the architecture. It does not answer the question this project exists to teach —
*"where did my message go?"* — for someone who does not.

The one picture that does answer it, the README's message-journey animation, is **illustrative**:
it is the same for every message, its payloads are examples, and it cannot show what *this* turn
did — that it skipped the gateway, that the BFF executed one function tool while Foundry called an
MCP server itself, or that a spoken turn never touched the BFF on its way to the model.

Presenting the project to the community today means narrating over the trace panel. A drawing of
the turn's actual path — the hops it took, the hops it did not, in order, with the time each one is
*measured* to have taken — makes the architecture explain itself, one real turn at a time.

## Goals

- A reader can open, for one turn, a diagram of the components that turn passed through and the
  order it passed through them.
- The diagram is **built from what the turn proved** — its events, its spans, the deployment's
  configuration — never from a template of what a turn usually does (§5).
- A component whose absence is the lesson (the gateway; the BFF on a spoken turn) is shown as **not
  on this path**, with why — or as **not known**, when nothing says.
- Durations appear only where something measured them; an unmeasured hop says so.
- It works as teaching material: readable on a projector, steppable one hop at a time.

## Non-goals

- No new `AgentEvent`, no change to the §9 contract, no backend change.
- No new measurement. Network legs nobody timed (browser ↔ BFF, BFF ↔ Foundry, the audio legs) get
  no number.
- No gateway logs: the gateway records nothing and Voice Live never passes through it
  (`docs/how-it-works/tracing-and-gateway.md`).
- Not an editor and not a canvas: nothing can be dragged, zoomed, connected or changed.
- No fixed architecture picture and no toggle to one (Q1).
- No keyboard shortcut: the controls are buttons (the app names keys in one place, and no key may
  interrupt typing).
- Does not replace the trace panel; it is another way of looking at the same turn.
- No claims about Foundry's internals beyond what its spans say.

## User-facing behavior

**Opening it.** Every settled turn — typed or spoken — offers *view flow* among its actions, and the
trace panel offers the same beside the run it describes. The flow steps to the previous and next
turn the way the trace panel does. **Whether a flow has an address, and whether its spans can be
read, depends on one fact: does the turn carry a response id?** — not on whether it was spoken.
A turn with one has its own address beside the existing trace address, so it can be shared or
opened straight into a presentation. A turn without one — every spoken turn today (Q4), and a typed
turn that ended before Foundry identified it — has no address and no span read, and the view says
why.

**The picture.** A wide, fixed layout that reads like a slide: the browser on the left, the model on
the right, Foundry between them, the BFF between the browser and Foundry, and the tools and servers
the turn called below the component that called them. Each component the turn used is drawn and
named with the turn's own names — the model's, each tool's, each MCP server's label. Below a narrow
breakpoint the same path reads top to bottom.

- **A typed turn** travels browser → BFF → Foundry agent → model. Each tool call follows in the
  order it happened:
  - a call **the app** ran is the round trip Foundry → BFF → Foundry, labelled with the tool name;
  - a call **Foundry's side** ran (an MCP server, or the hosted container's own tools) is Foundry →
    that tool or server → Foundry, and never touches the BFF.

  The answer returns model → Foundry → BFF → browser.
- **A spoken turn** travels browser ⇄ (audio, peer-to-peer) ⇄ Voice Live (speech → text) → Foundry
  agent → model, and the answer returns through Voice Live (text → speech) to the browser. A
  function call it made is Voice Live → BFF → Voice Live. The BFF is shown **off the audio path**.
- **The agent component** is labelled by the answering agent's harness: Foundry's prompt runtime, or
  our container running inside Foundry.
- **The gateway**, when present, sits on the Foundry → model leg with no duration (it records
  nothing). It is *on the path* or *off the path* for a turn answered by the default agent, from the
  deployment's own flag; **not known for this agent** for any other agent, a hosted one included;
  and always *off the path* on a spoken turn. Each state says why in words.

**Durations.** Only measured ones:

- the model component shows how many model calls the spans recorded and each one's duration —
  **in the leg the spans cover**. The trace a turn's response id names is its **last leg**; a turn
  with a tool round trip had an earlier leg that is a separate trace, and the view says so in the
  trace panel's own words rather than presenting the count as the turn's;
- an app-run tool shows the duration its result reported;
- a Foundry-run tool shows a duration only when a span measured it and can be tied to that call
  without guessing.

Every other hop carries no number. When the spans have not been read — pending, refused, not
configured — the flow still draws from the turn's events, says which of those it is, and offers to
read them again when they are pending. A turn with no response id says this app holds no id to read
its spans by — which is not the same as nothing measuring it: Foundry traces spoken turns too.

**Stepping.**

- *Previous* / *next* move one hop at a time and highlight it with a short caption: what that hop
  is and who did it, e.g. *"Foundry asked for `get_current_datetime`. The model does not run tools:
  the BFF runs it and sends the result back."*
- *Play* walks the hops at a **fixed pace**, never proportional to time (most hops were not
  measured), and *pause* stops it. *Show all* draws the whole path at once, which is also where the
  view opens.
- With reduced motion preferred, nothing moves: only the highlight changes.
- Captions are fixed text per kind of hop, filled with the turn's names — never generated.

**Ending early.** A failed turn's path ends at the last hop that happened, marked failed with the
error code the turn reported. A stopped turn's path ends where the reader stopped listening, marked
stopped — different from failed.

**A tool hop is a door.** Pressing an app-run or Foundry-run call opens it in the log reader
(spec 010), as its row in the trace panel does.

**Opened by address.** A flow address is resolved against the turns on screen, then against this
browser's stored conversations; a stored conversation that holds the turn is reopened the way its
own address reopens it (spec 021), so the flow sits over that conversation and its answering agent
is the stored one. A turn this browser's record does not hold is said so and nothing is drawn — the
spans alone cannot say what the turn sent or which calls the app made.

**Text alternative.** The same hops, in the same order, as an ordered list the screen reader reads.
The caption of the hop the reader steps to is announced politely; *play* announces nothing.

All new prose ships `en` + `pt` (§7).

## Acceptance criteria

1. **AC1 — typed path.** Given a settled typed turn with no tool calls, when its flow opens, then the
   hops are, in order: browser → BFF, BFF → Foundry agent, Foundry agent → model, model → Foundry
   agent, Foundry agent → BFF, BFF → browser.
2. **AC2 — app round trip.** Given a turn with tool calls, then after Foundry agent → model come:
   model → Foundry agent (the model asks for calls); each call's hops in step order; Foundry agent →
   model (the results go back); then the answer hops of AC1. An app-run call's hops are Foundry
   agent → BFF and BFF → Foundry agent, labelled with that tool's name. These are **logical** hops:
   how many times the model was really called is what the spans say (AC5), not what the hop count
   suggests, and the captions do not claim one model call per hop.
3. **AC3 — Foundry-side calls.** Given an MCP call, then its hops are Foundry agent → a component
   named by the server label → Foundry agent, and no hop of that call touches the BFF. The same
   holds for a tool call with `executor: foundry`, named by the tool.
4. **AC4 — gateway.** Given a turn answered by the default agent, then the gateway is *on the path*
   on the Foundry → model leg when `GET /config` says inference uses the gateway, and *off the
   path* otherwise. Given a turn answered by another agent, then it is *not known for this agent*.
   Given a spoken turn, then it is *off the path*. Each state renders its reason as text, and the
   gateway never carries a duration.
5. **AC5 — model durations.** Given the turn's spans were read, then the model component shows the
   number of model spans and each one's measured duration, labelled as the leg the spans cover; and
   given the turn has an app-run call, the view also says the earlier leg is a separate trace and is
   not counted. Given they were not read, then it shows no count and no duration, and the view names
   why: pending, refused, not configured, failed — offering to read again when pending — or **no
   response id**, which issues no read at all.
6. **AC6 — tool durations.** An app-run tool hop shows its result's `duration_ms`. A Foundry-run hop
   shows a duration only when exactly one tool span carries its name **and** exactly one of the
   turn's calls has that name; otherwise none. (The spans cover one leg, so one span and two calls of
   the same name cannot be told apart.)
7. **AC7 — nothing unmeasured is numbered.** Browser ↔ BFF, BFF ↔ Foundry, audio and gateway hops
   never carry a duration.
8. **AC8 — spoken path.** Given a spoken turn with no calls, then the hops are browser → Voice
   Live, Voice Live → Foundry agent, Foundry agent → model, model → Foundry agent, Foundry agent →
   Voice Live, Voice Live → browser. With calls, AC2's shape applies, and an app-run call's hops are
   Foundry agent → Voice Live, Voice Live → BFF, BFF → Voice Live, Voice Live → Foundry agent — the
   call surfaces on the session and the BFF answers it on its control connection. The BFF is
   labelled off the audio path. No hop carries a span-measured duration, because the turn carries no
   response id — an app-run call still shows the duration its result reported (AC6), which the BFF
   measured. The view says this app holds no id to read the turn's spans by, and does not say
   nothing measured it.
9. **AC9 — harness label.** The agent component reads as Foundry's prompt runtime for a
   `prompt-agent` turn and as our container running in Foundry for a `langgraph` turn, from the
   answering agent's harness as the agents listing reports it.
10. **AC10 — failed and stopped.** A turn that did not finish draws only what its content proves:
    the request hops to the BFF when nothing arrived (an error may not have come from Foundry);
    through Foundry and the model's request for calls, and the calls that arrived, when calls
    arrived; through the model's answer when text arrived. Given status `error`, that path is
    followed by BFF → browser marked **failed** with the turn's error code; a call whose own status
    is failed is marked failed too. Given status `stopped`, the last proven hop is marked
    **stopped**. Failed and stopped render differently.
11. **AC11 — stepping.** *Next* from the first hop highlights the second and shows its caption;
    *previous* returns; neither moves past the ends. *Show all* highlights none and draws all.
    *Play* advances one hop per fixed interval independent of any duration and stops at the last
    hop; *pause* stops it.
12. **AC12 — reduced motion.** With `prefers-reduced-motion: reduce`, no animation or transition
    runs; stepping still changes the highlight.
13. **AC13 — doors in.** Every settled turn's actions include *view flow*; the trace panel includes
    it for the turn it shows. A turn with a response id gets a flow address that parses back to that
    turn's flow; a turn without one gets none, whether spoken or typed, and the view says why. The
    flow steps between turns.
14. **AC14 — door out.** Pressing a tool hop opens that call in the log reader.
15. **AC15 — opened by address.** A flow address whose response id belongs to a turn in a stored
    conversation reopens that conversation and shows the flow over it. One that matches no turn in
    this browser's record renders that statement and no diagram.
16. **AC16 — text alternative.** The hops are also an ordered list in the same order; every
    component, hop and control has an accessible name; a manual step announces the caption in a
    polite live region and *play* does not.
17. **AC17 — narrow screen.** Below the narrow breakpoint the path is laid out top to bottom and the
    page does not scroll horizontally at 320px.
18. **AC18 — themes.** The diagram uses colour tokens only, and every text-on-surface pair it
    introduces meets its contrast bar in both themes.
19. **AC19 — bilingual.** Every new string exists in `en` and `pt`.
20. **AC20 — no new request.** Opening a flow makes no request other than reading the turn's trace;
    none at all while the trace panel is already open on that turn; and none for a turn with no
    response id.

## Contract / data impact

**None.** No `AgentEvent` change (§9), no backend change, no new field on any endpoint. The view
reads what the turn already holds (activities with their executor and step, status, error, trace
ids), the spans `GET /trace/{response_id}` already returns, `GET /config`'s gateway flag and default
agent, and the agents listing's harness — the same source the harness badge reads, so the kind →
harness mapping is not copied (§4). The new flow address is a frontend route, parsed and built in
the one place routes already are. New strings ship `en` + `pt` (§7).

## Open questions (clarify before planning)

All seven resolved on 2026-11-14 with the owner:

- [x] **Q1 — Per-turn or generic?** → **Per-turn**, built from what the turn proved. No fixed
      architecture picture and no toggle.
- [x] **Q2 — Where does it live?** → **A wide view of its own** with its own address, opened from
      the trace panel and from the turn; top-to-bottom on a narrow screen. No compact copy in the
      panel.
- [x] **Q3 — Static or animated?** → **Step-through plus play**, fixed pace, *show all*, reduced
      motion honoured, fixed bilingual captions.
- [x] **Q4 — Voice turns.** → **In this spec.** Found in the code: no voice normaliser emits
      `trace_ids`, so a spoken turn reaches the browser with no response id — no address, no span
      read, no durations. Foundry does trace voice turns into Application Insights; what is missing
      is this app's id to read them by, and the view says exactly that. Address and span read key on
      **response-id presence**, which also covers a typed turn that ended before it was identified.
      The voice session attaches to the selected agent (spec 019 AC8), so the answering agent is
      the same source for spoken and typed turns.
- [x] **Q5 — The gateway.** → **The deployment's existing flag**, for the default agent only;
      *not known* for any other agent; never a duration; no contract change.
- [x] **Q6 — Hosted harness.** → **In this spec, decided from the code**: the executor on each call
      decides the route, the listing's harness labels the agent component.
- [x] **Q7 — Interactivity.** → **Fixed layout that reads like a slide.** No pan, zoom or drag, no
      canvas library. Tool hops open the call in the log reader.

## Out of scope / deferred

- **Voice ids and spans.** A spoken turn could be measured if the voice session surfaced its
  `response_id` and the spans were read for it. That is a §10 question against the live service.
- **Per-agent gateway.** `GET /agents` reporting whether each agent's model routes through the
  gateway would remove the *not known* state, at the cost of a contract change.
- Regenerating the README GIF from a real turn.
