# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Demo mode — the whole app, with no Azure credential** (spec 050). `just demo` replays turns
  recorded from real Foundry runs: the streaming, the function-call round trip, the MCP calls, the
  usage, the span tree and the event inspector, all arriving through the *same* normaliser the live
  path uses, so a replayed turn earns the §9 contract rather than being excused from it. The reader
  picks which recorded turn to watch. It closes the gap this repository had as teaching material:
  before it, seeing one streamed token cost a subscription, a Foundry resource, a project, a model
  deployment, App Insights, RBAC — and `infra/` ships no IaC, so the ten-minute Quickstart was ten
  minutes for somebody who already had a project.
  - **A separate entrypoint, not a flag**, and that was the clarify step's one real decision. A
    `FOUNDRY_DEMO=1` inside `create_app` would put replay code on the production path, where a
    mistyped variable makes a real deployment serve a recording as a live answer with nothing
    downstream able to tell. `create_app` does not import `app.demo`; a test walks the import graph.
  - **It cannot answer a question, and says so** rather than letting a reader find out by typing
    twice. The banner names the replay, dates it, and has no dismiss control — a banner that can be
    closed is one that is missing from the screenshot somebody posts.
  - Three screens beyond the chat come with it: the agents listing (the **real** recorded listing,
    through the real `summarise` — ten agents from a real project, two of them ours), the trace
    panel's span tree, and the playground. Voice and speech report *not configured*, because they
    are: a replayed WebRTC session would be a drawing of a feature (§5).
  - The hosted recording is **deferred with its reason**: the two harnesses normalise different raw
    streams and the single `stream_factory` seam cannot tell which adapter is calling it, so the
    listing says `demo_not_recorded` — a different fact from `no_harness`, which would be a lie
    about a build that has the harness.

### Fixed
- **The event inspector destroyed the layout, and 1018 green tests could not see it** (spec 038).
  `.events` is a direct child of `.app`, which is a grid, and nothing placed it: with the three
  declared columns taken, auto-placement put a 380px panel into an **implicit second row, column
  one** — inside the 248px rail. Measured at 1440×900: the conversation collapsed to a single tool
  row, the composer floated mid-page and the rest went blank, with the trace panel open or closed
  alike. It is a column now, sized by `--events` so the track and the panel read one number, and
  below **1542px** — 248 rail + 594 header floor (measured) + 320 trace + 380 inspector — it is a
  drawer over the trace panel instead. jsdom lays nothing out, which is exactly why this shipped;
  `layout.test.ts` now asserts the placement and the gate.
- **The sources strip listed the same page four times, and dropped React keys doing it** (spec 034).
  The Learn MCP answers one search with the same document under several `#anchors`; the dedupe keyed
  on the whole URL and let all four through, while `labelFor` strips the fragment, so four rows
  carried one label — and React logged eight *"children may be duplicated and/or omitted"* errors
  against the recorded turn. AC9 already said a page is not four pieces of evidence about itself.
  `identify()` is now the one place sameness is decided, `Source.id` is what both the dedupe and the
  row key read (§4), and the recorded payload drives the test.
- **The command palette listed "Events" twice.** `toggleEvents` was in `BINDINGS` *and* in
  `EXTRA_ACTIONS`, whose own comment says it holds actions "that no key names" — two rows under one
  id. The guard is now the invariant (every action appears once, under an id of its own) rather than
  the one command.
- **The tool playground had no door** (spec 042). `/tools` parses and renders, and nothing led to
  it — not the rail, not the palette, not the footer; spec 042's plan lists `Sidebar.tsx` and only
  the `View` type arrived. It sits on the footer's developer shelf now, beside `/about` and
  `/preferences`, and only where the deployment enabled it: a door onto a 403 is worse than no door.

### Changed
- **The README's status block was two months stale, in both languages.** It claimed specs 000–019,
  021 and 022 were done and that spec 020 was "clarified and not built yet" — against 48 of 50 done
  and `/compare` shipped. `specs/README.md` already carries the per-spec table and already records
  that it drifted once; the READMEs now state the two durable facts and point there, because two
  tables of fifty rows drift (§4).
