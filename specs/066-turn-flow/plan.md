# Plan: 066-turn-flow

> The HOW. Written after `spec.md` is `clarified`.

## Approach

**Two pure modules and one view.** Everything the spec asserts about *which* hops a turn took is
decided by a pure function over data the frontend already holds, so it is testable without
rendering, and the view only draws what that function returns.

1. **`state/flow.ts` — the path.** `buildFlow(input)` takes the turn (`Turn`: activities with
   `executor`/`step`/`status`/`durationMs`, `text`, `status`, `error`), whether it was spoken, the
   answering agent's harness, the gateway state, the model name and the span read (`Trace` or
   absent). It returns `{ mode, nodes, hops, gateway, harness, model, measurement }`.
   - **Hops are logical** (spec AC2): request, forward, ask the model; if there are calls, *the model
     asks*, each call in `step` order, *the results go back*; then the model answers and the answer
     travels back. An app call is `agent → bff → agent` (typed) or `agent → voice → bff → voice →
     agent` (spoken); a Foundry-side call is `agent → node → agent`, where the node is one per MCP
     `serverLabel` or one per Foundry-run tool name.
   - **Unfinished turns** (AC10) build only the stages their content proves: nothing arrived → the
     request to the BFF; calls arrived → through the calls that arrived; text arrived → through the
     answer. `error` appends `bff → browser` marked failed with the code; `stopped` marks the last
     proven hop.
   - **Durations** (AC5–AC7): an app call's hop carries `durationMs` from its result; a Foundry-side
     call's carries a span's duration only when **exactly one** `tool` span's name is
     `execute_tool <name>` or ends in `.<name>` — the recorded shape is
     `execute_tool mcp_microsoft_learn.microsoft_docs_search`
     (`ai/tests/fixtures/recorded/appinsights-spans-20260916.jsonl`) — **and** exactly one of the
     turn's calls has that name. The model node carries the durations of the `model` spans in start
     order, scoped to **the leg the spans cover**: `GET /trace/{id}` queries the last leg's response
     id, and the trace panel already says the earlier leg is a separate trace (`timeline.axisNote`,
     `timeline.otherLeg`, reused). No other hop is ever given a number.
   - **Measurement** is `loading | ok | pending | denied | failed | unavailable | no-id`. `no-id` is
     decided by the turn carrying no `trace.responseId` — spoken or not — and issues no read.
   - `gatewayState({ spoken, harness, answeringAgent, defaultAgent, usesGateway })` is Q5's rule:
     spoken → `off`; hosted → `unknown`; default agent (or none chosen) → `usesGateway ? on : off`;
     any other agent → `unknown`.
   - `layoutFlow(flow, orientation)` places nodes on a grid — browser, BFF/Voice Live, agent, model
     along the main axis; called tools and servers on a second row under the agent; on a spoken turn
     the BFF on the second row under Voice Live; the gateway between agent and model — and returns
     grid coordinates and the edges in use. `vertical` transposes the axes (AC17). Geometry lives
     here and nowhere else, the way `timeline.ts` owns the band's.

2. **`state/voiceLog.ts` — which turns were spoken.** Spoken turns are minted by `voiceMessages`
   with ids under one prefix; `isSpokenTurn(id)` is exported beside the function that mints them, so
   the rule has one home (§4). Stored conversations keep the ids, so it holds after a reload.

