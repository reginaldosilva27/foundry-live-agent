# Spec: Suggestions that belong to the agent

| | |
|---|---|
| **ID** | 037-agent-suggestions |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

The empty state offers three suggestions, chosen for a reason that is written down in the component:
one app-executed tool, one Foundry-executed MCP call, and one plain answer. They are good
suggestions. They are also hard-coded in the frontend and identical for every agent in the project.

Spec 019 made ten agents selectable and spec 022 put favourites in the rail, which means the app now
routinely opens on an agent whose tools these three suggestions know nothing about — a workflow agent
belonging to someone else, or the hosted one, whose lesson is a different one. The screen invites the
reader to ask a question the selected agent may not be equipped for, which is the opposite of what an
empty state is for.

There is a §4 argument underneath. What an agent is good at is a property of the agent, and the
agent's definition is `agent_core.yaml` and each harness's `agent.yaml`. A list of example questions
living in TypeScript is a second description of the same agent, drifting from the first.

## Goals

- **The empty state's suggestions come from the agent** that is about to answer.
- Agents this repository does not own **degrade to something honest** rather than to the wrong
  suggestions.
- The three existing suggestions **keep their reasoning**, moving rather than disappearing.

## Non-goals

- **No generated suggestions.** The app does not ask a model what to ask it — that is inference the
  app runs on its own behalf, which is the reflex §8 forbids and which spec 021 already refused for
  conversation titles.
- **No suggestions derived from the agent's tool list by the frontend.** Deriving "it has
  `search_web`, so suggest a web question" is the app inventing a description of the agent.
- **No history-based suggestions**, no "you usually ask", no personalisation. The app never decides
  what matters to the reader (022's non-goal, unchanged).
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**The empty state asks the agent that will answer.** When that agent's definition carries example
questions, those are shown, in both languages, because the app is bilingual and so is the agent.

**When it does not** — every agent in the project that this repository did not write — the empty
state shows no suggestions and keeps its headline and subtitle. An empty list is the honest state:
we do not know what that agent is for. It is not an error and says nothing apologetic.

**Switching agents changes the suggestions**, on the same screen, without a reload.

**The three current suggestions move into `agent_core.yaml`** unchanged, so the default deployment
looks exactly as it does today and the reasoning behind the three survives in the file where the
agent is described.

## Acceptance criteria

1. **AC1** — With the answering agent carrying example questions, the empty state renders them.
2. **AC2** — With the answering agent carrying none, the empty state renders no suggestions, keeps
   its headline and subtitle, and shows no error.
3. **AC3** — Switching the answering agent updates the suggestions without a reload.
4. **AC4** — Suggestions render in the interface language, from the definition's own `en` and `pt`
   values (§7).
5. **AC5** — Choosing a suggestion sends it exactly as typing it would, to the answering agent.
6. **AC6** — No suggestion is derived in the frontend from an agent's tools, name or kind
   (asserted).
7. **AC7** — No request to a model is issued to produce a suggestion (asserted — the §8 guard).
8. **AC8** — With the agents listing unavailable, the empty state falls back to the BFF's configured
   agent's suggestions, or to none, and never to a hard-coded list in the frontend.
9. **AC9** — The default deployment renders the same three suggestions it renders today.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **`agent.yaml` schema** | Ours, and it gains an optional block of example questions with `en` and `pt` (§7). `agent_spec.py` validates it; `docs/harness-comparison.md` documents it as our schema, not Microsoft's. |
| **`GET /agents`** | Carries the suggestions per agent, absent when the definition has none. The definition is the source of truth and the frontend holds no list (§4). |
| **Agent definition** | Moving the three suggestions into `agent_core.yaml` means a new version applied for both harnesses. |
| **i18n** | The suggestion strings leave `strings.ts` and live in the agent definition; `strings.test.ts` must not then flag them as missing. |
| **Docs** | `docs/harness-comparison.md` — the schema addition. |

## Open questions (clarify before planning)

- [ ] Do the suggestions travel on `GET /agents` for every agent, or only for the configured one?
      The listing is already the place the frontend learns about agents, which argues for the former.
- [ ] Can the service return example questions for an agent this repository did not create — is
      there a field for it — or is "ours only" a permanent limitation worth stating?
- [ ] How many suggestions, and does the definition cap it or the screen?
- [ ] Does the composer's chip or the agents screen show them too, or only the empty state?

## Out of scope / deferred

- Suggestions after the conversation has started.
- Any generated, ranked or personalised suggestion.
