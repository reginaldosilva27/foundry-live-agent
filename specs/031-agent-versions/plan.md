# Plan: Versions, and going back to one

> The HOW, written after `spec.md` reached `clarified` (2026-09-19). Decisions here respect
> `.specify/constitution.md`; nothing in it needed to bend.

## Approach

Three separable pieces, in dependency order.

**1. Correct what "the served version" means — dormant.** `agents.py` gains one pure function,
`served_version(agent)`, reading `agent_endpoint.version_selector.version_selection_rules[0].agent_version`
and falling back to `versions.latest.version`. Today every agent takes the fallback, so no screen
changes; the branch exists so that the moment piece 3 pins something, nothing lies. This lands first
because pieces 2 and 3 are meaningless without it.

**2. The version list — a read.** `GET /agents/{name}` gains the agent's versions. This is where the
detail route stops being answerable from the listing: it now makes two upstream calls,
`agents.get(name)` (for `agent_endpoint`, which the listing does not carry) and
`agents.list_versions(name)`. That is a deliberate spend of spec 030's property, bounded to the one
screen that can afford it — **the listing route is not touched**, and AC12 is the test that keeps it
that way.

**3. The promote — the write.** One route, path parameters only, behind a default-off flag and an
ownership check. Implemented as `update_details(agent_name, agent_endpoint=…)` with exactly one
`FixedRatioVersionSelectionRule` at 100%.

**Alternative considered and rejected:** resolving the served version inside the listing by reading
`agent_endpoint` when present. Free when it works, but if the listing never carries the field the
rail shows the wrong version after a promote and no test can catch it — a silent lie beats a loud
one only in the wrong direction. Rejected at clarify.

**A second alternative rejected:** a separate `backend/app/agent_versions.py` for the write surface.
Attractive for `SECURITY.md` (one file to point at), but `agents.py`'s docstring already claims
"everything Azure about agents lives here" and splitting it would give the served-version rule two
neighbours. The write stays in `agents.py`, in its own clearly-named function, and `SECURITY.md`
points at the route.

### Ownership lives next to `HARNESS_FOR_KIND`

`harness_factory.py` is already "the only place kind → harness is decided". Ownership is the same
shape of cross-cutting fact, so `OWNED_AGENT_NAMES` is computed there from the `name` in each
`ai/harness/*/agent.yaml` via the existing `load_agent_spec`, and `agents.py` imports it. Two homes
for "which agents are ours" is exactly the §4 drift the picker spec warned about.

## Affected files

**Backend**

- `backend/app/agents.py` — `served_version()`; `AgentVersion` dataclass + `as_dict`; `versions_of()`
  projection; `AgentDetail` gains `served_version` · `pinned` · `latest_version` · `versions`;
  `build_agent_detail_reader` grows the two upstream calls; `promote_version()` — the write.
  Module docstring's "the served version" line corrected (it is currently wrong by anticipation).
- `backend/app/harness_factory.py` — `OWNED_AGENT_NAMES`, derived from the harness `agent.yaml` files.
- `backend/app/routers/agents.py` — detail docstring corrected ("no second upstream call" is no
  longer true here); new `POST /agents/{name}/versions/{version}/promote`, **no request body**.
- `backend/app/routers/config.py` — `"agents": {"can_promote": …}`.
- `backend/app/settings.py` — `allow_version_promote: bool = False` ← `FOUNDRY_ALLOW_VERSION_PROMOTE`.
- `backend/app/main.py` — wire `app.state.promote_version` beside `list_agents` / `agent_detail`.

**Frontend**

- `frontend/src/types/agents.ts` — `AgentVersion`; `AgentDetail` new fields.
- `frontend/src/types/agents.test.ts` — parity extended to the new dataclass.
- `frontend/src/config.ts` — `BffConfig.agents.can_promote`.
- `frontend/src/state/promote.ts` (new) — the call, the in-flight flag, the re-read on success.
- `frontend/src/panes/AgentDetail.tsx` — the version list, the served/pinned marks, the control,
  the confirmation.
