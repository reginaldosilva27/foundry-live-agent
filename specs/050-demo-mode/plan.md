# Plan: Demo mode — the whole app, with no Azure credential

> Written after `spec.md` reached `clarified` (2026-09-20).

## Approach

**The seams already exist; this points them at the recordings.** `create_app` takes
`stream_factory`, `agent_lister`, `trace_query` and four more because that is how 281 backend tests
run without a credential. A demo is a second *composition* of the same application, not a second
application and not a branch inside the first.

So: a new module builds the app by calling `create_app` with those seams filled from
`ai/tests/fixtures/recorded/`, and **`create_app` never learns it exists**. The dependency points
one way, and a test asserts the direction rather than trusting it — that is the whole of AC2, and
the reason the clarify step chose an entrypoint over a flag.

**Which recording is replayed is process state, set by its own route.** It deliberately does not
travel on `POST /chat`: that body has exactly three keys and `App.routing.test.tsx` pins them on
purpose, to keep this browser's choices out of Foundry's state (spec 021, spec 045). A fourth key
for a local convenience would spend that pin. `GET /demo` and `POST /demo/recording` live on a
router the demo entrypoint mounts and the production one has never heard of.

**One harness, on purpose.** The two harnesses normalise *different raw streams* — that is spec
018's finding — and the single `stream_factory` seam cannot tell which adapter is calling it. So v1
replays the three **prompt-agent** recordings, and the recorded listing reports the hosted agent as
one this demo has no recording for. Pairing a hosted recording with the hosted normaliser needs
either a per-harness seam in `build_harness` or a coupling between the picker and the agent
selection, and both are a second feature. Deferred, with the reason, rather than faked.

### Alternatives considered

| | Why not |
|---|---|
| `FOUNDRY_DEMO=1` inside `create_app` | Puts replay code on the production path; a mistyped variable makes a real deployment serve a recording as live. Rejected at clarify. |
| A third harness (`demo`) behind `HARNESS_FOR_KIND` | A harness is a way of *running an agent*. This runs none. It would also make `/config`'s harness field name something that is not one. |
| Copying fixtures into `backend/` | Two copies of a recording is exactly the drift §4 forbids, and a copy is the first place a hand edit lands (§5). Read them where they are. |
| Matching the typed question to a recording | Rejected at clarify: it makes the demo feel like it answers. |

## Affected files

**Backend**

- `backend/app/demo.py` **(new)** — `create_demo_app()`, the `RECORDINGS` catalogue, the replay
  stream factory, the recorded agent listing and the recorded span query. The only module that
  reads a fixture from application code, and it says why.
- `backend/app/routers/demo.py` **(new)** — `GET /demo` (catalogue + current pick),
  `POST /demo/recording` (choose). Mounted by `create_demo_app` **only**.
- `backend/app/routers/config.py` — one new top-level key, `demo`, **absent** unless the demo
  entrypoint built the app. Absent and `false` are different facts (§5), and here there is no
  `false`: a live BFF simply never mentions it.
- `backend/tests/test_demo.py` **(new)** — AC1–AC3, AC7–AC12.
- `backend/tests/test_routes.py` — one assertion that the production app has no `/demo` route.

**Frontend**

- `frontend/src/state/demo.ts` **(new)** — reads `GET /demo`, posts the choice. No request at all
  when `config.demo` is absent.
- `frontend/src/components/DemoBanner.tsx` **(new)** + test — the banner and the picker in it.
- `frontend/src/App.tsx` — render it above the shell when `config.demo` is present.
- `frontend/src/config.ts` — the `demo` shape.
- `frontend/src/panes/aboutFields.ts` + `panes/About.tsx` — render the new field, or
  `About.coverage.test.ts` fails the build (§4).
- `frontend/src/panes/AgentsScreen.tsx` — `demo_not_recorded` in the reason map.
- `frontend/src/i18n/strings.ts` — every new string, `en` + `pt`.
- `frontend/src/styles/app.css` — the banner is a **row of the shell grid**, placed explicitly.
  A direct child of `.app` with no placement is the bug this session just fixed in `.events`; it is
  not getting made twice.
- `frontend/src/styles/layout.test.ts` — the assertion that it is placed.

**Docs and runner**

- `justfile` — `demo`, beside `backend` and `frontend`.
- `README.md` ↔ `README.pt-BR.md` — a "look at it first" step before the Quickstart (§7: both move
  together).
- `SECURITY.md` — the demo entrypoint enables the playground; it is a local tool.
- `specs/README.md` — the index row.
- `CHANGELOG.md`.

## Contract / data model changes (constitution §4)

