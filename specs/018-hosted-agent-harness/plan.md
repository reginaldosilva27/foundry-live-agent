# Plan: The second harness — a LangGraph graph running as a Foundry hosted agent

> The HOW. Written after `spec.md` is `clarified`. Decisions here must respect every
> principle in `.specify/constitution.md`; if one must bend, amend the constitution
> first and note it.

## Approach

Three pieces, in dependency order. The first two are new code; the third is what makes the spec
worth having.

**1. The agent — a container Foundry runs.** `ai/harness/langgraph/agent/` holds an explicit
`StateGraph` (`agent` → `tools` → `agent`, conditional edge on whether the last message carries tool
calls, **no checkpointer**), served by `ResponsesHostServer(graph).run(port=int(os.environ["PORT"]))`
from `langchain-azure-ai[hosting]`. It calls the model through `FOUNDRY_PROJECT_ENDPOINT` /
`FOUNDRY_MODEL_NAME`, which the platform injects. Its four tools are the repo's existing ones:
`get_current_datetime`, `lookup_knowledge`, `search_web` imported from
`harness._shared.tools.registry` and wrapped as LangChain tools by a ten-line adapter, plus
`microsoft_learn` as an **MCP client the container owns** (`langchain-mcp-adapters` against
`https://learn.microsoft.com/api/mcp`). The Docker build context is `ai/`, so `_shared/` is
**copied into the image, not vendored** (AC6) — one implementation, two processes.

**2. The adapter — a thin Responses client.** `ai/harness/langgraph/adapter.py` stops raising and
becomes the narrowest thing that can satisfy the Protocol: open a stream against
`{project_endpoint}/agents/{name}/endpoint/protocols/openai/responses`, convert each raw event,
yield. **There is no loop** — the container answers its own tool calls, so nothing comes back for
the BFF to execute, and `PromptAgentAdapter`'s multi-leg machinery has no counterpart here. That
asymmetry *is* the harness difference; flattening it would be the `interrupt()` route the spec
rejected.

**3. Observation before normalisation.** §10 and the scar spec 002 left say the same thing: we do
not know what a `ResponsesHostServer` stream looks like on the wire. So the order is **deploy →
record → test → implement**, not the reverse. `ai/scripts/spike_hosted.py` drives one live turn per
shape (Learn question, function-tool question), writes the raw stream to
`ai/tests/fixtures/recorded/`, and `ai/harness/langgraph/events.py` is written to satisfy assertions
made *about those recordings*. Its `MAPPINGS` table carries the same `verified` flag discipline as
`prompt_agent/events.py`, so the inference that remains is visible rather than assumed.

### The one source of truth for behaviour (AC5)

Both harnesses must run the same model, the same instructions and the same tool set, and a **test**
— not a reviewer — must catch drift. Two files with the same prose in them is exactly what §4
forbids, so the prose moves out of both:

```
ai/harness/_shared/agent_core.yaml     # model · instructions · the four tool entries  ← the fact
ai/harness/prompt_agent/agent.yaml     # extends: ../_shared/agent_core.yaml  + reasoning
ai/harness/langgraph/agent.yaml        # extends: ../_shared/agent_core.yaml  + hosted: {…}
```

`load_agent_spec` gains one key, `extends:`, that shallow-merges the referenced file underneath the
local one. That is the whole feature: no inheritance chains, no overrides of list members. A parity
test then asserts the two loaded specs agree on `model`, `instructions` and the set of tool names —
belt and braces, and the assertion that fails loudly if someone ever re-inlines the prose.

**`microsoft_learn` stays in the shared core** even though the two harnesses reach it differently.
It is the same tool, with the same name, in the same instructions; *who is the MCP client* is a
deployment fact, and it belongs in the harness's own file. The prompt agent's `agent.yaml` declares
the MCP server to Foundry; the container's `agent.yaml` carries a `hosted:` block and the container
reads the same `server_url` from the core to build its own client.

### Sizing and deployment config (AC11, AC8)

The `hosted:` block in `ai/harness/langgraph/agent.yaml` is the single place the three AC11 values
are written:

```yaml
hosted:
  protocol: responses
  cpu: 1
  memory_gib: 2
  idle_timeout_minutes: 15
```

Microsoft's `azure.yaml` is **generated** from `agent.yaml` by `ai/scripts/build_hosted_config.py`
and committed next to it. A test runs the generator and asserts the committed file matches, so the
two cannot drift and AC8's "register from committed configuration" still holds — the reader runs
`azd provision && azd deploy` against a file that is in the repo. `apply_agent.py` grows a branch:
for a harness with a `hosted:` block it does **not** call `create_version` (that is a prompt-agent
API); it prints the `azd` steps and the generated config, because a script that pretends to have
deployed a container would be exactly the dishonesty §5 names.

