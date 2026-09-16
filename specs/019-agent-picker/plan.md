# Plan: The agents screen — pick which Foundry agent answers

> The HOW. Written after `spec.md` is `clarified`. Decisions here must respect every
> principle in `.specify/constitution.md`; if one must bend, amend the constitution
> first and note it.

## Approach

Three pieces, and the first one is already done.

**1. The listing, verified before anything was designed on top of it.** Spec 018's expensive lesson
was to look before building (§10), so `GET {project_endpoint}/agents?api-version=v1` was called
against the live project **first**. It answers AC1 and AC2 in a single request, with no second call
per agent:

```
data[].name                              foundry-live-agent-hosted
data[].state / configuration_state       enabled
data[].versions.latest.version           2
data[].versions.latest.status            active
data[].versions.latest.definition.kind   hosted        ← AC2, in the listing
```

**AC2 is answered: the listing carries `kind`.** The spec allowed for a second call per agent and it
is not needed.

**2. A read-only BFF endpoint, `GET /agents`.** It calls the listing, maps each agent to a row the UI
can render, and — crucially — decides **selectability** on the server, because that decision depends
on which harnesses this build has, which is backend knowledge. It returns a **reason code**, never
English prose: the BFF must not ship user-facing text (§7).

**3. A sidebar panel replacing Sessions, and a per-turn agent on `POST /chat`.** Selection lives in
React state, travels as a field on the chat request, and is resolved by `build_harness` per turn.
`AGENT_HARNESS` becomes the default rather than the law (decision 5), so an app with no selection
behaves exactly as today (AC12).

### The one genuinely new rule: kind → harness

AC5 needs the app to say *why* a row cannot be chosen, which means the app must know which agent
kinds it can drive. That rule gets **one home**, in `backend/app/harness_factory.py`, which is
already "the single place a harness name becomes an object":

```python
HARNESS_FOR_KIND = {"prompt": "prompt-agent", "hosted": "langgraph"}   # workflow: no harness
```

This is not agent-loop logic (§8). The app is not choosing which agent answers — a *person* is, and
the app is reporting what it can run. The spec says so outright in its non-goals.

### Selection is per request, not a mutated singleton

Today `app.state.harness` is one adapter built at startup and shared by `/chat`, `/config` and
`/voice/session`. The tempting change — swap that object when the user picks — is rejected: it is
process-global mutable state, so one browser's choice would change another's mid-turn, and a turn
already streaming could have its adapter replaced underneath it.

Instead `build_harness(settings, agent=...)` becomes able to build an adapter for a **named agent**,
and `/chat` builds one per turn. Adapters are cheap: the prompt adapter holds a closure and the
hosted one holds a URL. The expensive thing — the Foundry client and its credential — stays cached
where it already is, inside the stream factory.

`app.state.harness` stays as the **default**, which is what `/config` reports and what a request
with no `agent` gets. That is AC12 in one sentence.

### Where the model comes from — a finding the shape forces

A **prompt** agent's `definition` carries `model`. A **hosted** agent's does not: it carries
`cpu`, `memory`, `container_configuration` and `environment_variables`, and its model deployment is
inside `environment_variables.MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME`. AC1 asks for the model on
every row, so the mapper reads the definition's `model` and falls back to that variable — and where
neither exists it returns `""` and the row simply shows no model, rather than inventing one (§5).

## Affected files

**New:**

- `backend/app/agents.py` — the listing: one Azure call, one mapper, one typed failure. Everything
  Azure about agents lives here, so the router stays a router (the shape `app/traces.py` already has).
- `backend/app/routers/agents.py` — `GET /agents`.
- `backend/tests/test_agents.py` — the mapper and the failure path, driven by a recorded listing.
- `backend/tests/fixtures/agents-listing-20260916.json` — the **real** listing, recorded and
  redacted (§5). Not hand-written: the mapper's whole job is to handle the shape the service sends.
- `frontend/src/panes/AgentPicker.tsx` — the sidebar panel.
- `frontend/src/panes/AgentPicker.test.tsx`
- `frontend/src/state/agents.ts` — fetch + selection state.

**Modified:**

