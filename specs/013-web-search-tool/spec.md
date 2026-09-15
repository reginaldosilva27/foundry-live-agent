# Spec: The agent can search the live web

| | |
|---|---|
| **ID** | 013-web-search-tool |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-15 |

## Problem / motivation

The agent has three tools and none of them can see today's internet.

- `microsoft_learn` (MCP, executed by Foundry) searches **Microsoft documentation only**. Ask it
  about a Databricks release, a competitor's pricing, or a news item and it has nothing.
- `lookup_knowledge` searches **this repository's own markdown corpus** — three files.
- `get_current_datetime` knows what time it is, which only sharpens the problem: the agent can say
  it is September 2026 and still answer from a training set that ended before then.

So the honest answer to "what happened this week" is a refusal, and the dishonest one — the model
answering from memory and sounding confident — is exactly the failure mode constitution §10 was
written about, generalised beyond Foundry.

There is a second, teaching reason. The repo currently demonstrates a function tool that is **pure**
(`get_current_datetime`) and one that reads **local state** (`lookup_knowledge`). Neither shows what
happens when a client-side tool depends on a **third-party network service that can be slow, rate
limited, or unconfigured** — which is what a real function tool almost always is. That failure
surface is the interesting part, and today nothing in this repo exercises it.

## Goals

- The agent can search the live web and answer with **cited** sources it actually retrieved.
- One more tool in the existing shape: implemented once in `ai/harness/_shared/tools/`, registered
  in the registry, declared in `agent.yaml`, executed by the BFF — **no new machinery**.
- Every failure of the third-party service (no key, timeout, 401, 429, 5xx, malformed body) becomes
  a **result the agent can read aloud**, never an exception and never an unanswered call.
- The search backend is swappable without touching the tool, its schema, or its registration —
  the same seam `lookup_knowledge` already has for its knowledge source.

## Non-goals

- **No agent-loop logic** (§8). The tool does not decide when to search, does not re-query on a poor
  result, does not summarise, and does not rank against a follow-up question. Foundry chooses; this
  executes.
- **No page fetching / crawling.** Tavily's `/extract`, `/crawl` and `/map` endpoints are out of
  scope. One endpoint, `/search`.
- **No LLM-generated answer from the search provider.** `include_answer` stays off: a second model
  summarising before our agent sees the sources buries the citation and spends credits to make the
  answer less traceable.
- **No new UI.** A tool call already renders generically (`ToolRow` reads `activity.name`), so this
  ships with zero new user-facing strings — §7 is n/a, and that is a property to preserve, not an
  oversight.
- No caching layer, no retry policy, no result de-duplication across turns.

## Clarified decisions (2026-09-15)

- **An API key is unavoidable here, and that is not a §5 violation.** The repo's "zero secrets" rule
  is about **Azure**: every Azure call authenticates with Entra ID via `DefaultAzureCredential`, and
  `.env.example` says adding a key is a design smell. Tavily is a **third-party, non-Azure** service
  with no Entra path. The key lives in `TAVILY_API_KEY`, read from the environment by the BFF
  process only; `.env` is gitignored, `.env.example` carries a placeholder, and the browser never
  sees it — the tool executes server-side, like every other function tool. `.env.example` states
  this exception and its reason out loud rather than letting a reader think the rule was forgotten.
- **Missing key → a structured error result, not a refusal to start.** The tool is declared in
  `agent.yaml` unconditionally, so conditional registration would make `load_agent_spec` reject a
  perfectly good definition on a machine without a key. Instead the tool answers
  `{"error": "search_unavailable", …}`, exactly as `get_current_datetime` answers an unknown
  timezone. This is the rule that matters most in this repo: a function call Foundry is waiting on
  **must be answered**, or the run hangs until it expires ten minutes later and the browser sees a
  stream that simply stopped.
- **Results only, no provider answer.** `{query, results: [{title, url, content, score}]}`, mirroring
  the shape `lookup_knowledge` already returns for passages. One credit per search.
- **Declared in `agent.yaml` in this change**, with an instruction that tells the agent which of the
  three search tools to reach for. It takes effect in Foundry only after `just agent` applies a new
  agent version.
- **Five results, `basic` depth, a 10-second timeout — fixed, not configurable.** Every knob the API
  exposes is a knob nobody asked for (Working style: no configurability nobody requested). The tool
  takes one argument, `query`.
- **No match is an empty list, not an error.** "I searched and found nothing" is an answer the agent
  can relay; an error invites it to retry a query that will keep finding nothing.

## User-facing behavior