- `frontend/src/i18n/strings.ts` — the table below.

**Docs**

- `docs/REFERENCES.md` — the call shape, and the open verification item.
- `SECURITY.md` — the write surface, the flag, the role as a manual step, where the audit lives.
- `docs/architecture.md` — the rollback story gains its demonstrated form.
- `.env.example` — the new flag, off, with the warning.

## Contract / data model changes (constitution §4)

`AgentEvent` is untouched (§9) — this spec adds no streaming event.

| Fact | Single source of truth | Must move with it |
|---|---|---|
| The detail response shape | `AgentDetail.as_dict()` in `backend/app/agents.py` | `frontend/src/types/agents.ts`, guarded by the existing `agents.test.ts` parity test |
| A version row's shape | new `AgentVersion.as_dict()`, same file | same parity test, extended |
| `served_version` | `served_version()` in `agents.py` | nothing may re-derive it; the frontend renders the field |
| Which agents are ours | `OWNED_AGENT_NAMES` in `harness_factory.py`, from `agent.yaml` | no TypeScript copy — the BFF sends `promotable` + a code |
| Whether this build can write | `settings.allow_version_promote` → `GET /config` | `BffConfig`; the UI never infers it |

**New response fields on `GET /agents/{name}`**

```
served_version   str          the version the endpoint serves
latest_version   str          the newest version that exists
pinned           bool         true when a selector chose the served version
versions         [AgentVersion] | null    null = the service did not report them
```

**`AgentVersion`** — `version` · `status` · `created_at` · `model` · `served` · `promotable` ·
`promote_reason` (`''` · `served` · `not_owned`). `model` and `status` are `null` when not reported
(AC2); a hosted version has no model and that is the same rule, not a special case.

**New route.** `POST /agents/{name}/versions/{version}/promote`, **no body** — the agent and the
version are path parameters and nothing else can travel (AC14). Answers the freshly-read detail
(AC7) or `{detail: null, error: <code>}`. Codes: `write_disabled` · `not_owned` · `unknown_agent` ·
`unknown_version` · `forbidden` · `unavailable`.

**Migration:** none. The new fields are additive; the flag defaults false, so an existing deployment
gains a version list and no write surface.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `versions.title` | Versions | Versões |
| `versions.loading` | Reading the versions… | Lendo as versões… |
| `versions.none` | This agent's versions were not reported | As versões deste agente não foram informadas |
| `versions.served` | serving | em uso |
| `versions.latest` | latest | mais recente |
| `versions.pinned` | This project is pinned to v{version}; the newest is v{latest} | Este projeto está fixado na v{version}; a mais recente é a v{latest} |
| `versions.created` | created {when} | criada em {when} |
| `versions.notReported` | not reported | não informado |
| `versions.promote` | Use this version | Usar esta versão |
| `versions.promoting` | Switching… | Trocando… |
| `versions.confirm.title` | Serve version {version}? | Servir a versão {version}? |
| `versions.confirm.body` | This changes which version answers for everyone using this project, not only in this browser. It applies from the next turn. | Isto muda qual versão responde para todos que usam este projeto, não apenas neste navegador. Vale a partir do próximo turno. |
| `versions.confirm.ok` | Serve this version | Servir esta versão |
| `versions.confirm.cancel` | Cancel | Cancelar |
| `versions.reason.served` | This is the version being served | Esta é a versão em uso |
| `versions.reason.not_owned` | This agent was not created by this repository | Este agente não foi criado por este repositório |
| `versions.error.forbidden` | This build is not allowed to change the project | Esta build não tem permissão para alterar o projeto |
| `versions.error.write_disabled` | Changing versions is turned off in this deployment | A troca de versões está desligada nesta implantação |
| `versions.error.not_owned` | This agent was not created by this repository | Este agente não foi criado por este repositório |
| `versions.error.unknown_version` | That version no longer exists | Essa versão não existe mais |
| `versions.error.unavailable` | The project could not be reached | Não foi possível acessar o projeto |