3. **`panes/TurnFlow.tsx` — the view.** A full-screen modal (`position: fixed`, the voice overlay's
   and the log reader's pattern, `useModalFocus`), so it takes the whole width and needs no grid
   placement in `.app`. It has three parts:
   - a header with the title, the turn position and previous/next turn (the trace panel's strings),
     and close;
   - a stage holding the SVG diagram (`aria-hidden`, decorative: every fact in it is also in the
     list) and the caption of the highlighted hop;
   - a **Steps** list: an `<ol>` with the same hops in the same order, `aria-current="step"` on the
     highlighted one, and a button on each call hop that opens the call in the log reader (AC14).
     Nodes in the SVG open the same call on click as a pointer convenience; the keyboard door is
     the list.

   Stepping state is local: `index = -1` is *show all*, where the view opens. *Play* is a
   `setInterval` at a fixed `FLOW_PACE_MS`, stopping at the last hop (AC11). A visually hidden
   polite live region is written only by manual steps; *play* writes the visible caption and never
   the live region (AC16). Reduced motion is a stylesheet rule (AC12). Measurement notes reuse the
   trace panel's `trace.spans*` strings and its retry, so the two surfaces cannot word one state
   differently (§4).

4. **`App.tsx` — wiring, no new fetch.** A `flowOpen` flag beside `tracesOpen`. The flow reuses the
   panel's position (`trace.turnId`, `shown`, `stepTurn`) and its span read: `useTrace` fetches
   while the panel **or** the flow is open. It has no cache, so the guarantee is the one AC20 states:
   with the panel already open on the turn the id does not change and nothing is fetched again; a
   turn with no response id passes no id and nothing is fetched at all. `openFlow(turnId)` pins the turn, opens the flow and navigates to
   `/trace/{response_id}/flow` when the turn has an id. The route effect resolves a flow address
   against the turns on screen, then against this browser's stored conversations, restoring the one
   that holds it the way `/c/{id}` restores, so the answering agent is the stored one. With no
   match it shows the not-in-this-browser state (AC15). Closing returns to the trace address when
   the panel is open, else to the conversation, else to the chat. The answering agent is the
   existing `shownAgent`; its harness is the listing row's `harness` (the header badge's source),
   falling back to `config.harness` only for the default agent; the model is what the trace panel
   is given.

5. **Doors** (AC13): `AnswerActions` gains an optional `onOpenFlow`, shown on every settled turn
   (spoken ones included, which today have no trace route at all); `Conversation` passes it; the
   trace panel gets a *view flow* button in its header. A new `FlowIcon` (three connected nodes) in
   `Icon.tsx`.

**Alternatives rejected.** A canvas library (React Flow): a dependency, theming and a11y work, and
dragging explains nothing (Q7). Mermaid, already dynamically imported: it draws one static picture,
with no highlight to step through and no node to open. Arrival order of events instead of
`Activity.step`: `step` is already the one place a call's order is decided (spec 015).

## Affected files

- `frontend/src/state/flow.ts` (new) + `flow.test.ts` — `buildFlow`, `gatewayState`,
  `toolSpanDuration`, `layoutFlow`, `FLOW_PACE_MS`.
- `frontend/src/state/voiceLog.ts` (+ test) — `isSpokenTurn`, using the prefix the minting already
  uses.
- `frontend/src/state/route.ts` (+ `route.test.ts`) — `{ name: 'flow'; responseId }`,
  `/trace/{id}/flow`.
- `frontend/src/panes/TurnFlow.tsx` (new) + `TurnFlow.test.tsx`.
- `frontend/src/components/AnswerActions.tsx` (+ test) — `onOpenFlow`.
- `frontend/src/panes/Conversation.tsx` — passes `onOpenFlow`.
- `frontend/src/panes/TraceDrawer.tsx` (+ test) — *view flow* button.
- `frontend/src/components/Icon.tsx` — `FlowIcon`.
- `frontend/src/App.tsx` (+ `App.routing.test.tsx`) — `flowOpen`, `openFlow`, route effect, render.
- `frontend/src/i18n/strings.ts` — `flow.*` keys; proper nouns added to `INTENTIONALLY_IDENTICAL`.
- `frontend/src/styles/app.css` (+ `layout.test.ts`) — `.flow*` rules: fixed overlay, reduced
  motion, narrow breakpoint, tokens only.
- `frontend/src/a11y.test.tsx` — the flow as a sixth screen.
- `frontend/e2e/smoke.spec.ts` — open a replayed turn's flow in the demo.
- Docs: `CLAUDE.md` ↔ `AGENTS.md` (§6), `docs/how-it-works/tracing-and-gateway.md`, `CHANGELOG.md`
  `[Unreleased]`, `specs/README.md`.

## Contract / data model changes (constitution §4)

None. No `AgentEvent`, endpoint or backend change. The new address is built and parsed only in
`route.ts`. The spoken-turn rule lives beside the code that mints spoken ids. Kind → harness stays
in `HARNESS_FOR_KIND`; the flow reads the listing's `harness`. Span states reuse `trace.spans*`.

## i18n strings (constitution §7)

New keys, `en` / `pt`. Proper nouns — `BFF`, `Voice Live`, `AI Gateway` — are listed in
`INTENTIONALLY_IDENTICAL` with the reason. No glyph arrows in any string (the glyph test).

| key | en | pt |
|---|---|---|
| `flow.open` | View flow | Ver fluxo |
| `flow.title` | How this turn travelled | Como este turno viajou |
| `flow.close` | Close the flow | Fechar o fluxo |
| `flow.previous` / `flow.next` | Previous step / Next step | Passo anterior / Próximo passo |
| `flow.play` / `flow.pause` | Play / Pause | Reproduzir / Pausar |
| `flow.showAll` | Show all | Mostrar tudo |
| `flow.position` | Step {n} of {total} | Passo {n} de {total} |
| `flow.allShown` | All {total} steps | Todos os {total} passos |
| `flow.steps` | Steps | Passos |
| `flow.openCall` | Open {name} in the log reader | Abrir {name} no leitor de logs |
| `flow.notInBrowser` | This browser has no record of that turn… | Este navegador não tem registro desse turno… |
| `flow.noId` | This turn carries no response id, so this flow has no address and this app has no id to read its spans by. | Este turno não traz response id, então este fluxo não tem endereço e o app não tem id para ler seus spans. |
| `flow.noIdSpoken` | …and a spoken turn never does: the voice session sends none. Foundry still traces it. | …e um turno falado nunca traz: a sessão de voz não envia. O Foundry ainda o rastreia. |
| `flow.modelCalls` | model calls: {n} | chamadas ao modelo: {n} |
| `flow.notMeasured` | not measured | não medido |
| `flow.node.*` | Browser · BFF · Voice Live · Foundry agent (prompt runtime / our container) · AI Gateway · Model | Navegador · BFF · Voice Live · Agente no Foundry (runtime de prompt / nosso contêiner) · AI Gateway · Modelo |
| `flow.sub.*` | this app's backend · speech and text · not on the audio path · MCP server · runs in Foundry | o backend deste app · fala e texto · fora do caminho do áudio · servidor MCP · roda no Foundry |
| `flow.gateway.*` | on / off / unknown / unknownHosted / voice — each a sentence of why | idem |
| `flow.hop.*` | one caption per hop kind (request, forward, askModel, modelAsks, appCall, appResult, foundryCall, foundryResult, mcpCall, mcpResult, results, modelAnswers, answerToBff, answerToBrowser, speechIn, voiceToAgent, agentToVoice, speechOut, voiceRelay, voiceCall, voiceResult, voiceBack, failed) | idem |
| `flow.mark.failed` / `flow.mark.stopped` | failed / stopped: you stopped listening | falhou / interrompido: você parou de ouvir |

Final wording lives in `strings.ts`; this table is the inventory.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 typed path | hops of a no-call turn, in order | `state/flow.test.ts` |
| AC2 app round trip | `twoToolTurn`: model asks, app call agent↔bff with name, results, answer | `state/flow.test.ts` |
| AC3 Foundry-side calls | MCP hop to the server node, never bff; `executor: foundry` tool likewise | `state/flow.test.ts` |
| AC4 gateway | `gatewayState` table: default on/off, other agent, hosted, spoken; no duration | `state/flow.test.ts` |
| AC5 model durations | spans read: count + durations in start order; absent: no count, measurement names status | `state/flow.test.ts`, `TurnFlow.test.tsx` (retry offered when pending) |
| AC6 tool durations | app `duration_ms`; one span → duration; zero or two → none (recorded span names) | `state/flow.test.ts` |
| AC7 nothing unmeasured numbered | every non-call, non-model hop has no `durationMs` | `state/flow.test.ts` |
| AC8 spoken path | voice hops, relay hops for app calls, bff off audio, no durations | `state/flow.test.ts`, `state/voiceLog.test.ts`, `TurnFlow.test.tsx` |
| AC9 harness label | prompt-agent vs langgraph vs unknown | `state/flow.test.ts`, `TurnFlow.test.tsx` |
| AC10 failed/stopped | `failedTurn`; nothing-arrived error; stopped mid-call; failed call | `state/flow.test.ts` |
| AC11 stepping | next/previous/ends/show all; play with fake timers, independent of durations; pause | `TurnFlow.test.tsx` |
| AC12 reduced motion | stylesheet has a reduced-motion block covering `.flow` with no transition/animation | `styles/layout.test.ts` |
| AC13 doors in | `AnswerActions` button; trace panel button; route round-trip; App opens flow; spoken has no address | `AnswerActions.test.tsx`, `TraceDrawer.test.tsx`, `route.test.ts`, `App.routing.test.tsx` |
| AC14 door out | list call button calls `onOpenCall` with the call key | `TurnFlow.test.tsx` |
| AC15 not in this browser | unknown response id renders the statement and no diagram | `App.routing.test.tsx` |
| AC16 text alternative | `<ol>` order equals hops; names; live region on manual step only | `TurnFlow.test.tsx`, `a11y.test.tsx` |
| AC17 narrow | `layoutFlow(…, 'vertical')` transposes; stylesheet narrow rule; e2e 320px no overflow | `state/flow.test.ts`, `layout.test.ts`, `e2e/smoke.spec.ts` |
| AC18 themes | `.flow*` rules name only colour tokens, and text tokens only from the paired set | `styles/layout.test.ts` (existing token rule + a flow-specific one) |
| AC19 bilingual | existing `strings.test.ts` over the new keys | `i18n/strings.test.ts` |
| AC20 no new request | opening the flow after the panel issues no fetch; spoken flow issues none | `App.routing.test.tsx` |

## Risks / trade-offs

- **Logical hops can be read as model calls.** Mitigated by AC2's wording, captions that do not
  count, and the model node's span-backed count.
- **A spoken turn's hops are architecture plus events**, not a measurement of that turn. The view
  says so (AC8), and the deferred voice-id work is what would change it.
- **Span matching by name** gives up on repeated calls rather than guessing — a turn that calls the
  same Foundry tool twice shows no duration for either. Stated in AC6.
- **`App.tsx` is already large.** The flow adds a flag, two callbacks and a branch in the route
  effect; the logic lives in `flow.ts`.