- **Two code comments outlived what they described.** `_endpoint_and_versions` still recorded its
  two halves as unverifiable "because `az` was a broken build", which the CHANGELOG entry below
  withdrew on 2026-09-20; and `route.ts` still called `/compare` "reserved for spec 020".

### Security
- **A response id from the URL was pasted into KQL.** `GET /trace/{response_id}` built its query
  with `str.format`, putting the path parameter inside a single-quoted literal: one quote closed the
  literal and everything after it was query text. What made it worth a heading rather than a line:
  the query runs with the BFF's own identity, holding Log Analytics Reader on a workspace that
  stores **prompts, tool arguments and tool results** — `SECURITY.md` says so itself — and this
  application has no notion of a user, so the reach was "anyone who can reach the BFF". It was also
  a plain bug: an id carrying a quote produced a KQL syntax error the drawer reported as a failed
  query. The id is now checked against `ID_SHAPE` and **refused** before a query exists, rather than
  escaped on the way in. The rule is not a claim about Foundry's id format (§10 — no doc read says
  what it is); it is a bound on what this app will hand a query engine, failing loudly in one place
  if that ever stops being true.

### Fixed
- **The concurrency tests proved the right thing by the wrong means, and were flaky.** They issued
  several slow requests at once and asserted on the wall clock with a wide margin; a loaded machine
  tripped one anyway. They now block each request on a `threading.Barrier` sized to their number,
  which releases only when all of them are waiting at it *simultaneously* — the property under test
  stated exactly, with no clock in it. On the passing path there is no sleep at all, so the file
  runs in a quarter of a second instead of one and a half. Verified the hard way: reverting one
  route to `async def` turns it red again.
- **The history could stop saving and the screen kept saying it was saved.** `storing` was probed
  once at mount, and `available()` probes by writing **one byte** — which a browser at its quota
  still accepts. So the notice above the list went on promising the conversations would survive a
  reload while every real write, twenty-five transcripts' worth, was being refused. The write
  already reported failure; nothing read the answer. A refused write now latches, `storing` is the
  probe *and* that latch, and clearing the record resets it because the browser is no longer
  refusing. The list this session built stays on screen either way — a failed write is not a failed
  render — and the state it flips into is `history.unavailable`, which the drawer already renders in
  both languages (§7).
