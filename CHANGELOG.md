# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Spec 013 — the agent can search the live web.** A third function tool, `search_web`, backed by
  Tavily's `/search` endpoint and executed by the BFF like the other two. It is the first tool here
  that depends on a third-party network service, which is the point: it is where the repo shows what
  a client-side tool does when the provider is slow, rate limited, out of credits, or not configured
  at all. Every one of those becomes a **result the agent can read aloud** — never an exception, so
  never a function call left unanswered and a run that expires ten minutes later.
  - The backend sits behind a `SearchBackend` Protocol, the same seam the knowledge tool already has,
    so a second provider is one class and no change to the tool, its schema or its registration.
  - **`TAVILY_API_KEY` is the one API key in this project.** The "no keys" rule is about Azure —
    every Azure service here authenticates with Entra ID — and Tavily has no Entra path. It is read
    by the BFF process only, never reaches the browser, and `.env.example` states the exception and
    its reason rather than leaving a reader to think the rule was forgotten. Unset, the tool answers
    `search_unavailable` and the app runs normally.
  - No new user-facing strings: the chat renders any tool call generically, so a fourth tool ships
    without touching the UI or `strings.ts` (§7 n/a — verified, not assumed).
  - No `AgentEvent` change (§9); no fixture re-recorded. The Tavily endpoint, auth header, request
    fields, response shape and 432/433 status codes are cited in `docs/REFERENCES.md`, read
    2026-09-15.

- **The voice overlay names who spoke.** Each line carries a badge — a microphone for you, the
  agent's mark for the agent — with the speaker's name in its title, because colour alone is not a
  label. The card is also wider (720px): it holds a conversation now, not a status readout.

