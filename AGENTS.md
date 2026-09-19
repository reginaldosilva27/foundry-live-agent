# AGENTS.md

This file provides guidance to **OpenAI Codex** (and any other AI coding agent that reads
`AGENTS.md`) when working in this repository.

> **Twin of [`CLAUDE.md`](CLAUDE.md) — keep them in sync.** This project has one set of
> guidelines with two front doors: `CLAUDE.md` for Claude Code, `AGENTS.md` for Codex. They say
> the same thing on purpose. **If you change a rule in one, change it in the other in the same
> commit.** The non-negotiable source of truth above both is
> [`.specify/constitution.md`](.specify/constitution.md) — the constitution wins on any conflict.
> Codex-runnable workflows live in [`.codex/prompts/`](.codex/prompts/).

## What this is

**foundry-live-agent** — an open-source reference implementation of **Microsoft Foundry Agent
Service** end to end. A full-stack chat and voice application built *around* an agent that runs
*inside* Foundry, with **swappable agent harnesses** behind one contract. It is a runnable project
and teaching material for the Brazilian data/AI community.

The architecture record is [`PLAN.md`](PLAN.md); the law is `.specify/constitution.md`.

## How we build here — SDD + TDD (non-negotiable)

This project is **spec-first** and **test-first**, even when the user does not ask for it. Two
documents govern this:

- **`.specify/constitution.md`** — the non-negotiable principles + quality gates + amendment process.
- **`specs/README.md`** — the workflow: `specify → clarify → plan → tasks → implement (TDD) → verify`.

### New feature → write a spec first (stop and do this)
When the user asks for a new feature or a behavior change, **do not jump to code** — and **if the
user skipped it, remind them** before writing any code (the `.codex/prompts/new-spec.md` prompt
automates this):

1. Copy `specs/_template/` to `specs/NNN-feature-name/` (zero-padded, sequential).
2. Fill `spec.md` — WHAT + WHY + numbered, **testable** acceptance criteria. No implementation detail.
   Resolve every open question ("clarify", `/grilling`) before planning.
3. Fill `plan.md` — HOW: approach, affected files, contract/data/i18n impact, test strategy (AC → test).
4. Fill `tasks.md` — ordered TDD checklist; each implement task preceded by its failing test.
5. Implement red → green → refactor, checking boxes; move the spec's status along
   (`draft → clarified → planned → in-progress → done`).

### TDD always
Acceptance criteria (feature) or a reproducing case (bug) become a failing test first; then code makes
it pass; then refactor. Tests assert behavior, not implementation detail.

### Does this change need a spec?

| Change | Spec? | TDD? |
|---|---|---|
| New feature, new user-facing behavior, any public contract/schema change | **Yes** | Yes |
| **Any change to the `AgentEvent` set** (§9) | **Yes, always** | Yes |
| Bug fix · small adjustment · behavior-preserving refactor | **No** | **Yes** — regression test first |
| Docs · comments · formatting · dependency bumps · pure chores | No | n/a |

**Gray-zone rule:** when unsure, write the spec.

### Done means the gates are green
Run the `.codex/prompts/verify-gates.md` checklist before declaring anything done.

## Commands

> Keep identical to `CLAUDE.md` (§6).

```bash
# backend/ — Python (FastAPI BFF)
ruff check . && ruff format --check . && pytest -q

# ai/ — Python (harnesses, agent definitions, tools)
ruff check . && pytest -q

# frontend/ — React + TypeScript + Vite
npm run lint && npm test && npm run build

# infra/ — Bicep + azd (NOT Terraform)
az bicep build --file main.bicep && az bicep lint --file main.bicep
```

`just` recipes delegate to exactly these commands. The command set lives in the constitution's
*Quality gates*; `ci.yml`, both `verify-gates` twins and the `justfile` mirror it (§4).

## Architecture — the load-bearing ideas

> **The agent runs in Foundry. This repo is the app around it.** If you remember one thing, that.

```
Browser ──SSE──> FastAPI BFF ──Responses API──> Foundry prompt agent ──> Microsoft Learn MCP
   │                  │                              │
   │                  └── executes function tools ◄──┘  (Foundry asks; the BFF answers)
   └──WebRTC audio───────────────────────────────> Voice Live (same agent, no gateway)
```