- **Every blocking Azure call was made on the event loop, and this app streams.** The BFF is
  asynchronous and every client it uses — the Azure SDKs, `httpx.get`, the Speech POST, Tavily — is
  synchronous. Run inside an `async def` handler, one of those owns the whole worker while it waits:
  a slow agent listing froze every SSE stream in flight and every live voice session with it. Seven
  sites, all of them on a path somebody waits on: `GET /agents` and its four siblings, `GET /trace`,
  `POST /speech`, `POST /tools/{name}/run`, the agent listing on **`POST /chat`** (every turn that
  names an agent), the Voice Live attachment, and — the longest of them — **executing the function
  tool itself**, in both `PromptAgentAdapter` and `VoiceSession._answer`. The adapter had already
  solved exactly this for *reading* the Foundry stream, with the measurement to prove it, and then
  called `search_web` inline. Routes whose work is blocking are now `def` (FastAPI's threadpool);
  the rest go through `asyncio.to_thread`. `TestClient` cannot catch this — it serves one request at
  a time — so the regression tests make several slow calls at once and time them
  (`backend/tests/test_concurrency.py`, `ai/tests/test_adapter_concurrency.py`).
- **Four closed tabs and voice was dead until the BFF restarted.** Nothing ever released a session
  nobody ended, so `MAX_SESSIONS` turned the leak its comment names — *a closed tab sends no
  DELETE* — into a wedge, with four control channels still open to a service that bills per second.
  The signal was already there and unread: the browser holds `GET /voice/session/{id}/events` open
  for the whole call, so that stream unwinding is the tab going away, and the session is released
  there; a session that is already closed no longer counts against the cap. A transient drop on
  that stream now ends the call too, which is said out loud — it is the safe direction when the
  alternative is a meter running that nobody can see. `backend/tests/test_voice_reaping.py` drives
  the streaming response's own iterator, because `httpx.ASGITransport` buffers a response whole and
  neither it nor `TestClient` can watch a client walk away from an endless stream.
- **The Quickstart's third command could not work, and three docs said it could.** `just infra` ran
  `azd up` in a directory with no `main.bicep` and no azd project, so the first provisioning step of
  the ten-minute Quickstart failed for everyone who ran it. `just down` had the same hole, and
  `gate-infra` ran `az bicep build` unguarded while `ci.yml` skipped that layer with a notice — so
  `just verify` was red locally on a layer CI called green, the four mirrors (§4, §6) disagreeing
  about what *done* means. All three now carry the CI guard: `gate-infra` **skips** exactly as CI
  does, and `infra`/`down` print the manual step and the two pages already recorded in
  `docs/REFERENCES.md` instead of dialling nothing. No IaC was invented to close this — that would
  be exactly the unverified infrastructure §5 forbids; the gap is now stated where the reader hits
  it, in `README.md`, `README.pt-BR.md` and `infra/README.md`.
- **The README drew a gateway the shipped configuration bypasses.** `agent_core.yaml` names a plain
  deployment on purpose (the comment has always said so), so inference does not pass through APIM —
  while the architecture diagram's amber box and the cost table read as though it did. Both READMEs
  now say it on the spot, and connect it to the two trace fields still pending.
- **Two stale paths and a stale model name.** The Quickstart pointed at
  `ai/harness/prompt-agent/agent.yaml` (the directory is `prompt_agent`), in both languages, and
  `infra/README.md` still named `gpt-5.4` where `.env.example` and `agent_core.yaml` say `gpt-5.5`.

### Changed
- **Constitution §8's table said the adapter may not loop; it always has.** `PromptAgentAdapter`
  loops over the *legs* of a turn — Foundry emits a function call and stops, so the outputs have to
  be submitted and the next leg read — capped at `DEFAULT_MAX_TURNS`. The distinction that makes
  that legal (a loop over the platform's own round trip, deciding nothing, reading nothing the model
  said) lived only in the adapter's docstring, and the *table* is what gets quoted in a review. The
  column is now "may it run the agent loop?", the row names the one bounded loop, and the amendment
  table records it. **No rule changed** — the rule now says what it always meant. `CLAUDE.md` and
  `AGENTS.md` moved with it (§6).

### Added
- **Spec 017 — a spoken answer no longer reads URLs out loud.** In voice, the agent used to finish a
  web-search answer by reading `https://www.sofascore.com/pt/football/team/corinthians/1957` slash
  by slash. It now answers and stops; the **written** chat still cites every URL, unchanged.
  - **The finding that cost the first design:** the agent cannot tell it is speaking. Put the rule
    in the agent definition (version 7) and the URL came out anyway; asked directly over a real
    audio turn, `gpt-5.5` answers *"Estou trocando texto escrito com você."* Voice Live transcribes
    before the model and synthesizes after it, so a rule conditioned on the modality is conditioned
    on nothing. Version 8 removed that rule again.
  - **What works:** the voice session sends one `conversation.item.create` with `role: system` when
    it opens, stating that the conversation is spoken. Accepted with a custom agent, where
    `instructions` is not. Proved by an A/B on the same agent version — same spoken question, item
    present vs. removed — committed as two fixtures, plus a text recording showing the written
    citations survived.
  - **This required amending the constitution**, which §8 forbade in its own words ("rewrites
    instructions at request time"). The exception is narrow and written down: one static sentence
    about the *transport*, once per session, no tool, no state, no reaction to model output — and
    it passes §8's own "would this still be true if the harness were swapped?" test. Tests assert
    the boundary rather than trusting it.

- **Spec 015 — a turn shows its steps when the model shows no reasoning.** Seven calls to
  `lookup_knowledge` used to render as seven identical rows under a card announcing that there was
  no reasoning summary. Each row now carries the **argument that distinguishes it** — the query, the
  timezone, the url — and its **ordinal in the turn**, assigned once in the turn state so the chat,
  the trace panel and the voice overlay all number the same call the same way (the overlay lists
  newest-first and still gets it right). The live line names the running step and times the current
  state, because the observed turn answered every call in about a millisecond and spent all its
  seconds on the model in between. Nothing here is invented: the ordinals and arguments are
  functions of the event log, and the clock is declared as the one thing that is not (§5).
- **Spec 016 — the agent speaks while it works.** A tool round trip used to be silent: the overlay
  filled with `search_web` rows for seven seconds while the agent said nothing, which sounds exactly
  like a broken session. The agent definition now asks for **one short sentence, in the user's
  language, before the work starts** — said once per turn, never naming a tool identifier out loud.
  The lever is the agent's instructions because it is the only legal one: `instructions` is
  unsupported on a Voice Live session with a custom agent, and having the BFF speak a filler would
  put words in the agent's mouth (§8). An instruction biases a model rather than compelling it, so
  the claim stands or falls on a recorded live turn — and it stands: **observed 2026-09-16 on agent
  version 6, in both modalities.** Text — *"Vou verificar na web e confirmar a data atual para
  identificar o jogo mais recente."* — then the calls. Voice — *"Vou verificar isso na internet
  agora."* — then the calls. Both recordings are committed
  (`prompt-agent-preamble-20260916.jsonl`, `voice-live-preamble-20260916.jsonl`) and the same
  assertion run against the 2026-09-15 recordings fails, which is what makes them a before/after.
  - **It narrates once per leg, not once per turn** — better than the instruction asked for: a turn
    that searches again after reading the first result opens the second leg with its own sentence,
    so every silence gets covered instead of only the first.

### Fixed
- **A healthy agent no longer reports itself unusable** (spec 031). `GET /agents/{name}` returns an
  `agent_endpoint` for **every** agent, and an unpinned one carries a `FixedRatio` rule naming the
  sentinel **`@latest`** rather than a version. The code read any rule as a pin, so it looked for a
  version called `@latest`, found none, fell to `status: unknown`, and rendered `foundry-live-agent`
  — enabled, eight active versions — as `version_not_active` and unselectable. Every agent, on the
  detail screen, against any real deployment. `_pinned_version` is now the one place a selector is
  read and the sentinel counts as no pin. Driven by the recorded payload, in
  `backend/tests/fixtures/agent-endpoint-20260920.json`.

### Changed
- **Three open questions closed, and one long-standing excuse withdrawn** (§10). Every unverified
  item since spec 031 was recorded as blocked on a broken `az`. The diagnosis named the wrong
  binary: the machine is arm64, `/usr/local` is the Intel Homebrew prefix, and a working, signed-in
  `az` was at `/opt/homebrew/bin` the whole time — first on `PATH` wins, and `DefaultAzureCredential`
  found the broken one. Reads made 2026-09-20 answered spec 031's endpoint question (above), gave
  spec 044 its image model (`FLUX-1.1-pro`, the project's only non-chat deployment, declaring no
  capabilities), and a doc read answered spec 045's blocking question: the Responses API does take
  file input, as `input_image` / `input_file` parts carrying a URL, a `data:` URI or a `file_id`.
  Spec 045 stays blocked — on retention, which is the operator's decision, not a document.
  Spec 020's AC16 and spec 033's chart question are unblocked as tooling and still open as
  measurements: both need turns actually run.

### Changed
- **The `Speak` toggle is off the header** (spec 008, parked). Beside `Voice` it read as a second
  way into the same thing, and on this deployment it was permanently disabled because the Speech
  resource is not configured — so it announced a fault rather than a feature. The feature itself is
  intact: the hook, the player and the BFF's `/speech` endpoint are untouched, and the acceptance
  criteria that ran through the button now run against the hook, so nothing rots while it waits.
  Remounting is one hook call and two props.
- **The reasoning card stops blaming the deployment.** It said the model emitted no summaries and to
  point the deployment at a reasoning model — while the deployment *was* `gpt-5.5` with
  `reasoning.summary` configured, spending reasoning tokens on the very turn that showed the message.
  It now says one line, scoped to that turn, and the agent definition asks for `summary: detailed`
  rather than `auto`, which on short tool-calling legs the model declines (spec 015, and the
  observation is recorded in `docs/REFERENCES.md`).
- **The default Portuguese voice is now `pt-BR-Thalita:DragonHDLatestNeural`** (spec 016), the HD
  tier, chosen by a listening test on 2026-09-16 — the one spec 012 recorded it had not run when it
  picked `pt-BR-Luana:MAI-Voice-2-Flash` from the documentation for latency. HD is slower to first
  audio; that trade is the point of the preamble above, and `VOICELIVE_VOICE` is the one-line way
  back. A test now fails if the code default and `.env.example` ever disagree (§4).
  - **Verified on the wire, not inferred** (2026-09-16): a live session against this project's own
    resource in eastus2 negotiated the HD voice **and produced audio frames with it**, which is a
    stronger claim than spec 012 could make — that one only ever saw the name echoed back, and a
    voice that is accepted but mute sounds exactly like one that works. The how-to's HD region list
    names `eastus`; eastus2 serves it anyway.
- **Spec 005 — the trace panel reads real spans.** `GET /trace/{response_id}` queries Application
  Insights with the BFF's own identity and the panel renders what comes back. The `otel trace id`
  stops being a promise and becomes a copyable id; the run gains a waterfall with a **real time
  axis**, which spec 014's bars deliberately could not have, because spans carry start offsets and
  the event stream does not.
  - **Three things the event stream never reported now show**: prompt-cache tokens (one measured run
    read 10 812 of 16 380 prompt tokens from cache), the duration of a Foundry-side MCP call — which
    the panel used to say "carries no duration", because the *stream* has none — and the exact model
    snapshot and agent version that ran.
  - **The waterfall's gaps are the argument.** A run whose tools this app executed shows the model
    call starting seconds in with nothing drawn before it, because Foundry traces only what Foundry
    runs. The tree says so in words, so the gap reads as constitution §8 and not as lost data.
  - **Four answers, not one.** `pending` (ingestion is staggered, so this is the common case and it
    offers a retry), `denied` (naming Log Analytics Reader), `failed` (with the reason) and
    `unavailable`. A checkout with no `APPLICATIONINSIGHTS_RESOURCE_ID` runs the entire app normally.
  - **No `gateway request id` field, by decision.** APIM emits at 100 % sampling into no destination,
    so no such id exists; the panel states that the run went through the gateway and the gateway did
    not record it, rather than showing a labelled empty box. No new Azure ingestion was enabled.
  - No `AgentEvent` change (§9): the trace id reaches the panel from the query, not the stream.
- **Tracing is connected, and the spike answered spec 005's open questions.** Application Insights
  is attached to the Foundry project; two runs were fired through the BFF and their spans read back
  out. Eight spans across three traces are recorded in
  `ai/tests/fixtures/recorded/appinsights-spans-20260916.jsonl`, and what they contain is written up
  in `docs/REFERENCES.md` and `docs/how-it-works/tracing-and-gateway.md`. Spec 005 moves from
  `blocked` to `clarified`.
  - **A client-side function tool leaves no `execute_tool` span.** A turn calling
    `get_current_datetime` — which the BFF runs — yields `invoke_agent` + `chat` and nothing else;
    the Learn MCP server yields an `execute_tool` span per call. Foundry traces what Foundry runs,
    so the span tree is a picture of §8, and the trace panel will have to say so or the gap reads as
    lost data.
  - **One turn with a function-call round trip is two OpenTelemetry traces**, one per leg, each with
    its own `gen_ai.response.id`. "One turn" is this app's idea, not the telemetry's.
  - **The join from a turn to its spans is `gen_ai.response.id`**, which carries the exact `resp_…`
    the `trace_ids` event already emits — so nothing has to be derived, and the harness needs no
    change. This is what unblocked the spec.
  - `gen_ai.tool.call.arguments` and `.result` are **absent** from every observed span although the
    docs list them; gateway correlation is still unavailable, because the APIM instance has no
    diagnostic settings.
- **Spec 014 — the trace panel becomes an instrument.** The surface that argues this project's
  central claim now carries its own argument. Every identifier is a copyable row; the run's model,
  tokens, reasoning tokens and latency sit in the panel rather than only in the chat's meta line;
  the head says which turn of the session is shown and steps between them without closing; and the
  calls sit on a fixed grid, so the executor tag — the column that carries the whole of §8 — starts
  at the same x on every row instead of ragged-edging down the list.
  - **`otel_trace_id` and `gateway_request_id` stop being invisible.** They are reserved for spec
    005, no harness emits them, and until now the frontend parsed them and dropped them in silence —
    which looks exactly like a bug. They are listed as pending instead, and the panel keys off
    presence alone, so the first harness to emit either renders it as an ordinary id with no
    frontend change (§5).
  - **The duration bars are not a waterfall, deliberately.** Their lengths are the `duration_ms` the
    `tool_result` events carried, relative to the longest call in the same turn. They are given no
    time axis, no gridlines and no start offsets, because the events carry durations and not a
    clock. The empty "Spans" heading is now one footer line saying where real spans come from.
  - No `AgentEvent` change (§9) and no harness change: everything rendered was already on `Turn`.

### Changed
- **One rule for the model's name (§4).** The shortening that turns a `<connection>/<model>` BYOM
  deployment into `gpt-5.5` lived inside `Sidebar`, so spec 014's panel rendered the raw name — four
  wrapped lines of `ai-admin2354ai223634534-project/gpt-5.5` beside a sidebar saying `gpt-5.5`, and
  the chat's meta line showed the raw name too. `modelName` now lives in `components/format.ts` with
  the other shared formatters, and all three callers use it.
- **An answer's markdown headings are chat headings, not page headings.** Unstyled, `h1` took the
  browser's 2em, so a section title inside a message rendered larger than the product name in the
  sidebar. The scale now starts just above body text and compresses fast.
- **The reasoning card recedes behind the answer.** It had the same white card the answer sits on
  and the two competed for first read; on the page's own ground with a dashed edge it reads as the
  note it is.

### Fixed
- **The tool-row grid did not actually align.** Each row is its own grid container, so `auto` tracks
  size to their own row and cannot agree across rows: a `bff` tag and a `microsoft_learn` tag started
  at different x, and an MCP call — which carries no duration — let its tag slide into the empty
  fourth column. The test written for this asserted that the CSS *declared* grid columns, which is
  mechanism rather than behaviour, so it passed against a layout that was still ragged; only a
  screenshot caught it. Both tracks now carry a floor, and because the chat's floors wrap
  `lookup_knowledge` over four lines inside a 320px panel, the floors are custom properties the panel
  lowers.
- **Keyboard focus was invisible everywhere.** 1425 lines of CSS contained no `:focus-visible` rule
  at all, and every control carries its own background — Dataside blue, ink, transparent-on-ink —
  against which the user-agent ring barely shows. One rule now covers every control, stated once.
- **Both modals claimed `aria-modal="true"` and honoured none of it.** The call reader and the voice
  card left focus on whatever opened them, let Tab walk out into the chat behind the scrim, and did
  not restore focus on close. `useModalFocus` is one hook for both (§4).
- **`.tool-row` transitioned on `var(--dur-2)`**, which the design system does not define, so the
  hover transition silently never ran. `layout.test.ts` now fails on any custom property that is
  neither defined in the design system nor given a fallback.
- **A stale copy of the backend's speech tests was being collected.** 16 Finder/iCloud conflict
  copies (`file 2.ts`) sat untracked in the tree; the frontend's were inert, but pytest's
  `test_*.py` matched `test_speech 2.py`, so seven tests ran twice against an older file. Removed,
  and `.gitignore` now catches the pattern. A `.nvmrc` and an `engines` floor pin the Node the
  project already requires — vitest 5 needs >= 22.12, and below it all 21 test files fail to start
  with an ESM stack trace that names nothing about the version.

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
