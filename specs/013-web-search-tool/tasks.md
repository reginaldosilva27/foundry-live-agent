# Tasks: The agent can search the live web

> Red → green → refactor. Each implementation task is preceded by the test that fails first.

## Tasks

- [x] **T1 — test first**: `ai/tests/test_tools.py` — AC1/AC2/AC3/AC8 against a stub `SearchBackend`
      (results returned, empty results, blank query, swappable backend). Fails: no module.
- [x] **T2 — implement**: `web_search_tool.py` — `SCHEMA`, `SearchResult`, `SearchError`,
      `SearchBackend` Protocol, `search_web(query, backend)`. Makes T1 pass.
- [x] **T3 — test first**: AC5/AC6/AC7 — `TavilySearch` over `httpx.MockTransport`: 401, 429, 500,
      timeout, connection error, malformed 200 body. Each a distinct structured code, none raising.
- [x] **T4 — implement**: `TavilySearch` — one `POST https://api.tavily.com/search`, Bearer auth,
      `max_results=5`, `search_depth="basic"`, 10s timeout, the documented response shape.
- [x] **T5 — test first**: AC4/AC9 — missing `TAVILY_API_KEY` returns `search_unavailable`; the
      registry exposes three tools and resolves `search_web`. Update
      `test_registry_exposes_both_tools` → `test_registry_exposes_the_three_tools`.
- [x] **T6 — implement**: `registry.py` — `_search_backend()` reading `TAVILY_API_KEY`, `_search_web()`,
      the third `ToolSpec`. Add `httpx>=0.27` to `ai/pyproject.toml`.
- [x] **T7 — test first**: AC10 — `test_agent_spec.py` asserts the shipped `agent.yaml` declares
      `search_web` as a function tool.
- [x] **T8 — implement**: `agent.yaml` — declare the tool and add the instruction distinguishing
      `search_web` / `microsoft_learn` / `lookup_knowledge`.
- [x] **T9 — test first + implement**: AC11 — `backend/tests/test_tool_executor.py` round-trips
      `search_web` through `execute()`. No production change expected; the test proves §8 holds —
      the executor gains nothing for a third tool.
- [x] **T10 — integration (§5)**: `ai/tests/test_web_search_integration.py` — AC13, real network,
      skipped unless `RUN_INTEGRATION_TESTS=1` **and** `TAVILY_API_KEY`.
- [x] **T11 — config + references (§4, §10)**: `.env.example` `TAVILY_API_KEY` block with the
      non-Azure exception stated; `docs/REFERENCES.md` gains the Tavily API page, read 2026-09-15.
- [x] **T12 — docs (§4)**: `tools.md` (three → four, and it is also the `lookup_knowledge` corpus),
      `docs/architecture.md`, `ai/harness/prompt_agent/README.md`, `README.md`, `README.pt-BR.md`
      (§7 — both move together), `CHANGELOG.md`, `specs/README.md` index row.
- [x] **T13 — verify**: run the `verify-gates` skill; set `spec.md` status to `done`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean (`ruff check` + `ruff format --check`)
- [x] Tests green (`ai/`, `backend/`, `frontend/`)
- [x] Type-check / build passes
- [x] Docs updated in the same change; the tool list is consistent everywhere (§4)
- [x] §7 — no new user-facing string shipped (verified, not assumed); both READMEs moved together
- [x] §6 — no rule changed, so `CLAUDE.md` / `AGENTS.md` need no edit
- [x] `spec.md` status updated to `done`