**Layers.** `backend/` (BFF) · `ai/` (harnesses + tools) · `frontend/` (React) · `infra/` (Bicep+azd).

**The three invariants you must not break** (constitution §8–§10):

1. **§8 — no agent loop in the app.** `backend/` and `frontend/` never choose *which* tool to call,
   re-prompt the model, loop on model output, or duplicate state Foundry owns. Executing a function
   tool Foundry asked for, and submitting its output, is the documented client-side contract and is
   fine. Test: *"would this still be true if the harness were swapped?"* Inside a harness, the
   **adapter** is imported by the BFF and contains no loop; the **agent** (`ai/harness/<name>/agent/`)
   is deployed to Foundry and may contain all the loop it likes — authoring an agent is not the app
   running one (amended 2026-09-16, spec 018). **One bounded exception**
   (amended 2026-09-16, spec 017): a voice session states one static fact about the transport — that
   the conversation is spoken — because the agent cannot perceive it and `instructions` is
   unsupported with a custom agent. One item, one sentence, once; not a licence to prompt.
2. **§9 — `ai/harness/_shared/contract.py` is the boundary.** Every harness emits only
   `reasoning_summary · text_delta · tool_call · tool_result · mcp_call · usage · trace_ids · error ·
   done`; the BFF and frontend consume only those. Contract tests are parameterised over adapters, so
   a new harness proves itself against the existing suite without editing it.
3. **§10 — no Foundry API from memory.** Foundry changed substantially through 2026 and training data
   is unreliable about it. Every SDK version, endpoint, `api-version`, event name and RBAC role comes
   from a doc read at the time of writing and recorded in [`docs/REFERENCES.md`](docs/REFERENCES.md).
   Unconfirmable values are verified against the live service and recorded as fixtures, or marked as
   open questions — never guessed silently.

**The browser keeps a drawing, never the conversation (spec 021).** `localStorage` holds up to 25
past conversations — the frames this browser already rendered — beside Foundry's `conversation_id`
for each, plus the rail's collapsed flag and the starred agent **names** (spec 022, resolved against
`GET /agents` on every render so a favourite never outlives the listing). Reopening one restores the drawing *and the pointer*, so
the next turn continues that Foundry conversation. Three rules make that legal under §8, and each
is a test: it never travels (`POST /chat` stays `message · conversation_id · agent`), nothing
derives a decision from it, and Foundry stays the owner. A conversation's title comes from the first
thing the person typed — **never** from asking a model to name it, which would be the app running
inference of its own. The agents listing now lives on its own screen; the rail keeps only the agent
that is answering.

**That record is searchable and portable, and still never travels (spec 027).** The rail's field and
the `/history` screen match a title, either role's message text, and the **names** of the tools and
MCP servers a turn used — not call arguments or outputs, which render as unreadable fragments.
`/history` exports one conversation as Markdown or the whole record as versioned JSON (the stored
shape verbatim, trace ids included — they are what tie a transcript to spans in the workspace), and
imports one back. Three things are easy to get wrong here:

- **`frontend/src/state/history.ts` owns the stored shape and the exported one together** (§4). The
  file carries a `version`; one this build does not know is refused whole, record untouched.
