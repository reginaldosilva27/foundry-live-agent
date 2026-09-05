# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

### Fixed
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
