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
   **adapter** is imported by the BFF and contains no *agent* loop — only the bounded tool round
   trip Foundry's protocol requires, capped and deciding nothing (clarified 2026-09-20); the
   **agent** (`ai/harness/<name>/agent/`) is deployed to Foundry and may contain all the loop it
   likes — authoring an agent is not the app running one (amended 2026-09-16, spec 018). **One bounded exception**
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

**That record is searchable, and still never travels (spec 027).** The rail's field matches a
title, either role's message text, and the **names** of the tools and MCP servers a turn used — not
call arguments or outputs, which render as unreadable fragments. **Search makes no request at all**,
and a test asserts the absence. Spec 060 removed the `/history` screen **and its export/import** by
the owner's decision — the rail is the record's only surface, and an old `/history` bookmark lands
on the chat. Re-adding export would be a new spec, not a revert.

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
  follows it. The **listing** carries no `agent_endpoint` key at all — and it must stay one request
  (§4's cost, spec 030's verified property) — so the rail reports the *latest* version and the
  agent detail screen resolves the pin from `GET /agents/{name}`. That per-agent read was verified
  against the live service on **2026-09-20** and corrected the assumption underneath it: **every**
  agent carries an `agent_endpoint`, and an untouched one names the sentinel **`@latest`** rather
  than a version. So *having a selector* is not *being pinned* — only a rule naming a version is —
  and reading the sentinel as one made a healthy agent report `version_not_active`. `_pinned_version`
  and `LATEST_SENTINEL` are the one place that is decided. Promoting is
  **the app's only write**: `update_details` with one `FixedRatioVersionSelectionRule` at 100%,
  read from the SDK 2.6.0 typespec and **verified against the live service on 2026-09-20**: the call
  is accepted, and restoring to `@latest` is accepted *as a write*, so a rollback demonstration is
  reversible rather than one-way. It still ships off by default, and never was only because of that
  gap — the flag is a **permission** (`SECURITY.md`). Which role is the *minimum* is still unknown:
  the identity that verified it was Owner. Three gates, and only
  one is a permission: `FOUNDRY_ALLOW_VERSION_PROMOTE` (off), `OWNED_AGENT_NAMES` (this repo's own
  agents, from the harness `agent.yaml` files), and RBAC — the flag reveals a control, it cannot
  grant anything. The route takes **no body**, so no agent definition can travel on it, and the app
  records nothing about a promotion because it has no identity to record (see `SECURITY.md`).
- **Anything arriving in a URL is untrusted, and `GET /trace/{response_id}` proved it.** The id went
  into a KQL literal by `str.format`, and the query runs with the BFF's identity against a workspace
  holding prompts and tool arguments — with no sign-in in front of it. `ID_SHAPE` in `traces.py`
  **refuses** an id it does not recognise instead of escaping one; escaping is the part that gets
  subtly wrong. It is a bound on what this app hands a query engine, **not** a claim about Foundry's
  id format (§10). The same treatment is owed to anything else that reaches a query or a path.
- **Every Azure client in this app is synchronous, and that is an event-loop problem.** The BFF
  streams: one blocking call inside an `async def` handler stops the whole worker for its duration —
  every SSE stream in flight and every live voice session with it. So a route whose work is blocking
  is declared **`def`** (FastAPI runs it in the threadpool), and a blocking call inside something
  that must stay `async` goes through **`asyncio.to_thread`** — the agent listing on `POST /chat`,
  the tool executor in the adapter and in `VoiceSession._answer`. `TestClient` cannot see this
  (it serves one request at a time), so `backend/tests/test_concurrency.py` and
  `ai/tests/test_adapter_concurrency.py` assert it by making several slow calls at once and timing
  them.