- **Import writes the file's `conversation_id` verbatim and asks Foundry nothing.** Checking whether
  it exists would be the app deriving a decision from its own storage (021's second rule). A pointer
  from another tenant fails through the turn-error card that already exists — no second failure mode.
- **Search and import make no request at all**, and a test asserts the absence.

**Which agent answers is chosen on the screen (spec 019).** The sidebar lists the project's agents
from `GET {project_endpoint}/agents?api-version=v1` and a turn carries `agent` on `POST /chat`.
Three rules that are easy to break:

- **`build_harness` is per request.** `app.state.harness` is the **default** and is never mutated —
  a process-global swap would let one browser's choice change another's turn. The credential and
  project client live in `AzureClients`, built once per process, so a per-turn adapter stays cheap.
- **`HARNESS_FOR_KIND` in `harness_factory.py` is the only place kind → harness is decided.** The
  screen's `selectable`/`reason`, the row's `harness` badge and the factory all read it. A copy in
  TypeScript would be the §4 violation.
- **The BFF ships no user-facing prose here.** A row that cannot be chosen carries a *code*
  (`no_harness` · `disabled` · `version_not_active`) and the frontend says it in `en`/`pt` (§7).

Letting a *person* choose is configuration, not an agent loop (§8). The app choosing would be the
violation.

**Non-obvious facts that bite** (all cited in `docs/REFERENCES.md`):

- The Assistants API is gone. It's **Responses API (Agents v2)**: Conversations/Items/Responses/Agent
  Versions. SDK `azure-ai-projects>=2.3.0` (2.x, **incompatible with 1.x**), `api-version=v1`.
- **Function calling cannot live in a Toolbox** — it is client-side execution by definition.
- **A function call Foundry emits must be answered or the run hangs and expires after 10 minutes.**
- **Both legs of that round trip must name the same `conversation`.** The output leg carries only
  `function_call_output` items; unbound, Foundry answers `400 — No tool call found for function
  call output with call_id …`.
- Foundry's own `agent.yaml` is **deprecated**; ours (`ai/harness/*/agent.yaml`) is our schema,
  labelled as such.
- **Voice Live never passes through the AI Gateway**, and the gateway does not log tool traces.
- **A tool round trip is silent, and only the agent definition can fill it.** `instructions` is
  **not supported** on a Voice Live session with a custom agent, so how the agent behaves during a
  turn — including the spoken preamble before a tool call (spec 016) — is changed in
  `ai/harness/*/agent.yaml` and applied, never per session and never by the BFF speaking for it.
- **The agent does not know it is speaking.** Voice Live transcribes before the model and
  synthesizes after it; asked over real audio, `gpt-5.5` answers *"Estou trocando texto escrito com
  você."* So an instruction conditioned on the modality is conditioned on nothing — that is why the
  voice session sends one `role: system` context item saying so (spec 017), the single **bounded**
  exception §8 carries.
- **The agents listing carries the whole definition (spec 030).** `GET {project_endpoint}/agents`
  returns each agent's `instructions`, `model`, `tools` and `reasoning` — for the agents this repo
  never created too — so the inspector needs no per-agent call. A **hosted** agent's definition has
  none of those: it is a container (`image`, `cpu`, `memory`, `protocol_versions`). Two rules there:
  the BFF **drops `environment_variables`** rather than filtering them in the view (the real listing
  holds a `KEY_VAULT_URI`), and `null` — the service said nothing — stays distinct from `""` — the
  service said nothing *in it* — because five of ten agents really do have empty instructions.
- **The newest version is not the served version, and this app can now change which is (spec 031).**
  An agent endpoint pins a version through `agent_endpoint.version_selector`; `served_version()` in
  `backend/app/agents.py` is the only place that distinction is decided, and `version_not_active`
  follows it. The recorded listing has **no `agent_endpoint` key at all**, so the correction ships
  dormant — and the **listing must stay one request** (§4's cost, spec 030's verified property), so
  the rail reports the *latest* version and the agent detail screen resolves the pin. Promoting is
  **the app's only write**: `update_details` with one `FixedRatioVersionSelectionRule` at 100%,
  read from the SDK 2.6.0 typespec and **not verified against the live service** — recorded as an
  open item in `docs/REFERENCES.md`, which is why it ships off by default. Three gates, and only
  one is a permission: `FOUNDRY_ALLOW_VERSION_PROMOTE` (off), `OWNED_AGENT_NAMES` (this repo's own
  agents, from the harness `agent.yaml` files), and RBAC — the flag reveals a control, it cannot
  grant anything. The route takes **no body**, so no agent definition can travel on it, and the app
  records nothing about a promotion because it has no identity to record (see `SECURITY.md`).
- **`GET /config` has a screen now, and it is drift-tested (spec 032).** `/about` renders every
  top-level field the endpoint returns — including the event-mapping report, which is §10 in numeric
  form. **Adding a field to `GET /config` and not rendering it fails CI**: `About.coverage.test.ts`
  reads `backend/app/routers/config.py` and compares it with `COVERED_CONFIG_KEYS` in
  `frontend/src/panes/aboutFields.ts`. The panel is read-only *by construction* — no control, no
  request of its own, asserted — and the browser's preferences deliberately live elsewhere: one is
  what the deployment decided, the other is what this browser keeps. `absent` and `false` render
  differently there, because a BFF that never mentioned a field and a deployment that switched it
  off are different facts (§5).
- **A chart is text the agent wrote, never a decision the app made (spec 033).** The agent writes a
  fenced **`foundry-chart`** block (JSON) or a `mermaid` block and the frontend renders it — the
  same category of work as the Markdown around it, so §8 holds and any harness emitting the same
  text draws the same picture. The app must never inspect an answer to decide to chart, and
  `Chart.tsx`'s import list is asserted to prove it cannot. The schema's source of truth is
  `frontend/src/state/chart.ts`, and the **worked examples in `agent_core.yaml` are its test
  fixtures** (§4). Closed set: `bar` and `line`, **at most four series** — the palette was
  *validated* for four hues all-pairs and no fifth passed, so a fifth series is refused rather than
  folded into an "Other" the agent did not ask for (§5). `react-markdown` renders an unclosed fence
  identically to a closed one, so `Markdown.tsx` counts fence markers itself or a half-arrived block
  would flash a chart. Mermaid is **dynamically imported**; a static import anywhere in `src/` is a
  test failure.
- **What an answer consulted comes from events, never from its prose (spec 034).** The Sources strip
  under a settled turn is built from `mcp_call`/`tool_result` in `frontend/src/state/sources.ts`,
  and a test asserts that module never reads the answer text. **One reader per tool, because the
  shapes really differ**: `microsoft_learn` puts the URL in **`contentUrl`** inside a string holding
  *two concatenated JSON documents*; `search_web` uses `url`; `lookup_knowledge` has no URL at all,
  only a repository path, which renders as a path and never as a link. A generic URL scan lists
  pages the agent never opened (§5), so the tests are driven by the **recorded** payloads. `callKey`
  in `state/turn.ts` is the single home for how a call is addressed.
- **Code blocks and tables carry their own controls (spec 035).** `Markdown.tsx` overrides `pre`
  (not `code` — `<pre>` takes phrasing content only, so the header must sit outside it) and `table`.
  A chart or diagram fence is passed through untouched, decided by the child's **className**: by the
  time `pre` renders, its child is an element of the `code` override, so `node.type` is that
  function rather than `'code'`. A table copies as **TSV**, because this is the clipboard and a
  spreadsheet pastes TSV straight into cells; a cell containing a tab, newline or quote is quoted
  with inner quotes doubled, or one line break silently shifts every column after it. No control
  offers Markdown — the answer actions already copy `turn.text` verbatim (§4). Controls key off the
  **turn** being settled, not off the fence closing.
- **Two themes, and the mapping is ours (spec 036).** A colour literal may only appear in the
  **vendored** `public/ds/colors_and_type.css`; `app.css` names tokens and never values, and
  `layout.test.ts` asserts it. Light is the base `:root` declaration, `[data-theme='dark']` is an
  explicit choice, and the `prefers-color-scheme` block is guarded by `:not([data-theme='light'])`
  so an explicit light choice survives a dark system; `system` **removes** the attribute rather
  than writing one. The first paint needs a six-line inline script in `index.html` — CSS cannot
  read storage — which spells the key itself; that duplication is deliberate and tested. The rail
  does not invert: it becomes the deepest surface in an elevation stack. Syntax highlighting maps
  **every** group `github.css` defines, including the unclassified ones, or text renders navy on
  navy. Every storage key lives in `state/storage.ts`'s `KEYS`, asserted.
- **What an agent is worth being asked lives in its definition (spec 037).** `examples:` in
  `agent_core.yaml`, bilingual, validated by `agent_spec.py`. The frontend holds **no** list: it
  renders the answering agent's row from `GET /agents` and derives nothing from the agent's tools,
  name or kind — that would be the app inventing a description of it — and nothing generates them,
  because the app never asks a model what to ask it (§8). **The service has no field for these**,
  so the BFF joins its rows against our own YAML by name and an agent we did not write carries
  none; "ours only" is a permanent limitation, not a gap.
- **Two fields of `usage` are breakdowns, not additions (spec 028).** `reasoning_tokens` is part of
  `output_tokens` — the service bills it as output — and `cached_input_tokens` is part of
  `input_tokens`. Reading either as an addition gives a cost estimate that looks plausible and is
  roughly double the truth. Measured, not assumed: `total_tokens == input_tokens + output_tokens` in
  every recorded turn. Foundry also **sends the cache on the stream** (`input_tokens_details.cached_tokens`),
  so it is not spans-only — and the Responses API spells it `input_tokens_details` while Voice Live
  spells it `input_token_details`, singular. Each normaliser reads its own; a shared reader finds
  `None` forever and never fails.
- **This repository ships no prices.** Rates come from the operator's environment through
  `GET /config`, with the date they were read; no rate literal may exist in `frontend/`, and
  `noPriceLiterals.test.ts` is the tripwire. Unconfigured is the default and renders **no money at
  all** — never a zero, which would claim a turn was free.
- **Reasoning summaries are configured on the agent definition, not per request.** Sending
  `reasoning` alongside an `agent_reference` is rejected: *"Not allowed when agent is specified."*
  Without it the card is empty forever, though the model still spends reasoning tokens. And
  `summary: auto` is not enough — on short tool-calling legs the model declines to summarise, so the
  definition says `detailed`. A turn with no summary is a normal state the UI must survive (spec
  015), never evidence of a misconfigured deployment.
- **`response.mcp_call.completed` carries no `item`** — only `item_id`. Read the MCP call from
  `response.output_item.done`. Same for function calls: `…arguments.done` has `name: null`.
- **Foundry completes the leg it is waiting on**, so a turn with a tool round trip contains two
  `response.completed` events. Usage must be summed and `done` held back, or the contract breaks.
- **Voice Live attaches with `agent_name` + `agent_project_name`** — *not* `project_name`, which the
  quickstart documents and the service rejects. The SDP field is `sdp_offer`, and the WebRTC control
  endpoint exists **only** on `api-version=2026-01-01-preview`.

## Working style — behavioral guardrails

> Behavioral nudges (bias toward caution over churn), not CI-gated. The constitution (§1–§10) is
> the law above them. Mirror of CLAUDE.md (§6). _(Adapted from Andrej Karpathy's coding guidelines.)_

- **Simplicity first.** Minimum code that solves the problem — nothing speculative: no unrequested
  features, no abstraction for single-use code, no configurability nobody asked for, no error
  handling for impossible states. If 200 lines could be 50, rewrite it.
- **Surgical changes.** Touch only what the request requires; match the surrounding code; don't
  refactor what isn't broken. Remove only the orphans **your** change created; pre-existing dead
  code you mention, not delete. Every changed line traces to the request.
- **Think before coding.** State assumptions; surface multiple interpretations instead of silently
  picking one; push back when a simpler approach exists. For spec ambiguity, that's `/grilling`.

## Conventions

- **SDD + TDD are mandatory** (see "How we build here"), even when the request doesn't mention it.
- **One source of truth (§4)** — the two function tools are implemented **once** in
  `ai/harness/_shared/tools/` and shared by every harness.
- **Honesty (§5)** — fixtures are recorded from real runs, never hand-written to make a test pass.
  `ai/harness/langgraph/` is a scaffold and says so. Unverifiable infrastructure is documented as a
  manual step, not shipped as unverified IaC.
- **Agent guidance in sync (§6)** — `CLAUDE.md` ↔ `AGENTS.md` ↔ `.claude`/`.codex` workflows.
- **Bilingual (§7)** — user-facing strings ship `{ en, pt }`; `README.md` ↔ `README.pt-BR.md`.
- **Code and comments in English.** Docs in English; the README is mirrored in Portuguese.
- **Zero secrets for Azure.** Entra ID via `DefaultAzureCredential` for every Azure service;
  `.env.example` holds placeholders only; the browser never holds a credential of any kind.
  **One documented exception:** `TAVILY_API_KEY`, behind the `search_web` tool — a third-party
  service with no Entra path, read by the BFF process only (spec 013). A key for an **Azure**
  service is still a design smell; adding a second third-party one means saying why, where the
  reader will hit it, as `.env.example` does.

## Docs

- `PLAN.md` — the architecture record and phase→spec map.
- `docs/architecture.md` — what runs in Foundry vs. in this app (kept in sync with the code).
- `docs/harness-comparison.md` — prompt agent vs. hosted agent, **measured** (spec 018).
- `docs/how-it-works/` — streaming events · the function-call round trip · tracing and the gateway ·
  the Voice Live session lifecycle.
- `docs/REFERENCES.md` — every Foundry doc URL and API version relied on (§10).
- `docs/development-workflow.md` — SDD + TDD, the contributor companion to the constitution.