- **Spec 000 — project scaffold.** Inherited the
  [agentic-coding-template](https://github.com/reginaldosilva27/agentic-coding-template):
  constitution, SDD workflow under `specs/`, `CLAUDE.md`/`AGENTS.md` twins, `.claude` skills and
  review subagents with their `.codex` counterparts, per-layer CI, GitHub templates, `justfile`.
- Project constitution with three project-specific principles: **§8** the agent loop lives in
  Foundry and never in this repo, **§9** the `AgentEvent` set is the contract, **§10** no Foundry
  API written from memory.
- `PLAN.md` — architecture record, harness contract, phase→spec map, open questions, and the six
  deliberate deviations from the original brief.
- `docs/REFERENCES.md` — every Microsoft Learn page relied on, with the API versions and package
  versions taken from each.

### Changed
- Inherited `infra/` quality gate switched from **Terraform to Bicep** (`az bicep build` +
  `az bicep lint`) — recorded in the constitution's amendment table.
- Constitution §7 (bilingual user-facing text) **kept** rather than deleted: public UI, Brazilian
  audience.
- Harnesses live at `ai/harness/` rather than a top-level `harness/`, reconciling the brief's
  separation with the template's layer model.
- CI's Node version moved from 20 to 24: vitest 5 needs >= 22.12, vite 8 needs >= 20.19.
- `justfile` now sets `dotenv-load`. Without it `just backend` started the BFF with no `FOUNDRY_*`
  variables at all — `/config` reported blanks and the first message failed on a `SettingsError`
  instead of reaching Foundry. Found while restarting the servers; `just` is not installed on the
  machine this was written on, so the recipe itself was not executed (§5).
- `specs/003-bff-streaming/tasks.md` reconciled with where the code actually landed — there is no
  `app/turn.py`, `test_turn.py` or `test_no_agent_loop.py`; the turn loop lives in the adapter and
  the §8 source scan lives in `test_routes.py`. Every AC was covered; only the task list was stale.

- **Spec 001 — the harness contract.** `ai/harness/_shared/contract.py`: the nine-event `AgentEvent`
  vocabulary, `validate_event`, `check_stream` (five stream invariants), and the `HarnessAdapter`
  Protocol. Plus `ai/tests/conformance.py`, an adapter-agnostic suite a future harness passes
  *unedited*. 31 tests, `ai/` gates green.

- **`docs/design-system.md`** — provenance of the Dataside design system and the
  `Foundry Live Agent.dc.html` screen (read via `DesignSync`), the layout contract, and a table of
  nine points where the mock disagrees with what we build. Unblocks spec 004.

- **Spec 002 (pass 1) — the prompt-agent harness, minus the parts that need Azure.**
  `get_current_datetime` and `lookup_knowledge` implemented once in `ai/harness/_shared/tools/`, a
  registry that is the only place a tool name resolves, `agent.yaml` + a loader that cross-checks
  declared tools against the registry, `apply_agent.py` (with `--dry-run`), `scripts/spike.py`, and
  the LangGraph scaffold that raises `NotImplementedError` rather than pretending to work. 57 tests.
- `lookup_knowledge` sits behind a `KnowledgeSource` Protocol, so swapping the local markdown corpus
  for Foundry IQ is one class and touches neither the tool, its schema, nor its registration.
- A test that reads the import graph and fails if any tool module reaches the agent, the model SDK,
  or a sibling tool — constitution §8 enforced by CI rather than by good intentions.

- **Spec 003 — the BFF.** FastAPI app with `POST /chat` (SSE), `GET /config`, `GET /health`; the
  SSE encoder, the tool executor, the harness factory, and the prompt-agent event normaliser and
  adapter. Verified end to end against the live Foundry project: `/health` and `/config` respond,
  and `/chat` reaches the agent.
- The adapter owns the turn loop and yields one **complete** turn, so the §9 "always terminates"
  invariant stays verifiable against a real harness by the spec 001 conformance suite, unedited.
- Four guarantees against the ten-minute hang: every collected call is answered, a raising tool
  becomes a result, the stream always terminates (twice — adapter and transport), and the loop is
  capped at 8 turns.
- `GET /config` reports how much of the event mapping is **observed** versus **inferred** (5 of 16
  observed), so the gap is visible in the API rather than buried in a comment.

- **Spec 004 — the frontend shell.** React 19 + TypeScript + Vite: the three-column layout
  (sidebar · conversation · trace panel), the SSE frame parser, a pure reducer that turns the
  `AgentEvent` log into a renderable turn, and the cards that render it. 48 tests.
- **App-executed and Foundry-executed tools now look different.** The design mock drew every tool
  call identically; `ToolCard` carries the distinction as a mono tag (`bff` / the MCP
  `server_label`), a differently-tokened left border, and a `data-executor` attribute — three
  signals, so it survives for a reader who cannot separate two hues. This is constitution §8 made
  visible, and it is the point of the repository.
- **The Dataside tokens are vendored verbatim** into `frontend/public/ds/colors_and_type.css`, read
  through `DesignSync`, together with the three latin Poppins `.woff2` cuts the CSS references. They
  live under `public/` so Vite copies them byte-for-byte rather than rewriting their `url()`s — the
  only way "imported, never hand-edited" (§4) survives a bundler. A test asserts our own CSS
  contains no hex value of its own.
- **`types/contract-parity.test.ts`** reads `ai/harness/_shared/contract.py` off disk and fails if
  the TypeScript mirror and the Python `_SCHEMA` disagree — §9 drift caught in CI, with no server.
- **Bilingual by test, not by intention** (§7): `strings.ts` holds `{ en, pt }`; one test asserts
  both languages exist for every key and that any key whose two languages are identical is declared
  as a proper noun; a second parses each component's JSX tree and fails on prose written inline. A
  third forbids emoji and decorative glyph icons (Dataside brand rule).
- **`ErrorCard`** — the mock had no treatment for a terminal `error`, which is the event that
  matters most: the contract exists so a failed run says so instead of the stream going quiet.
- **The reasoning card explains itself when empty** (§5). Behind the reference gateway connection
  the only model is `gpt-4o`, which emits no reasoning summaries; an empty box would read as a bug
  in this app rather than a property of the deployment.
- **Streaming markdown without quadratic re-parsing**: `splitBlocks` separates settled blocks from
  the live tail (respecting open code fences), and each settled block is a memoised component.
- Real screenshots in `docs/assets/`, and an honest table of the three that are still missing and
  what each waits on.

### Added
- **Spec 007 — the voice conversation lands in the chat.** A session used to be readable only
  through the overlay and then evaporate. The browser now keeps one **ordered log** of a session —
  what was said and what the agent did, interleaved — and replays it into the chat when the session
  ends: user utterances as messages, agent utterances as turns carrying the calls that produced
  them, under a divider naming the session and its length. The turns are the chat's own components,
  which is the point: a turn spoken and a turn typed are the same turn.
- Calls that arrive after the agent's last utterance land in a turn of their own rather than being
  glued to an answer they did not produce (§5).
- The voice overlay's transcript now scrolls inside the card. It used to scroll the whole card,
  carrying `Mute` and `End session` off the bottom of a long answer.
- A spoken sentence whose playback cannot start — autoplay blocked, or a decode failure — advances
  the queue instead of stalling it, so one unplayable sentence never costs the rest of the answer.

- **Spec 008 — spoken answers in the text chat.** A `Speak` toggle in the header reads the agent's
  answers aloud, **sentence by sentence while they stream**, so the first sentence is heard while
  the last is still being written. Synthesis is Azure AI Speech through a new `POST /speech` on the
  BFF: the browser gets MP3 bytes and still holds no Azure credential.
- The Speech REST call is written from the docs, not from memory (§10, recorded in
  `docs/REFERENCES.md`): the Entra header is `Bearer aad#{resourceId}#{token}` — not a plain bearer
  token — on the resource's custom-subdomain host, scope `https://cognitiveservices.azure.com/.default`,
  role *Cognitive Services Speech User*. `SPEECH_ENDPOINT` and `SPEECH_RESOURCE_ID` are
  configuration, and **no claim is made that the reference project's resource answers there** until
  someone runs it (§5).
- Markdown is flattened before it is spoken — a fenced code block is skipped rather than read out as
  backticks, and `get_current_datetime` keeps its underscores.
- Without speech configuration the toggle is disabled with the reason on it and `POST /speech`
  answers `503`, the same shape voice already uses.

- **Spec 012 — the voice session is configured.** Until now the app negotiated a voice session and
  left everything to service defaults: an `en-US` voice read the Portuguese answers, turn detection
  ran on `server_vad`, and noise suppression was off. The voice, the semantic turn detector and the
  input-audio options now travel **inside** `rtc.call.sdp.create` — the shape the WebRTC doc shows —
  so the session is configured before a word is spoken. Defaults suit this project
  (`pt-BR-ThalitaMultilingualNeural`, `azure_semantic_vad_multilingual`); blanking every
  `VOICELIVE_*` variable sends the frame exactly as before.
- `interrupt_response` — the barge-in spec 006 listed as a goal — **exists only on the azure
  semantic detectors**, so until this it was never actually configured. It is now.
- `instructions` is never sent: documented as unsupported with a custom agent, and asserted absent
  by a test rather than left to the author's memory.
- **Spec 011 — the turn says what is happening right now.** While a turn streams, one line states
  which of three things is going on: the agent has not started, it is thinking, or it is running a
  named tool (*Calling* `lookup_knowledge`). It is a pure projection of the turn — `turnStatus` in
  `state/turn.ts` — with the priority decided in one place: a call in flight beats reasoning, and
  the answer beats both. It disappears the moment the answer starts, because the answer and its
  caret are then the status.
- **Spec 010 — the trace panel groups its calls, and opens one in a reader.** Spec 009 moved the
  payloads into a 320px dark column, which is the wrong shape for a page of JSON. The panel now
  lists the turn's calls as the same compact rows the chat uses, and pressing one opens a centred
  reader — wide, scrollable, with JSON indented so the structure is visible and anything else left
  exactly as it came (§5). It closes with its button, with `Escape`, or on the backdrop.
- **Spec 009 — the tool payload moved to the trace panel.** A `microsoft_docs_search` returns a
  page of documentation, and the chat rendered all of it between the question and the answer. The
  chat now shows **one line per call** — name, executor tag, status, duration — and pressing that
  line opens the trace panel on the call, with its arguments and its result. Nothing is lost and
  nothing is truncated; the fact stays next to the prose and the evidence moved to the panel built
  for inspecting a run. The voice overlay keeps the full card, because there is no trace panel
  beside a voice session.
- The trace panel follows the turn you opened it from, defaulting to the newest.

### Changed
- **A less synthetic Portuguese voice.** The default was the *standard* neural tier, which sounds
  robotic in Portuguese; it is now `pt-BR-Luana:MAI-Voice-2-Flash`, documented as optimized for
  real-time responsiveness in Voice Live. Seven pt-BR voices were probed against the reference
  project and all were accepted — `.env.example` lists them, so switching is one line and a
  restart. Accepted is not the same as good; which sounds best is a listening test.

### Fixed
- **The agent audio element now lives in the page.** It was a detached `new Audio()`: the element
  existed, `srcObject` was set, and nothing was heard — the exact shape of a session with a filling
  transcript and no sound. The documented WebRTC sample appends the element to the document before
  assigning the stream; ours now does too, and removes it when the session ends.
- **The voice overlay shows that a tool ran, not its payload.** One `lookup_knowledge` result is a
  page of JSON, and in a 460px card over a live conversation it buried what you were listening to.
  The overlay now renders the same compact row the chat uses — no arguments, no result. This
  supersedes a non-goal of spec 009, annotated there.
- **The BFF logs what each voice session negotiated** — modalities, voice, turn detection — because
  *the agent did not speak* and *the browser did not play* are indistinguishable from the outside,
  and a session that comes back `modalities: ["text"]` is silent by design.
- **The voice session now says it wants audio.** `modalities` was never declared, and the service's
  default is not always the one that speaks: the committed fixtures show one recorded session
  reporting `"modalities": ["text"]` and another `["audio", "text"]`. A text-only session produces
  a transcript and no sound, with nothing on screen to explain the silence. The session object now
  states `["audio", "text"]`.
- **A tool call could push `End session` off the screen.** The voice card grew with its content;
  one `lookup_knowledge` result was enough to put the controls out of reach. The head, the level
  bars and the controls are now outside the one scrolling region.
- **The voice conversation reads newest-first.** In a spoken session the line that matters is the
  one that just arrived, and scrolling for it mid-call is the wrong ask — so the overlay reverses
  both the transcript and the activity. The chat keeps the ordinary order: a thread is read from
  the top.
- **The agent could be inaudible with nothing on screen to say why.** Two silent failures on the
  playback path: `ontrack` read `event.streams[0]`, which is `undefined` whenever the remote SDP
  carries no msid (the track still arrives — it is now wrapped in a `MediaStream`), and a rejected
  `play()` — blocked autoplay, a codec the browser will not decode — was swallowed by an empty
  `catch`. A blocked playback is now a visible error in both languages; the session keeps running.
- **Thinking phases no longer run together.** Foundry sends the reasoning summary in *parts*, each
  opening with its own `**Title**`, and marks each one with `response.reasoning_summary_part.added`
  — which the normaliser dropped. Two phases arrived as `…spot-on!**Researching project
  architecture**…` with no seam. That boundary is now carried through as a paragraph break, and the
  card renders the summary with the same markdown renderer the answer uses, so the `\n\n` the model
  actually sent stops being collapsed by HTML.
- **The READMEs asked for Node 20**, but Vite 8 needs ≥ 20.19 and CI runs 24. On Node 20.13 `npm`
  silently skips Vite's native binding and `npm run dev` dies with *"Cannot find native binding"*.
- **The stream did not stream.** The whole turn — reasoning summary and answer — reached the browser
  in one burst at the end, which read as a model without streaming. It was ours: the Foundry client
  is synchronous, so iterating it inside the adapter's async generator blocked the event loop
  between events and the server never got to flush the frames it had already encoded. Measured
  straight from Foundry: 76 reasoning deltas over 1.35s, 78 text deltas over 0.8s — all of it
  arriving at the browser at 8.26s. Each `next()` now runs in a worker thread; ordering is
  unaffected, because the awaits are sequential. Reproduced with no Azure in
  `test_the_event_loop_stays_free_while_the_foundry_stream_blocks`.
- **The app could scroll itself off the screen, with no way back.** A long answer pushed `.main`
  past the viewport: `.app` declared no grid row, so the implicit one was `auto`, and a grid item's
  default `min-height: auto` kept `.main` at its content height. The conversation never became a
  scrolling region — the *document* scrolled instead, and `overflow: hidden` on `body` stops the
  user from scrolling it back, not `scrollIntoView` from scrolling it away. Measured in a real
  browser before the fix: `document.scrollTop` 382.5, `.app` at `top: -382.5` (header off-screen),
  `.conversation` `scrollHeight === clientHeight`. After: the document has nothing to scroll and
  the conversation scrolls.
- **Following the stream no longer fights the reader.** The column stuck to the newest token on
  every re-render, so scrolling up during a long answer yanked you straight back down. It now
  sticks only when the reader is already within 120px of the bottom, and it scrolls the column
  itself instead of calling `scrollIntoView`, which walks every scrollable ancestor — including
  the document it should never touch.
- **The waiting indicator is alive.** Three out-of-phase dots instead of a static line with a
  blinking caret, which read as a stalled text field rather than as work in progress. Still gone
  the instant anything arrives, and still silent under `prefers-reduced-motion`.
- **`typescript` held at `~6.0.3`** — the merged bump to `~7.0.2` (PR #5) turned `npm test` and
  `npm run build` red on `main`. TypeScript 7 is the native port, and the package no longer exports
  the compiler API at all (`"." → "./lib/version.cjs"`); the i18n gate in
  `frontend/src/i18n/strings.test.ts` parses each component's TSX to find prose written directly
  into a component, and `ts.createSourceFile` is simply gone. The replacement lives under
  `typescript/unstable/*` with a different shape, and the word *unstable* is in its path. Revisit
  deliberately when dependabot reopens it — porting that test is the real work, not the bump.
- **A turn that has produced nothing now says so.** Between `POST /chat` and the first event the
  turn rendered an avatar and blank space — every card in the stack draws only once it has content
  — which reads as a frozen app rather than as waiting. It now says the agent is working, in both
  languages, and the line disappears the moment anything arrives (§5).
- **The Foundry client is built once, not per leg.** Each build was a fresh
  `DefaultAzureCredential`, and acquiring a token costs seconds — paid before the first byte of a
  turn and again on the leg that answers a tool call.
- **A tool round trip no longer fails with `No tool call found for function call output`.** The
  production stream factory named a conversation only when the browser already had one, so the
  *first* message of a session ran both legs unbound: Foundry had no record of the call the second
  leg was answering and rejected it with a 400, after the tool card had already rendered green.
  A turn that arrives without a conversation now gets one created, and every leg names it — which
  is how the recorded fixture was produced in the first place (`ai/scripts/spike.py`). Multi-turn
  memory comes with it: the id leaves on `trace_ids` and comes back on the next `POST /chat`.
- **Corrected the AI Gateway architecture.** The plan claimed all agent and model traffic routes
  through the project AI Gateway. It does not: the project-level gateway governs **direct model
  calls**, and Agent Service does not send its inference through it. Routing the *agent* through your
  own APIM is a separate feature — **bring your own model** — which changes the agent's model name to
  `<connection-name>/<model-name>`. Corrected in `PLAN.md` §4.3, both READMEs' diagrams,
  `docs/how-it-works/tracing-and-gateway.md` and `docs/REFERENCES.md`. Constitution §10 is what
  caught it.

### Notes
- Execution order now runs `002 → 006 (voice) → 003 → 004 → 005`; spec numbers are never renumbered.
- Settled: region **`eastus`** (O-5) and the design source (O-7). The BYOM connection already
  existed: **`foundry-analytics-demo`**, exposing **`gpt-4o`** — so the agent's model is
  `foundry-analytics-demo/gpt-4o`, and the proposed `apim-analytics-demo` connection is unnecessary.
- **`gpt-4o` is not a reasoning model**, so on the gateway path there are no reasoning summaries and
  the activity panel's reasoning card has nothing to show. Recorded in `PLAN.md` §4.3 and stated in
  the harness README rather than shipped as an unexplained empty panel.
- Two open questions block nothing yet but are verified by a spike at the start of spec 002:
  **O-8** whether the Responses API drives a prompt agent on a BYOM model, and **O-9** whether
  reasoning summaries survive the `chat/completions` hop to that model.
- **Spec 002 pass 2 is the only thing left in phase 1**, and it is blocked on a working model
  deployment behind the `foundry-analytics-demo` connection — not on code. Until then `/chat`
  reaches the gateway and comes back `404`, which the UI renders as a terminal error. Recorded
  rather than worked around (§5).
