# Spec: Demo mode — the whole app, with no Azure credential

| | |
|---|---|
| **ID** | 050-demo-mode |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-20 |
| **Clarified** | 2026-09-20 |

## Problem / motivation

This repository is teaching material, and **nobody can look at it without an Azure subscription.**

Before a reader sees one streamed token they need: a subscription, a Foundry resource, a project, a
model deployment, an Application Insights resource, RBAC on all of it, and `apply_agent.py`. And
`infra/` ships no IaC — `just infra` prints manual steps, for the honest reason spec 000 gave (§5:
do not ship IaC nobody verified). So the README's *Quickstart (10 minutes)* is ten minutes for
somebody who already has a Foundry project, and an afternoon for everybody else. For a workshop, a
classroom, a conference talk or a first-time reader on a Sunday, the cost is the whole thing.

Meanwhile the material to answer that already sits in the repository. `ai/tests/fixtures/recorded/`
holds whole turns **recorded from real Foundry runs** — reasoning summaries, the function-call
round trip, MCP calls, usage, trace ids — and `appinsights-spans-20260916.jsonl` holds the spans of
one of them. The contract tests replay them in CI with no credential today. What is missing is not
data. It is a way to point the running application at the data.

And the seam exists. `create_app` already takes `stream_factory`, `agent_lister`, `trace_query` and
four more, because that is how the suite runs credential-free. A demo is those seams, pointed at the
recordings, behind their own entrypoint.

## Goals

- `git clone` → one command → the app running, streaming, with tool calls and traces, on a machine
  with no Azure account and no `az login`.
- The reader **chooses which recorded turn to watch**, by what it demonstrates.
- It is impossible to mistake a replay for a live agent, at any moment, on any screen.
- No demo code on the production path — no environment variable can make a real deployment serve a
  recording.

## Non-goals

- Answering an arbitrary question. A recording cannot, and the app must say so rather than imply
  otherwise.
- Voice. A Voice Live session is a live WebRTC negotiation with a live service; a replayed one would
  be a drawing of a feature (§5). The voice button reports "not configured", which is true.
- Speech synthesis, for the same reason.
- Provisioning, IaC, or anything that makes the *real* path shorter. This spec makes the **reading**
  path shorter and changes nothing about the deployed one.
- A hosted demo on the public internet. This is a thing you run locally.

## User-facing behavior

Running the demo command starts the BFF against the recordings and the UI against that BFF. The
reader opens the app and finds it working:

- **A banner, on every screen, always.** It says this build is replaying a conversation recorded
  against a real Foundry project on a given date, that the answer does not depend on what is typed,
  and that nothing is being sent anywhere. It cannot be dismissed — a dismissed banner is a banner
  that is not there when the screenshot is taken.
- **A picker for the recorded turn**, listing what each one demonstrates: the function-call round
  trip with MCP, the same turn with no reasoning summaries, the spoken preamble before a tool call,
  a hosted-agent turn with no `mcp_call` at all. Choosing one decides what the next question
  replays.
- **The chat behaves exactly as it does live** — tokens arrive over SSE at the pace they were
  recorded, the activity rows fill in, the tool round trip happens, the sources strip settles, the
  cost line renders, the event inspector shows the real events.
- **The agents screen lists recorded agents**: a prompt agent, a hosted one, and one this build has
  no harness for — dimmed, with its reason — so the inspector, the favourites, the picker and the
  comparison all have something true to show.
- **The trace panel shows a real span tree**, read from the recorded Application Insights rows.
- **The tool playground runs for real.** The clock and the knowledge base need no credential and no
  network; `search_web` answers `search_unavailable`, which is the most instructive output it has.

All new prose ships `en` + `pt` (§7).

## Acceptance criteria

1. **AC1** — The demo entrypoint builds a working application with **no Azure credential and no
   network**: asserted by building it with the environment stripped of every `FOUNDRY_*`,
   `AZURE_*` and `VOICELIVE_*` variable, and streaming a whole turn to `done`.
2. **AC2** — Nothing in the production entrypoint imports, references or can reach the demo module
   (asserted over the import graph, not by reading it). No environment variable turns a real BFF
   into a replaying one.
3. **AC3** — A replayed turn emits the identical `AgentEvent` sequence the harness emits for that
   recording: same types, same order, one `usage`, one terminal. The contract is not relaxed for the
   demo (§9).