`versions.confirm.cancel` duplicates `history.clearCancel`'s text; both stay, because a shared
"Cancel" key across unrelated dialogs is the kind of coupling that makes one screen's copy change
another's. `INTENTIONALLY_IDENTICAL` gains nothing here — every row above genuinely differs.

## Test strategy (constitution §2 — TDD)

Fixtures: the existing `backend/tests/fixtures/agents-listing-20260916.json` drives every fallback
case. A **pinned** agent has never existed, so §5 forbids inventing a recorded response for one; the
pinned branch is driven by a fixture built from the **SDK's own models** (constructed, not
hand-written JSON) and labelled as such, and the live recording replaces it when `az` works.

| AC | Test | File |
|---|---|---|
| AC1 | versions project newest first with identifier, status, created, model; served marked | `backend/tests/test_agent_versions.py` |
| AC2 | a version missing `model` / `status` projects `None`, and renders as not reported | `backend/tests/test_agent_versions.py`, `frontend/src/panes/AgentDetail.test.tsx` |
| AC3 | control renders only when not served **and** `can_promote` **and** `promotable` | `frontend/src/panes/AgentDetail.test.tsx` |
| AC4 | the confirmation's body names "everyone" and "next turn", in both languages | `frontend/src/panes/AgentDetail.test.tsx` |
| AC5 | cancelling issues no `fetch` — asserted on the mock's call count | `frontend/src/panes/AgentDetail.test.tsx` |
| AC6 | a second click while in flight issues no second request | `frontend/src/state/promote.test.ts` |
| AC7 | on success the rendered served version comes from the re-read, not the request — the stub returns a *different* version than was asked for and the screen shows the stub's | `frontend/src/state/promote.test.ts` |
| AC8 | a failing promote renders the translated code and leaves the served version unchanged | `frontend/src/panes/AgentDetail.test.tsx` |
| AC9 | with `can_promote` false, no control anywhere on the screen | `frontend/src/panes/AgentDetail.test.tsx` |
| AC10 | every new key exists in `en` and `pt` | existing `frontend/src/i18n/strings.test.ts` |
| AC11 | `served_version()` both branches; `version_not_active` follows the served version | `backend/tests/test_agent_versions.py` |
| AC12 | the listing makes exactly one upstream call and no per-agent call — asserted on a counting stub | `backend/tests/test_agents.py` |
| AC13 | promote on an unowned agent answers `not_owned` with the flag **on** and the role present | `backend/tests/test_agent_promote.py` |
| AC14 | the route accepts no body: posting one changes nothing, and the built call object carries only name + version + 100% | `backend/tests/test_agent_promote.py` |

Seam test for the unverified write (§10): `promote_version` is asserted on the *call it constructs*
against a fake client — one rule, `traffic_percentage=100`, the requested `agent_version`, and no
`definition` anywhere in the payload. That is the honest limit of what can be proven without a
credential, and the test says so in its docstring.

## Risks / trade-offs

- **The write path is unverified against the live service.** Accepted at clarify, bounded by the
  default-off flag, recorded as an open item in `docs/REFERENCES.md`. The first live promote may
  find that `update_details` wants a different merge-patch shape; the seam test will not catch that,
  and nothing pretends otherwise.
- **`agents.get()` may not return `agent_endpoint` either.** If it does not, `pinned` is always false
  and a promote appears to succeed while the screen keeps showing the latest version — which AC7's
  fresh read would surface as "nothing changed". Worth watching on the first live run.
- **The detail route gets slower.** Two upstream calls where there was none. It is one screen, opened
  deliberately, and the listing — the hot path — is untouched.
- **`traffic_percentage` is a lie the type tells.** The docs say splitting is unsupported; the type
  models it. Sending 100 on one rule is the only shape this app will ever send, and the out-of-scope
  note records the disagreement so a future reader does not think it was missed.
- **A shared BFF makes promotion unattributable.** Stated, not solved — the app has no identity.
  `SECURITY.md` says it plainly rather than the flag implying otherwise.