| Contract | Source of truth | What moves with it |
|---|---|---|
| `GET /config` gains `demo` | `backend/app/routers/config.py` | `frontend/src/config.ts` (type), `panes/aboutFields.ts` (`COVERED_CONFIG_KEYS`), `panes/About.tsx` (renders it). `About.coverage.test.ts` enforces the last two. |
| A new `reason` code, `demo_not_recorded` | `backend/app/demo.py` produces it; the vocabulary lives with the other codes in `backend/app/agents.py`'s docstring | `frontend/src/panes/AgentsScreen.tsx`'s `REASONS`, `i18n/strings.ts`. The BFF ships the **code**, the frontend the prose (§7). |
| `GET /demo`, `POST /demo/recording` | `backend/app/routers/demo.py` | `frontend/src/state/demo.ts`. Demo-only; neither exists on a production BFF and a test says so. |
| `AgentEvent` (§9) | `ai/harness/_shared/contract.py` | **Untouched.** The demo feeds the same normaliser, which is the point. |
| The recordings | `ai/tests/fixtures/recorded/` | Read-only. `RECORDINGS` names a file and an `id`; a test asserts every named file exists and is documented in that directory's `README.md`, so the catalogue cannot name a recording nobody wrote down. |

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `demo.title` | Replay | Reprodução |
| `demo.body` | This build is replaying a conversation recorded against a real Foundry project on {date}. Nothing is being sent anywhere, and the answer does not depend on what you type. | Esta build está reproduzindo uma conversa gravada em um projeto Foundry real em {date}. Nada está sendo enviado a lugar nenhum, e a resposta não depende do que você digitar. |
| `demo.pick` | Recorded turn | Turno gravado |
| `demo.recording.round-trip` | Function-call round trip, with Microsoft Learn | Ida e volta de function call, com o Microsoft Learn |
| `demo.recording.no-reasoning` | The same turn, with no reasoning summaries | O mesmo turno, sem resumos de raciocínio |
| `demo.recording.preamble` | The agent says what it is about to look up | O agente diz o que vai consultar |
| `agents.reason.demo_not_recorded` | This demo has no recording for this agent | Esta demonstração não tem gravação para este agente |
| `about.field.demo` | Replaying a recording | Reproduzindo uma gravação |
| `about.field.demoRecorded` | Recorded on | Gravado em |

## Test strategy (constitution §2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | builds and streams a whole turn to `done` with every `FOUNDRY_*`/`AZURE_*`/`VOICELIVE_*` variable removed from the environment | `backend/tests/test_demo.py` |
| AC2 | the production app exposes no `/demo` route; `app.main`'s import graph does not reach `app.demo` | `backend/tests/test_routes.py`, `backend/tests/test_demo.py` |
| AC3 | the replayed event sequence passes `check_stream` and equals what the adapter produces for the same fixture — one `usage`, one terminal | `backend/tests/test_demo.py` |
| AC4 | `GET /config` carries `demo` in the demo app and **omits the key** in the production one; `/about` renders it | `backend/tests/test_demo.py`, `frontend/src/panes/About.test.tsx`, `About.coverage.test.ts` |
| AC5 | the banner renders on all screens in `en` and `pt`, and no control dismisses it (asserted over the rendered controls) | `frontend/src/components/DemoBanner.test.tsx`, `App.shell.test.tsx` |
| AC6 | choosing a recording changes what the next turn replays; every `RECORDINGS` entry names a file that exists and is documented in the fixtures README | `backend/tests/test_demo.py` |
| AC7 | two different questions replay the same recording, byte for byte | `backend/tests/test_demo.py` |
| AC8 | the recorded listing has a prompt agent, a hosted one and one with no harness, each carrying a code and no prose | `backend/tests/test_demo.py` |
| AC9 | `GET /trace/{id}` returns `ok` with more than one span, from the recorded rows | `backend/tests/test_demo.py` |
| AC10 | `GET /tools` is enabled and `search_web` answers `search_unavailable` | `backend/tests/test_demo.py` |
| AC11 | `voice.enabled` and `speech.enabled` are `false` in the demo config | `backend/tests/test_demo.py` |
| AC12 | the fixtures directory is unchanged by a demo run (no writes), and `RECORDINGS` points into it | `backend/tests/test_demo.py` |
| AC13 | the `justfile` has a `demo` recipe | covered by the docs task, not a unit test |
| AC14 | every new key has `en` and `pt` | `frontend/src/i18n/strings.test.ts` (existing parity test) |
| — | the banner is **placed** in the shell grid rather than auto-flowed into an implicit row | `frontend/src/styles/layout.test.ts` |

## Risks / trade-offs

- **Application code reading a test fixture.** `backend/app/demo.py` imports from
  `ai/tests/fixtures/`, which is a boundary this repository has not crossed before. It is the right
  trade against copying a recording (§4, §5), and it is bounded: the demo entrypoint is a local
  tool, not something the container image runs. A missing fixture must fail loudly at startup with
  the path, not on the reader's first message.
- **The comparison screen is weak in demo.** Both columns replay the same recording, so `/compare`
  demonstrates the *mechanism* — two independent streams, two conversations — and not a difference
  between harnesses. Said in the banner's copy rather than left to be discovered.
- **The recorded spans do not belong to the recorded turn.** The span rows were captured from a
  different run than the event stream, so the ids do not line up. The panel renders a true span
  tree from a true recording; it is not the tree of *that* turn. The banner already says the whole
  build is a replay, and the alternative — fabricating rows that match — is the §5 failure.
- **Fixture drift.** If a recording is re-recorded and its shape changes, the demo breaks the same
  way the contract tests do, which is the correct blast radius.