- `backend/app/harness_factory.py` — `HARNESS_FOR_KIND`, and `build_harness(..., agent=...)`.
- `backend/app/routers/chat.py` — `ChatRequest.agent`, and a per-turn adapter.
- `backend/app/routers/voice.py` — attach to the selected agent (AC8).
- `backend/app/main.py` — register the router; expose the listing on `app.state`.
- `backend/app/settings.py` — nothing new expected; `AGENT_HARNESS`/`AGENT_NAME` become defaults.
- `frontend/src/panes/Sidebar.tsx` — Sessions → Agents.
- `frontend/src/panes/Header.tsx` — names the selected agent.
- `frontend/src/config.ts` + `frontend/src/types/` — the mirrored listing type.
- `frontend/src/i18n/strings.ts` — every string below.
- `frontend/src/api/` — the chat call carries the selected agent.
- `docs/REFERENCES.md` — the listing endpoint, its shape, its RBAC (§10).
- `docs/architecture.md`, `README.md` + `README.pt-BR.md` — the screen exists now.
- `specs/018-hosted-agent-harness/spec.md` — its "No UI — that is spec 019" pointers say
  *in progress* rather than being deleted; 018 did not build this and must not claim it.

## Contract / data model changes (constitution §4)

**`GET /agents` — new public contract.** Source of truth: `backend/app/agents.py`. Mirrored by the
frontend type and by a parity test, the way `contract.py` ↔ `types/events.ts` already are.

```jsonc
{
  "agents": [
    {
      "name": "foundry-live-agent-hosted",
      "kind": "hosted",              // prompt | hosted | workflow | unknown — from the service
      "version": "2",
      "version_status": "active",
      "model": "gpt-5.5",            // "" when the service reports none
      "harness": "langgraph",        // which harness would drive it; "" when none can
      "selectable": true,
      "reason": ""                   // a CODE, never prose: no_harness | disabled | version_not_active
    }
  ],
  "error": null                       // or a code the UI renders; never an empty list meaning "none"
}
```

**`reason` is a code, not a sentence.** §7 requires every user-facing string to ship `{ en, pt }` in
`frontend/src/i18n/strings.ts`. A message composed in the BFF would be English-only by construction,
so the BFF names the case and the UI says it in the reader's language.

**`POST /chat` gains `agent: str | null`.** Absent means the configured default (AC12). The value is
validated against the listing's selectable agents before an adapter is built — the browser names an
agent, it does not describe one.

**`GET /config`'s `harness` / `agent_name` become the *default*,** not the whole truth. They stay,
because an app with no selection is still described by them.

**`AgentEvent` (§9): unchanged.**

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `agents.title` | Agents | Agentes |
| `agents.loading` | Reading the project… | Lendo o projeto… |
| `agents.answering` | answering | respondendo |
| `agents.kind.prompt` | prompt | prompt |
| `agents.kind.hosted` | hosted | hospedado |
| `agents.kind.workflow` | workflow | workflow |
| `agents.kind.unknown` | unknown kind | tipo desconhecido |
| `agents.version` | v{version} · {status} | v{version} · {status} |
| `agents.status.active` | active | ativo |
| `agents.status.creating` | creating | criando |
| `agents.status.failed` | failed | falhou |
| `agents.reason.no_harness` | This build has no harness for this kind of agent | Esta build não tem harness para este tipo de agente |
| `agents.reason.disabled` | This agent is disabled in the project | Este agente está desabilitado no projeto |
| `agents.reason.version_not_active` | Its served version is not active yet | A versão publicada ainda não está ativa |
| `agents.reason.unknown` | This agent cannot be selected | Este agente não pode ser selecionado |
| `agents.switched` | New conversation started with {name} | Nova conversa iniciada com {name} |
| `agents.error.unavailable` | The project's agents could not be listed | Não foi possível listar os agentes do projeto |
| `agents.error.unconfigured` | No Foundry project is configured | Nenhum projeto Foundry configurado |
| `agents.error.forbidden` | This identity cannot list the project's agents | Esta identidade não pode listar os agentes do projeto |
| `agents.fallback` | Showing the configured agent only | Mostrando apenas o agente configurado |