- **An abandoned voice session used to keep its slot for ever.** A closed tab sends no `DELETE`, and
  `MAX_SESSIONS` turned that leak into a wedge: four of them and voice was dead on that process. The
  browser holds `GET /voice/session/{id}/events` open for the whole call, so **that stream unwinding
  is the tab going away** and the session is released there; a session that is already `closed` no
  longer counts against the cap. A transient drop therefore ends the call — the safe direction when
  the alternative is a metered socket nobody can see.
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
  read storage — which spells the key itself; that duplication is deliberate and tested. **Light is
  the default since spec 060** — nothing stored paints light, before first paint too. The rail
  **follows the theme since spec 060**: its own tokens (`--bg-rail`, `--fg-rail*`, `--border-rail`)
  are white in light and the deepest surface in dark, every pair computed in both palettes by
  `contrast.test.ts`; the switch in the rail footer writes the same preference Preferences does. Syntax highlighting maps
  **every** group `github.css` defines, including the unclassified ones, or text renders navy on
  navy. Every storage key lives in `state/storage.ts`'s `KEYS`, asserted.
- **What an agent is worth being asked lives in its definition (spec 037).** `examples:` in
  `agent_core.yaml`, bilingual, validated by `agent_spec.py`. The frontend holds **no** list: it
  renders the answering agent's row from `GET /agents` and derives nothing from the agent's tools,
  name or kind — that would be the app inventing a description of it — and nothing generates them,
  because the app never asks a model what to ask it (§8). **The service has no field for these**,
  so the BFF joins its rows against our own YAML by name and an agent we did not write carries
  none; "ours only" is a permanent limitation, not a gap.
- **The events are retained and watchable (spec 038).** `AgentMessage.events` keeps every normalized
  BFF SSE payload of a turn **whether or not the inspector is open** — opening it mid-turn must
  show the whole turn — capped at 2000 with `truncated` said out loud. They are `unknown[]`, not
  `AgentEvent[]`: the panel shows what crossed that wire without frontend type assumptions. It
  cannot show upstream Foundry frames the normalizer never emitted. **Absent** on a turn that never streamed (a replayed voice session, a restored
  conversation) — different from empty. The filter's vocabulary comes from `GET /config`; the only
  sanctioned mirror of the contract in the frontend is `types/events.ts`, and a test enforces it.
- **The voice overlay shows the session working, and one thing it refuses to show (spec 039).**
  No contract change: the data channel carries what was said and the session events carry what the
  agent did, so `useVoiceSession` already exposes both live. A running call shows **elapsed** (our
  observation, from `useElapsed`) while a finished one keeps its reported **duration** — two
  different numbers on purpose. **Interruption is deferred**: barge-in is configured, but no
  recorded session carries an event for it, and inferring it from silence would be a measurement we
  did not make (§5). Recorded in `docs/REFERENCES.md`.
- **The accessibility pass is a test, not a checklist (spec 040).** `a11y.test.tsx` renders the app
  on five screens and fails if **any** interactive control has no accessible name — so a control
  added three specs from now fails CI rather than shipping. `contrast.test.ts` computes the
  semantic text-on-surface pairs against **both** palettes and found two real failures in the light
  mapping (`--fg-3` at 4.38:1, `--fg-4` at 2.63:1), fixed by stepping the ramp. One polite live
  region says the answer is ready; the streaming answer is **never** in a live region, or it is
  read into the queue token by token. `document.lang` follows the interface language.
- **The agent's definition can be edited on screen, and nothing is saved (spec 041).** §8 would
  permit saving; **§4 refuses it** — `agent_core.yaml` exists so two copies of the instructions
  cannot drift, and a save creates the second copy. So `POST /agents/{name}/definition/proposal`
  validates through `agent_spec.py` and answers a **diff**, writing neither the file nor Foundry.
  Three care points: it resolves `extends:` to the file that actually declares `instructions:`
  — the shared core, so editing one agent's instructions edits **both**, and the screen says so; it
  labels the definition as **the one this build was made from**, never "the repository" or a branch;
  and it states drift before any editing. Instructions only — not tools, not the model. No PR
  creation: a second third-party secret for a convenience. A test asserts no string in the feature
  says *saved*, *updated* or *applied*, in either language.