The agent gains a fourth tool. Asking it something that needs the live web produces a `search_web`
row in the conversation — tagged *executed here, by the BFF*, like the other function tools — and an
answer that cites the pages it retrieved. Opening that row in the trace panel shows the query sent
and the results returned.

When `TAVILY_API_KEY` is unset, the agent says web search is not configured and answers from what it
has. Nothing crashes, nothing hangs, and the row shows the call completing with an error result.

No new strings ship: the row is rendered by the existing generic tool UI (§7 n/a).

## Acceptance criteria

1. **AC1** — Given a backend that returns results, when `search_web("query")` runs, then the result
   carries the query and a list of results, each with `title`, `url`, `content` and `score`.
2. **AC2** — Given a backend that returns nothing for the query, when `search_web` runs, then
   `results` is `[]` and the result carries **no** `error` key.
3. **AC3** — Given a blank or whitespace-only query, when `search_web` runs, then it returns a
   structured `invalid_query` error **without calling the backend**.
4. **AC4** — Given `TAVILY_API_KEY` is unset, when `search_web` runs, then it returns
   `error: "search_unavailable"` with a message naming the variable — and raises nothing.
5. **AC5** — Given the provider answers `401`, `429`, or `500`, when `search_web` runs, then each
   comes back as a distinct structured error naming what happened, and nothing propagates.
6. **AC6** — Given the provider times out or the connection fails, when `search_web` runs, then the
   result is a structured `search_failed` error, and nothing propagates.
7. **AC7** — Given the provider answers `200` with a body that is not the documented shape, when
   `search_web` runs, then the result is a structured error rather than a `KeyError`.
8. **AC8** — Given a different search backend satisfying the same protocol, when it is passed to the
   tool, then the tool needs no change — proven by a stub backend in a test.
9. **AC9** — Given the registry, when it is asked for its tools, then `search_web` resolves to a
   callable and its schema is a valid Foundry function-tool shape (object, non-empty `properties`
   and `required`, `additionalProperties: false`, every property typed and described).
10. **AC10** — Given `agent.yaml`, when it is loaded, then it declares `search_web` as a function
    tool and the registry cross-check passes.
11. **AC11** — Given the tool executor, when it is asked to run `search_web` with JSON arguments,
    then it returns an `ExecutionResult` whose `output` is a JSON string — including on failure.
12. **AC12** — Given the tools package, when its source is inspected, then the web-search module
    imports no agent, model SDK or sibling tool and names no sibling tool (§8), as the existing
    guard tests already assert for every module in the package.
13. **AC13** — Given `RUN_INTEGRATION_TESTS=1` and a real `TAVILY_API_KEY`, when the integration
    test runs, then a real search returns at least one result with an `http`-scheme URL. Without
    both, the test **skips** — it is never faked (§5).

## Contract / data impact

- **No `AgentEvent` change.** A new tool travels on the existing `tool_call` / `tool_result` events;
  §9 is untouched and no fixture needs re-recording.
- **The registry is the single source of truth** for what tools exist (§4). The name, description and
  schema are declared there once; `agent.yaml` references the name, and `agent_spec.py` fails at load
  time if the two disagree.
- **New environment variable `TAVILY_API_KEY`** — documented in `.env.example` with the exception
  rationale above. It is read in `ai/harness/_shared/tools/registry.py`, next to `KNOWLEDGE_DIR`,
  which is where tool configuration already lives; it does **not** enter `backend/app/settings.py`,
  because `Settings` describes how the BFF reaches Azure and this is neither.
- **New dependency `httpx>=0.27` in `ai/`** — already a declared dependency of `backend/`, which is
  the process that actually executes tools.
- **`docs/REFERENCES.md`** gains the Tavily API page. §10 is written about Foundry, but its reason —
  no integration detail from memory — applies to any API, so the endpoint, auth header shape, request
  fields and response shape are cited to the page read on 2026-09-15.
- **Docs that enumerate the tools move in the same change** (§4): `ai/harness/_shared/tools/knowledge/tools.md`
  (which currently says "three tools"), `docs/architecture.md`, `README.md` + `README.pt-BR.md`,
  `ai/harness/prompt_agent/README.md`, `CHANGELOG.md`.

## Open questions (clarify before planning)

_None — all resolved above on 2026-09-15._

## Out of scope / deferred

- A second provider behind the same protocol (Brave, SerpAPI, Bing) — the seam exists; nobody asked.
- Moving web search into a Foundry **Toolbox** or an MCP server so Foundry executes it instead of the
  BFF. That is a genuinely interesting comparison and deserves its own spec.
- Domain allow/deny lists, `topic: news`, date-range filters — all supported by the API, none asked
  for.
