# Tasks: The agents screen — pick which Foundry agent answers

> The work, ordered, as a TDD checklist. Each implementation task is preceded by the
> test that should fail first (red → green → refactor). Check boxes as you go.

Phase A is done before anything is designed on top of it — spec 018's lesson (§10). Everything
after it is ordinary red → green.

## A — look at the service first

- [x] **T1 — observe**: call `GET {project_endpoint}/agents?api-version=v1` live and write down the
      shape. **Answered AC2**: `versions.latest.definition.kind` is in the listing; no second call
      per agent is needed. Also found: a *hosted* agent's definition carries **no `model`** — it has
      `cpu`, `memory`, `container_configuration`, and the deployment name inside
      `environment_variables`.
- [x] **T2 — record**: commit the real listing as
      `backend/tests/fixtures/agents-listing-20260916.json`, redacted (§5). Ten agents, most of
      them not ours — which is the mess the mapper has to survive.
- [x] **T3 — observe**: confirm which RBAC role the listing needs, and what the failure looks like
      without it. Goes into `docs/REFERENCES.md` with its date (§10, decision 10).
      **Answered, with its limit stated**: `Foundry User` and `Foundry Project Manager` grant the
      *same* data action (`Microsoft.CognitiveServices/*`), so a data-plane read needs the lesser —
      read from the live role definitions, **not** from a denial, because the identity to hand holds
      both. The wrong-audience failure *was* reproduced: `401 … audience is incorrect
      (https://ai.azure.com)`.

## B — the BFF listing

- [x] **T4 — test first**: `backend/tests/test_agents.py` — the mapper turns the recorded listing
      into rows with name, kind, version, status and model; nothing is synthesised (**AC1**).
- [x] **T5 — test first**: same file — `kind` comes from the definition; a listing without one
      yields `unknown`, never a guess (**AC2**). A hosted agent's model falls back to
      `environment_variables`, and where neither exists the model is `""`, not invented (§5).
- [x] **T6 — test first**: same file — selectability and its **reason code**: `no_harness`,
      `disabled`, `version_not_active` (**AC5**). The BFF returns codes, never prose (§7).
- [x] **T7 — implement**: `backend/app/agents.py` — one Azure call, one mapper, one typed failure.
- [x] **T8 — test first**: unconfigured · unauthorised · service error each give a distinct typed
      failure, and **never** an empty list presented as "no agents" (**AC3**).
- [x] **T9 — implement**: `backend/app/routers/agents.py` + registration in `main.py`.
- [x] **T10 — implement**: `HARNESS_FOR_KIND` in `harness_factory.py` — the kind → harness rule, in
      exactly one place (plan, *the one genuinely new rule*).

## C — running a turn against a chosen agent

- [x] **T11 — test first**: `POST /chat` with `agent` runs against that agent; without it, against
      the configured default (**AC6**, **AC12**).
- [x] **T12 — implement**: `build_harness(settings, agent=...)` and a per-turn adapter in
      `routers/chat.py`. `app.state.harness` stays the default and is not mutated — a process-global
      swap would let one browser change another's turn (plan, *selection is per request*).
- [x] **T13 — test first**: an `agent` the listing does not offer as selectable is rejected, rather
      than built and failed later.
- [x] **T14 — test first**: the voice session attaches to the **selected** agent (**AC8**).
- [x] **T15 — implement**: `routers/voice.py` follows the selection.
- [x] **T16 — guard**: a credential is not re-acquired per turn — the cached client still holds
      (plan, *Risks*).

## D — the screen

- [x] **T17 — i18n**: every key in `plan.md`'s table, `en` + `pt`, before the components that use
      them (**AC11**). The parity test then covers them for free.
- [x] **T18 — test first**: `AgentPicker.test.tsx` — each row shows kind, version and status, and
      exactly one is marked as answering (**AC4**).
- [x] **T19 — test first**: a non-selectable row is present, not clickable, and carries the right
      one of the three reasons in the active language (**AC5**).
- [x] **T20 — test first**: a failed listing renders the reason plus the configured agent, and the
      composer still works (**AC9**, **AC3**).
- [x] **T21 — implement**: `state/agents.ts` + `panes/AgentPicker.tsx`.
- [x] **T22 — test first**: selecting a different agent starts a new conversation, says so, and
      **no Foundry conversation id crosses between agents** (**AC7**).
- [x] **T23 — test first**: nothing about the choice is written to storage; a reload is the default
      (**AC10**).
- [x] **T24 — implement**: `Sidebar.tsx` Sessions → Agents; `Header.tsx` names the selected agent;
      the chat call carries it.
- [x] **T24b — found by running it**: the header's **harness badge** still read `AGENT_HARNESS`
      while a selected agent of the other kind answered — a turn tagged `foundry` under a badge
      saying `prompt-agent`. Exactly the lie spec 018 fixed one field over, on `agent_name`. The row
      now carries `harness`, computed from `HARNESS_FOR_KIND`, so the rule keeps one home (§4).

## E — docs and the pointer in 018

- [x] **T25 — docs**: `docs/REFERENCES.md` — the listing endpoint, its response shape, the
      `https://ai.azure.com` audience and the RBAC it needs, each with the date read (§10).
- [x] **T26 — docs**: `docs/architecture.md`, `README.md` + `README.pt-BR.md` (§7) — the screen
      exists; and the note that a prompt agent we did not write is selectable and will behave like
      the different agent it is.
- [x] **T27 — docs**: `specs/018-hosted-agent-harness/spec.md` — its two "No UI — that is spec 019"
      non-goals gain *(in progress)* / *(done)*. **Not deleted**: 018 did not build this screen, and
      a done spec must not claim work it did not do.
- [x] **T28 — refactor**: clean up, keep everything green.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] The agents fixture is **recorded from the live project**, not written (§5)
- [x] Lint clean · tests green · build passes, in all four layers
- [x] An app with **no selection** behaves exactly as before (**AC12**) — the existing suites pass
      untouched
- [x] Every new string exists in `en` **and** `pt` (§7); the BFF ships **no** user-facing prose
- [x] Docs updated in the same change; `docs/REFERENCES.md` carries the listing API (§10)
- [x] `verify-gates` run and green
- [x] `spec.md` status updated to `done`; `specs/README.md` row updated

## Verified against the live project, 2026-09-16

Not only in tests. With the BFF and the browser running against the real project:

| | |
|---|---|
| `GET /agents` | 10 agents, `error: null`, every row carrying kind, served version, status, model and harness |
| A turn on the selected **prompt** agent | `tool_call executor: app`, two `trace_ids`, `usage` reported |
| A turn on the selected **hosted** agent | `tool_call executor: foundry`, one `trace_ids`, no `usage`, no reasoning summary |
| A **foreign** prompt agent (`dataagent`) | answers, as a different agent — the documented trade-off, not a bug |
| An agent the project does not have | the stream ends `error` / `unknown_agent`, and nothing is dialled |
| The screen, `en` and `pt` | rows, the answering mark, the switch notice and the harness badge all follow the selection |
| The listing failing | the panel says so and the composer still works (**AC9**) — seen for real, against a BFF that was still starting |