Plus `agents.status.deleting` and `agents.status.unknown`, for the two documented statuses the first
draft of this table missed.

Agent names, version numbers and model ids are **data** and stay verbatim (§7's proper-noun rule).

**`agents.reason.unknown` was not in the first draft and is here because AC5 forces it.** The three
codes are what the BFF sends *today*; a row dimmed with no explanation is precisely what AC5
forbids, so the UI has a floor. It is not a place to hide a fourth code:
`frontend/src/types/agents.test.ts` reads `app/agents.py` and fails the moment the backend grows
one.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | the mapper turns the **recorded** listing into rows carrying name, kind, version, status, model; no row is synthesised | `backend/tests/test_agents.py` |
| AC2 | `kind` comes from `definition.kind` in the fixture — and a listing without it yields `unknown`, never a guess | `backend/tests/test_agents.py` |
| AC3 | unconfigured / unauthorised / service error each produce a distinct typed failure, and never `agents: []` | `backend/tests/test_agents.py`, `test_routes.py` |
| AC4 | each row renders kind, version and status; exactly one is marked as answering | `frontend/src/panes/AgentPicker.test.tsx` |
| AC5 | the three reasons are distinguished, the row is present and not clickable, and the text is the active language's | same |
| AC6 | `POST /chat` with `agent` runs against that agent; without it, against the default | `backend/tests/test_routes.py` |
| AC7 | selecting a different agent clears the conversation id and announces it; no id crosses | `frontend/src/state/agents.test.ts` |
| AC8 | the voice session attaches to the selected agent | `backend/tests/test_voice.py` |
| AC9 | a failed listing renders the reason plus the configured agent, and the composer still works | `frontend/src/panes/AgentPicker.test.tsx` |
| AC10 | a reload returns to the default — asserted as "nothing is written to storage" | `frontend/src/state/agents.test.ts` |
| AC11 | the existing string-parity test covers every new key in `en` and `pt` | `frontend/src/i18n/strings.test.ts` |
| AC12 | the whole existing suite passes untouched with no selection | every existing suite |

**The listing fixture is recorded, not written** (§5). The mapper exists to survive the shape the
service actually sends — including the ten unrelated agents already in this project, which is
exactly the mess a hand-written fixture would omit.

## Changed while implementing

Two things this plan did not foresee, both found by running the thing:

- **The row carries `harness`.** The header renders a harness badge beside the agent's name, and it
  was still reporting `AGENT_HARNESS` while a selected agent of the *other* kind answered — a turn
  tagged `foundry` under a badge reading `prompt-agent`. That is the same lie spec 018 fixed one
  field over, on `agent_name`. The fix sends the harness on the row rather than re-deriving
  `HARNESS_FOR_KIND` in TypeScript, so the rule keeps one home (§4).
- **The sidebar's "nothing is stored" note survived** the Sessions → Agents replacement, moved under
  **New session**. It is still true, and §5 has no reason to stop saying it.

## Risks / trade-offs

- **Ten agents in the real project, and most are not ours.** The screen will list `DatabricksGenie`,
  `dataagent`, `test-agent` and friends. That is correct — it reads the project — but it means the
  fixture and the UI must both handle agents with empty instructions, unknown tools and models we
  never chose. Good: it is the honest view of a shared project.
- **A `prompt` agent we did not write is selectable**, because the prompt harness drives any prompt
  agent by name. Choosing one will produce a working but strange conversation — a different agent,
  as advertised. Not a bug; worth a line in the docs so it does not read as one.
- **`versions.latest` is assumed to be the served version.** The documentation says an endpoint
  serves one version and that traffic splitting is unsupported, and `latest` matched the served
  version on both our agents. If a case appears where they differ, the row would be reporting the
  wrong thing — so the mapper reads `latest` and the plan records the assumption rather than hiding it.
- **Per-turn adapter construction** must not re-acquire a credential per turn. The cached client
  inside the stream factory is what prevents it; a regression there costs seconds on every message,
  which is exactly the symptom spec 002 documented.
- **The BFF now makes a second kind of Azure call**, with its own failure mode. AC3 exists so that a
  project we cannot list degrades to "the app still works" rather than a blank screen.