4. **AC4** — `GET /config` reports that this build is a replay, with the date the recording was
   made. A build that is not a replay reports the field absent, never `false` for a live one — and
   `/about` renders it, like every other field it returns (spec 032, AC1).
5. **AC5** — The banner is present on every screen, in both languages, and there is no control that
   removes it (asserted).
6. **AC6** — The turn the demo replays is the one the reader picked, and what each option
   demonstrates is read from the recordings' own catalogue rather than from a list kept in the UI
   (§4).
7. **AC7** — What the reader typed does not change the answer, and the app says so rather than
   letting them discover it.
8. **AC8** — `GET /agents` serves a recorded listing containing at least one prompt agent, one
   hosted agent, and at least one row that cannot be chosen, carrying its refusal **code** (not
   prose, §7). *Amended during implementation:* the draft said "one agent with no harness", and the
   recorded project has none — every one of its ten agents is a kind this build can drive. The row
   that cannot be chosen is the hosted one, and its reason is `demo_not_recorded`. Writing a
   fixture that contained a harness-less agent to satisfy the original wording would have been the
   §5 failure this repository names most often.
9. **AC9** — `GET /trace/{id}` serves the recorded spans, and the panel renders a tree with more
   than one span. `tracing.enabled` is true, because in this build it is.
10. **AC10** — The playground is enabled and `search_web` returns `search_unavailable` rendered
    verbatim, not as an error (spec 042, AC5, unchanged).
11. **AC11** — Voice and speech report **not configured**, exactly as they do in any deployment that
    has not configured them. Nothing is faked (§5).
12. **AC12** — The recordings are read from `ai/tests/fixtures/recorded/`, the same files the
    contract tests replay. No fixture is copied, reshaped or written for the demo (§4, §5).
13. **AC13** — One documented command starts it, and it is in the `justfile` beside the others.
14. **AC14** — Every new user-facing string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **`AgentEvent` (§9)** | **Unchanged.** The demo produces the same nine event types, because it feeds the *same normaliser* the live path uses — that is the whole design. A new event type here would mean the demo was not exercising the real thing. |
| **`GET /config`** | Gains one top-level key saying this build is a replay and when it was recorded. `backend/app/routers/config.py` is the source of truth and `frontend/src/panes/aboutFields.ts` must move with it in the same change — `About.coverage.test.ts` fails the build otherwise (§4). |
| **Fixtures** | Read-only consumers of `ai/tests/fixtures/recorded/`. The catalogue of what each recording demonstrates becomes data rather than prose in a README, and the README's table is generated from it or asserted against it — two hand-maintained lists of the same eleven files is the drift §4 names. |
| **Harness contract** | The demo injects `stream_factory`; it does **not** add a third harness. `HARNESS_FOR_KIND` is untouched. |
| **Security** | The demo enables the playground, which spends `TAVILY_API_KEY` *if one is configured* — and in a demo checkout none is, which is why `search_unavailable` is the expected output. `SECURITY.md` must say that the demo entrypoint turns a developer surface on, and that it is a local tool. |
| **§8** | The demo chooses no tool and re-prompts nothing. It replays bytes. The **reader** chooses which recording, which is the same "a person chose" that makes spec 019's picker and spec 042's playground legal. |

## Open questions (clarify)

All resolved 2026-09-20.

- [x] **A flag on the production BFF, or its own entrypoint?** → **Its own entrypoint.** A flag puts
      replay code on the production path, and a mistyped environment variable would make a real
      deployment serve a recorded answer as a live one — a lie the reader cannot detect. The cost is
      one more line in the `justfile`, which is nothing against that.
- [x] **How does the demo decide what to answer?** → **The reader picks the turn.** Cycling through
      recordings hides the interesting case behind three uninteresting ones; matching the typed
      question to a recording makes the demo *feel* like it answers, which is the one impression it
      must not give. A picker is honest and is the more useful of the three for teaching.
- [x] **How far beyond the chat?** → The **agents listing**, the **trace spans** and the
      **playground**. All three have recorded or credential-free material behind them, and each one
      switched off would leave a screen saying "not configured" where the repository has the data to
      say something true.

## Out of scope / deferred

- Replaying a **voice** session. The frames are recorded (`voice-live-*.jsonl`) and the temptation is
  real, but a replayed WebRTC negotiation is a different feature and a fake one: there is no audio
  to hear, and a session that reports itself live while nothing is live is the §5 failure this spec
  is otherwise built to avoid.
- Recording new fixtures from the demo. It reads; it never writes one.
- Publishing the demo as a hosted page.