### The agent's name

The hosted agent cannot share a name with the prompt agent in the same project. Rather than add an
env var that can disagree with the definition, the langgraph harness takes its name from its own
`agent.yaml` (`name: foundry-live-agent-hosted`) — the definition already *is* the source of truth
for the agent's identity. `AGENT_NAME` stays the prompt agent's override and is untouched. Spec 019
generalises selection; this spec deliberately does not.

### What we will not know until we measure

Four things, each with an AC that forces the answer to be recorded rather than assumed:
whether hosted turns emit reasoning summaries (AC13), whether Voice Live attaches to a hosted agent
(AC9), what a hosted-agent trace looks like in App Insights (AC10), and whether the Key Vault
connection can be provisioned from this repo at all (AC7). Each resolves into a dated line in
`docs/REFERENCES.md` and a fixture or a documented manual step — never a guess.

## Affected files

**New — the agent (container):**

- `ai/harness/langgraph/agent/graph.py` — the `StateGraph`: `agent` → `tools` → `agent`, no checkpointer.
- `ai/harness/langgraph/agent/tools.py` — wraps `harness._shared.tools.registry` specs as LangChain tools + the Learn MCP client. No tool logic (§4, AC6).
- `ai/harness/langgraph/agent/host.py` — entrypoint: `ResponsesHostServer(graph).run(port=...)`.
- `ai/harness/langgraph/agent/Dockerfile` — build context `ai/`; copies `harness/_shared/` and `harness/langgraph/`.
- `ai/harness/langgraph/agent/requirements.txt` — `langchain-azure-ai[hosting]>=1.2.9`, `langgraph`, `langchain-mcp-adapters`, plus this repo's `ai` deps.
- `ai/harness/langgraph/azure.yaml` — **generated**, committed, drift-tested.

**New — the harness (BFF side):**

- `ai/harness/langgraph/events.py` — hosted Responses stream → `AgentEvent`, with a `MAPPINGS` table and `verified` flags, written against the recordings.
- `ai/harness/langgraph/agent.yaml` — `extends:` the core + `hosted:` block + the agent's name.

**New — shared:**

- `ai/harness/_shared/agent_core.yaml` — model, instructions, the four tools. The fact (AC5).

**New — scripts:**

- `ai/scripts/spike_hosted.py` — drives live turns against the deployed hosted agent and records raw streams (§5).
- `ai/scripts/build_hosted_config.py` — `agent.yaml` → `azure.yaml`, with `--check` for the gate.

**New — fixtures (recorded, dated):**

- `ai/tests/fixtures/recorded/langgraph-hosted-learn-<date>.{raw.,}jsonl` — AC3.
- `ai/tests/fixtures/recorded/langgraph-hosted-function-<date>.{raw.,}jsonl` — AC4.
- `ai/tests/fixtures/recorded/langgraph-hosted-voice-<date>.jsonl` — AC9, **only if** voice attaches.

**New — tests:**

- `ai/tests/test_langgraph_adapter.py` — AC1, AC4, AC13.
- `ai/tests/test_harness_parity.py` — AC5, AC6, AC11.
- `ai/tests/test_hosted_recorded_turn.py` — AC3, AC4, AC13 against the recordings.
- `ai/tests/test_hosted_config.py` — AC8, AC11 (generator drift).
- `ai/tests/test_hosted_graph.py` — AC6 (the graph's tools *are* the registry's).

**Modified:**