- **One function tool can be run on purpose, outside any conversation (spec 042).** The
  Playground's Tools tab (`/playground/tools`, spec 060) posts
  to `POST /tools/{name}/run`, which validates with `jsonschema` against the registry's own schema
  and then calls **`tool_executor.execute`** — the same function every adapter gets, asserted by
  patching it rather than by reading the source. **Why this is not §8's forbidden thing: a person
  chose.** §8 forbids the *app* choosing a tool; what makes this safe is being visibly outside the
  conversation — no `conversation_id`, no model, nothing in the transcript, all asserted. Arguments
  are a **raw JSON field**, never a generated form: a form would be a second description of the
  schema and would hide that `arguments` is a string. `search_unavailable` renders verbatim — it is
  the tool's answer, not an error. Its **own** flag, off by default: an enabled playground spends
  `TAVILY_API_KEY` without authentication (SECURITY.md).
- **The voice can be chosen on screen, and only the voice (spec 043).** Spec 012's "no per-session
  choice" non-goal, revisited by a new spec rather than edited. The deployment **declares** the list
  (`VOICELIVE_VOICES`) — reading it from the service is a §10 question with no doc read — and the
  **BFF refuses** anything outside it, because a list the browser could step outside of is not a
  list. Blank declares nothing and no chooser renders, which is 012's behaviour unchanged. The
  choice is this browser's (spec 036's store), read at session **start**, and turn detection and
  noise suppression stay deployment configuration. Nothing here says anything to the model:
  §8's single bounded exception (spec 017) is spent and stays spent.
- **An image is text, and the app renders one but cannot make one (spec 044).** An image arrives as
  a **URL in `text_delta`** — the tempting wrong answer was a tenth `AgentEvent` spent transporting
  a URL that `text_delta` already carries (§9). The **generation half is deferred**: it would mean
  guessing an image model, an SDK call, an `api-version` and an output shape with nothing verified
  (§10), recorded in `docs/REFERENCES.md`. An `<img>` is **the one request in this app that does not
  go to the BFF** — a proxy would make the BFF fetch arbitrary URLs, which is worse — so it carries
  `referrerpolicy="no-referrer"`. Base64 cannot arrive: `react-markdown` sanitises `data:` away,
  measured rather than implemented. An undescribed image says it has no description; it never gets
  an invented one (§5).