- `ai/harness/_shared/agent_spec.py` — `extends:` merge, optional `hosted:` block.
- `ai/harness/_shared/contract.py` — **`ToolCall`'s docstring only**: "Foundry runs it" → "the platform side runs it" (decision 2). No type, field or enum changes.
- `ai/harness/langgraph/adapter.py` — the scaffold becomes an implementation; `_NOT_BUILT` deleted.
- `ai/harness/langgraph/README.md` — stops saying nothing works (AC12); records where state lives, which the current README flags as easy to get wrong.
- `ai/harness/prompt_agent/agent.yaml` — model + instructions + tools move to the core; `extends:` + `reasoning:` remain.
- `ai/tests/test_conformance.py` — **registers the new adapter and nothing else** (AC2).
- `ai/scripts/apply_agent.py` — hosted harnesses print `azd` steps instead of calling `create_version`.
- `ai/pyproject.toml` — a `hosted` optional-dependency group, so CI still installs nothing heavy.
- `backend/app/harness_factory.py` — build a real `LangGraphAdapter`; the error message stops naming langgraph as broken.
- `backend/tests/test_harness_factory.py` — the "raises by design" test inverts (AC1).
- `.specify/constitution.md` — §8 headline + amendments table (spec's *Contract / data impact*).
- `CLAUDE.md`, `AGENTS.md`, `.claude/`+`.codex/` workflows — §8's wording, same commit (§6).
- `docs/harness-comparison.md` — hosted column filled from measurement; the two findings named (AC12).
- `docs/architecture.md` — both harnesses (AC12).
- `docs/REFERENCES.md` — every row in the spec's §10 table, plus the four measured answers; the stale "5–60 min" idle range corrected to 2–60.
- `ai/tests/fixtures/recorded/README.md` — the new fixtures, with what they record.
- `.env.example` — `AGENT_HARNESS=langgraph` documented; the Key Vault connection for `TAVILY_API_KEY` explained where the reader hits it.
- `justfile` — `hosted-build`, `hosted-deploy`, `hosted-record` recipes (delegating, restating nothing).
- `specs/README.md` — 018 status through `in-progress` → `done`.
- `frontend/src/i18n/strings.ts` — **only if** AC9 lands on "voice unavailable" (see below).

## Contract / data model changes (constitution §4)

| Fact | Single source of truth | Everything that must move with it |
|---|---|---|
| The `AgentEvent` set | `ai/harness/_shared/contract.py` | **Unchanged.** This spec is its first real test. `frontend/src/types/events.ts` and `contract-parity.test.ts` therefore need no edit — verified: the frontend already renders `executor: 'foundry'` (`components/labels.ts`, `ToolRow.tsx`, `app.css`), so the "dead code" the spec names is dead in `ai/` only. |
| `executor`'s meaning | `ToolCall`'s docstring | Two values, unchanged. One docstring sentence (decision 2). |
| Model · instructions · tool set | `ai/harness/_shared/agent_core.yaml` | Both `agent.yaml`s (via `extends:`), the container (reads it at startup), `test_harness_parity.py`. |
| Function tool implementations | `ai/harness/_shared/tools/` | The BFF's `tool_executor`, the container's `agent/tools.py`. Now a **correctness** property: two processes, one implementation (AC6). |
| Sandbox size · idle timeout · protocol | `ai/harness/langgraph/agent.yaml` `hosted:` | Generated `azure.yaml`, `docs/harness-comparison.md`, `ai/harness/langgraph/README.md` (AC11). |
| The hosted agent's name | `ai/harness/langgraph/agent.yaml` `name:` | The adapter, the generated `azure.yaml`. No new env var. |
| §8's headline | `.specify/constitution.md` | `CLAUDE.md`, `AGENTS.md`, `.claude/`/`.codex/` workflows — same commit (§6). |

**`mcp_call` becomes harness-specific.** The prompt agent emits it; this one never will. No contract
change — a harness has always been free to emit a subset — but `docs/how-it-works/streaming-events.md`
must stop implying every turn has one, and spec 020 must not read its absence as an error.

**`GET /config`** already reports `harness`; a second real value now flows through it. One thing does
need attention: `event_mapping` is imported from `harness.prompt_agent.events` unconditionally, so
with the hosted harness selected it would report the *wrong* harness's mapping report. It becomes
harness-scoped in this spec — a small fix, and exactly the kind of drift a second harness exposes.

**Not in this spec:** `POST /voice/session` reads `settings.agent_name` directly rather than calling
`HarnessAdapter.voice_attachment_params()`. That is a pre-existing bypass of the contract, noticed
here and **recorded, not fixed** — it only becomes wrong when the two harnesses' voice paths differ,
which AC9 will tell us. If AC9 says voice attaches, wiring it is the minimum change that makes voice
follow the selected harness, and it lands here; if AC9 says it does not, the disable path lands here
instead. Either way the decision is made from a measurement, not now.

## i18n strings (constitution §7)

**Conditional on AC9.** If the live attempt shows Voice Live does not attach to a hosted agent, the
control is disabled with a reason and these ship; if it attaches, none of them do and this table is
deleted rather than left as dead strings.

| key / location | en | pt |
|---|---|---|
| `voice.unavailableForHarness` | Voice is not available for this agent | Voz não está disponível para este agente |
| `voice.unavailableReason` | Voice Live attaches to prompt agents; this one runs as a hosted container. | O Voice Live conecta a agentes de prompt; este roda como um contêiner hospedado. |

The harness badge renders `settings.harness` verbatim — a proper noun, plain string, correctly not
translated (§7).

## Test strategy (constitution §2 — TDD)

Two kinds of test, and the difference matters. **Replay tests** assert claims about Foundry and are
driven by recordings (§5); they can only be written after the deploy, which is why the task order
puts the deploy early. **Unit tests** assert claims about our code and are written first as usual.

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | adapter constructs and streams; `_NOT_BUILT` sentinel absent from the package; factory returns an adapter for `langgraph` | `ai/tests/test_langgraph_adapter.py`, `backend/tests/test_harness_factory.py` |
| AC2 | `run_conformance(LangGraphAdapter(replay))` passes — `conformance.py` byte-identical, diff limited to registration | `ai/tests/test_conformance.py` |
| AC3 | the recorded Learn turn normalises to `tool_call{executor:"foundry"}` + matching `tool_result`, and **no** `mcp_call`; the prompt-agent fixture for the same question still has one | `ai/tests/test_hosted_recorded_turn.py` |
| AC4 | the recorded function-tool turn carries the pair with the tool's real output; `check_stream` passes | `ai/tests/test_hosted_recorded_turn.py` |
| AC5 | both specs resolve to the same `model`, `instructions` and tool-name set; neither file inlines the prose | `ai/tests/test_harness_parity.py` |
| AC6 | the graph's tool names and callables are `registry.specs()`' — identity, not equality; no `_shared/tools` copy exists under `agent/` | `ai/tests/test_hosted_graph.py` |
| AC7 | `azure.yaml` declares no plaintext `TAVILY_API_KEY`; the Key Vault connection is referenced or the manual step is documented | `ai/tests/test_hosted_config.py` |
| AC8 | `build_hosted_config.py --check` matches the committed `azure.yaml` | `ai/tests/test_hosted_config.py` |
| AC9 | if it attaches: the recorded voice turn replays green. If not: the harness reports voice unavailable and the UI disables the control with both strings | `ai/tests/test_hosted_recorded_turn.py` **or** `frontend/src/App.voice.test.tsx` |
| AC10 | the recorded turn's `trace_ids.response_id` resolves against the recorded App Insights span fixture — or a dated observation replaces the test and says why | `ai/tests/test_hosted_recorded_turn.py` |
| AC11 | the three values appear in `agent.yaml` and nowhere else; the generated `azure.yaml` carries them; `uses_gateway` is false | `ai/tests/test_harness_parity.py`, `ai/tests/test_hosted_config.py` |
| AC12 | docs gate — the hosted column names both findings; `langgraph/README.md` no longer claims nothing works; every new Foundry fact is dated in `REFERENCES.md` | `docs-i18n-auditor` + review, not a unit test |
| AC13 | the recording either contains `reasoning_summary` events or provably contains none, and the turn is valid either way | `ai/tests/test_hosted_recorded_turn.py` |

**AC2 is the load-bearing one.** If `conformance.py` needs a single edit, stop and write the finding
into this spec before changing it — that is the conversation the goals section asks for out loud.

## Risks / trade-offs

- **The stream shape is unknown, and that is the whole schedule risk.** Everything after the deploy
  is cheap; the deploy is not. `ResponsesHostServer` may not surface the graph's internal tool calls
  as Responses output items at all — in which case AC3 and AC4 cannot be met as written, and the
  honest outcome is a recorded finding plus a spec amendment, not a normaliser that invents events.
  Mitigation: record first, and treat `spike_hosted.py`'s output as the requirement.
- **Docker, `azd ext install azure.ai.agents`, and the Foundry Project Manager role** are all
  prerequisites outside this repo. Spec 002 sat blocked eleven days on Azure access; if the role is
  missing, this spec blocks the same way and the tasks must fail visibly rather than fall back to a
  simulated container.
- **Cold start.** Container compute bills per active session and starts cold. Time-to-first-token
  will be worse than the prompt agent's. That is a *finding* for AC12 and spec 020, not a bug to fix
  here (non-goal: "not a better agent").
- **The Key Vault connection may have no verifiable path from this repo.** AC7 anticipates it; the
  fallback is a documented manual step, matching how the AI Gateway is already handled (`infra/README.md`).
- **`extends:` is new machinery in `agent_spec.py`.** Kept to one key and a shallow merge on purpose.
  If it grows an override rule, it has outgrown its justification and the prose should move into a
  single generated artifact instead.
- **Two `agent.yaml`s and one `azure.yaml` is three files describing one agent.** The parity test and
  the generator drift test are what keep that honest; without both, §4 is a comment.
- **CI must not need Azure, Docker or a credential.** The container's dependencies go in an optional
  group and the replay tests read fixtures — the same discipline that keeps the existing suite
  credential-free.