- **The focus ring is the default, and the exceptions are named (spec 048).** Spec 040 stated it
  once as an **allowlist**, and its own comment described the trap it then fell into: a control
  added later inherits a ring "by belonging to the list rather than by remembering to style it".
  Belonging is remembering — **34 of 62** rendered control classes had drifted outside it, two of
  them added by the specs immediately before. So `*:focus-visible` draws it and three kinds of
  element opt out by name: the modal scrims (focus targets of last resort), `.main` (the skip
  link's landing, which would otherwise ring the whole conversation) and the composed fields whose
  **wrapper** carries `:focus-within`. The colour follows the **surface** — `.sidebar` and `.trace`
  redeclare `--fg-focus` — instead of a second list of sixteen selectors. Two things to carry: the
  bar is **3:1** (WCAG 1.4.11, non-text), not the 4.5:1 that applies to text; and a ring with a
  positive `outline-offset` is painted **outside** the control, so it is measured against the
  background behind it, never against the control's own fill — that error reported a blue ring on a
  blue button as 1.39:1 when it is 4.17:1.
- **The rail is never hidden; on a narrow screen it comes over the conversation (spec 047).**
  Below 760px the stylesheet used to say `.sidebar { display: none }`, and that was the entire
  narrow-screen story — which removed the **only** route to five of the seven screens, and removed
  it from the accessibility tree too, so a screen-reader user lost the navigation rather than
  finding it collapsed. Measured at 390px before: `scrollWidth` **594** against a 390px viewport,
  six controls visible with **two off the right edge**, one screen reachable. The fix is not a
  second navigation — it is the **same `Sidebar`**, translated off-canvas and brought back by a
  header control, so choosing an agent from a phone runs the handler the rail runs (§4). The header
  drops labels, never controls: the two pill buttons keep their icons and their `aria-label`, and
  the harness badge moves into the rail's footer **only while it is the overlay**, so spec 004's
  AC9 holds at every width without the badge appearing twice on a laptop. The floor is **320px**.
  And one rule worth carrying: **a base rule must be declared before the breakpoint that overrides
  it** — a media query adds no specificity, this trap bit three times across specs 020, 046 and
  047, and `layout.test.ts` now enforces it.
- **A token is held to the bar its content deserves, not the bar its name suggests (spec 046).**
  `--fg-4` was exempted at 3:1 as "captions, placeholders and disabled text" — but WCAG exempts
  *disabled controls*, and that sentence let **sixty-four** selectors accumulate on it, fifty-nine
  of them carrying content: a turn's cost, where an answer came from, a chart's axis labels. They
  moved to `--fg-3`; `--fg-4` keeps its 3:1 and its five genuinely disabled wearers, and an
  **allowlist in `contrast.test.ts` fails CI** when a sixtieth reaches for it — because the ratios
  were always computable and it was the *drift* no test could see. Text on the accent fill was
  guarded by nothing at all: `--bg-accent-strong` now carries the ~9 fills that have text on them,
  while `--ds-blue` stays the decorative fill for the ~10 that do not (non-text contrast is a
  different rule, and unmeasured here). Nothing was invented and the **vendored file is untouched**:
  the ramp has no step between `--ds-n-500` and `--ds-n-600`, so a raised `--fg-4` would have been
  `--fg-3` under a second name. Both questions were settled the same way — *split the token by the
  job it does*, never move a colour.
- **Two agents, one question, and no backend at all (spec 020).** The Playground's Agent tab
  (`/playground`, spec 060) sends the same text to two agents at once and draws two columns once a
  person picks a second agent; until then it asks the one. The tempting design was a transport — a multiplexed
  stream, or an agent id on every event (§9). It needed neither: `POST /chat` already takes `agent`
  per request and resolves the harness per request (spec 019), so a comparison is **two ordinary
  posts**, and the backend diff for the whole spec is empty. Two independent conversations (AC10)
  and independent failure (AC8) therefore hold *by construction* rather than by a rule. Each column
  is the same `Conversation` the chat uses, parameterised — a second copy of the turn rendering
  would drift within a release (§4) — which is also why **repeat and edit are absent** there rather
  than wired to no-ops: asking again would have to ask both, which is what the composer does. The
  one new thing is the **turn-id prefix** on `useAgentStream`: two instances both mint `turn_0`, and
  the trace panel, the event inspector and the log reader all address a turn by that id. **The app
  says nothing about which answer is better** — no score, no ranking — because that is one step from
  the app reading model output. **AC16 closed historically on 2026-09-20**: six recorded turns,
  one prompt and one hosted turn per probe. `docs/harness-comparison.md` carries the dated samples,
  not a benchmark or proof of what caused the latency; `docs/REFERENCES.md` records their provenance.
- **A question cannot carry a file, and that is a decision (spec 045).** Clarified and **blocked**
  on its own first question — does the Responses API accept file input beside a message, and how? No
  doc read, no credential to probe with, and three different designs wear the same name (§10). Two
  blockers are not documentation at all: it would add a fourth field to `POST /chat`, whose three
  keys `App.routing.test.tsx` pins deliberately to keep this browser's record out of Foundry's
  state; and **retention is the operator's decision**, which must precede an upload endpoint. In the
  meantime the composer is already a multi-line `textarea` (spec 023), so a log, a Bicep file or a
  CSV pastes today — a screenshot is the case that genuinely needs the answer.
- **A child of `.app` with no grid placement lands in an implicit row, and this has now cost two
  panels.** `.events` shipped as a 380px panel with no `grid-column`, so auto-placement put it under
  the rail inside a 248px track and the conversation collapsed — at 1440×900, with 1018 green tests,
  because jsdom lays nothing out. It is a column now (`--events`, the way `--rail` already worked),
  a drawer below **1542px** = 248 + **594** (the header's measured floor) + 320 + 380, and spec
  050's banner is `grid-column: 1 / -1; grid-row: 1` with `grid-template-rows: auto minmax(0, 1fr)`
  on the shell. `layout.test.ts` asserts every one of those. **Anything added as a direct child of
  `.app` is either placed or `position: fixed`** — the overlays (`.log-scrim`, `.voice-scrim`) take
  the second route.
- **Two sources can share a label and still be two sources (spec 034).** The Learn MCP answers one
  search with the same page under several `#anchors`; `labelFor` is host + path, so four distinct
  URLs collapse to one label. Deduping on the URL therefore kept all four and the row key
  `callKey:label` collided — React's *"children may be duplicated and/or omitted"*, against the
  recorded turn. `identify()` in `state/sources.ts` is the one place sameness is decided (a page,
  fragment dropped) and `Source.id` is what the row keys on, so the list and the view cannot
  disagree about what two sources are (§4).
- **The Playground is one screen, and it absorbed two (spec 060).** `/playground` is the answering
  agent's definition beside a conversation — `AgentDefinitionBlocks`, the **same** rendering the
  agent detail screen uses, from the same `GET /agents/{name}` read, read-only because Foundry
  refuses per-request parameters beside an agent reference and §4 refuses a saved copy.
  `/playground/tools` is spec 042's runner; with its flag off the tab **says so** rather than
  vanishing. `/compare` and `/tools` still *parse* to it and are never *built*, so the address bar
  settles on the canonical form. The command palette (spec 025) is **gone**, chord and button: every
  binding left has a visible control, and no key interrupts typing. Tabs use no arrow keys, because
  `keys.ts` is the one place a key is named.
- **A screen with no door is an absent screen, and a listed action needs one id.** Spec 042's
  `/tools` parsed, rendered, and was reachable only by typing the URL — its own plan named
  `Sidebar.tsx` and only the `View` type arrived. Spec 038's `toggleEvents` sat in `BINDINGS` *and*
  in `EXTRA_ACTIONS` ("actions that no key names"), so the palette listed it twice under one id.
  Both are the same habit: when a spec adds a surface, the route into it is part of the surface.
- **The demo replays; it never pretends (spec 050).** `just demo` runs the whole app with no Azure
  credential by composing `create_app` against `ai/tests/fixtures/recorded/` — the same recordings
  the contract tests replay, through the same normaliser, so a replayed turn earns §9 rather than
  being excused from it. Three rules hold it honest. It is a **separate entrypoint**
  (`app.demo:create_demo_app`): `create_app` does not import `app.demo` and a test walks the import
  graph, because a flag would let a mistyped variable make a real deployment serve a recording as a
  live answer. `GET /config` carries `demo` **absent, never false**, and the banner it drives has no
  dismiss control. And the demo says out loud that the answer does not depend on the question —
  a recording has one answer. The hosted recording is deferred with its reason: the two harnesses
  normalise different raw streams and one `stream_factory` seam cannot tell which adapter is
  calling, so the listing carries `demo_not_recorded`, which is not `no_harness`.
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
- **One source of truth (§4)** — the three function tools are implemented **once** in
  `ai/harness/_shared/tools/` and shared by every harness.
- **Honesty (§5)** — fixtures are recorded from real runs, never hand-written to make a test pass.
  `ai/harness/langgraph/` implements the hosted agent; its recorded telemetry limits are explicit.
  Unverifiable infrastructure is documented as a manual step, not shipped as unverified IaC.
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
  the Voice Live session lifecycle · hosted continuity · charts in answers.
- `docs/assets/message-journey/` — the source of the README's "follow one message" GIFs
  (`journey.html`, bilingual) and `record.mjs`, which regenerates them; move it with the code it cites.
- `docs/REFERENCES.md` — every Foundry doc URL and API version relied on (§10).
- `docs/development-workflow.md` — SDD + TDD, the contributor companion to the constitution.
- `docs/learning-journey.md` ↔ `docs/learning-journey.pt-BR.md` — educational modules, evidence and
  publication checklist; baseline #32 is integrated, local checks recorded, final browser captures pending.
