# Plan: The agent can search the live web

## Approach

A fourth function tool, built in the shape the repo already has, so that reading it teaches the
pattern rather than a new one.

`web_search_tool.py` mirrors `knowledge_tool.py` exactly: a `SearchBackend` **Protocol**, one
implementation (`TavilySearch`), and a module-level `search_web(query, backend)` that turns a query
into a result dict. The registry owns the wiring — it builds the backend from the environment, the
same way `_knowledge_source()` already builds `LocalMarkdownKnowledge` from `KNOWLEDGE_DIR`.

The Protocol is not speculative abstraction: it is the only way to test the tool's behaviour without
either hitting the network on every `pytest` run or hand-writing a fake response and passing it off
as real (§5). A stub backend in a test is honestly a stub; a recorded HTTP body pretending to be a
live search is not.

**Everything that can go wrong returns a dict.** `TavilySearch.search` raises `SearchError` — one
typed exception with a `code` — and `search_web` converts it into `{"error": code, "message": …}`.
Nothing else escapes. This is the same discipline as `get_current_datetime`'s unknown timezone, and
for the same reason, stated in its module docstring: an exception here abandons a function call
Foundry is waiting on, and the run expires ten minutes later looking like a dead stream.

Alternative considered and rejected: the official `tavily-python` SDK. It would add a dependency
that wraps one `POST`, hide the error taxonomy behind its own exceptions, and make the interesting
part — how a client-side tool degrades — unreadable. One `httpx.post` against a documented endpoint
is the teaching artifact.

Alternative considered and rejected: putting `TAVILY_API_KEY` into `backend/app/settings.py`.
`Settings` is "how the BFF reaches Azure", validated by `require_live_settings`. Tool configuration
already lives beside the tools (`KNOWLEDGE_DIR`), and splitting it would fork the answer to "where
is a tool configured" (§4).

## Affected files

- `ai/harness/_shared/tools/web_search_tool.py` — **new.** `SCHEMA`, `SearchResult`, `SearchError`,
  `SearchBackend` (Protocol), `TavilySearch`, `search_web`.
- `ai/harness/_shared/tools/registry.py` — `_search_backend()` reading `TAVILY_API_KEY`;
  `_search_web()` binding it; a third `ToolSpec` entry.
- `ai/harness/prompt_agent/agent.yaml` — `- type: function / name: search_web`, plus an
  `instructions` paragraph distinguishing the three search tools from each other.
- `ai/pyproject.toml` — add `httpx>=0.27` to `dependencies`.
- `ai/tests/test_tools.py` — new AC1–AC9 tests; **update** `test_registry_exposes_both_tools`, which
  asserts the registry holds exactly two tools and must now assert three.
- `ai/tests/test_web_search_integration.py` — **new.** The real-network test, skipped unless
  `RUN_INTEGRATION_TESTS=1` **and** `TAVILY_API_KEY` are both set (§5).
- `ai/tests/test_agent_spec.py` — AC10: the shipped `agent.yaml` declares `search_web`.
- `backend/tests/test_tool_executor.py` — AC11: the executor round-trips `search_web` unchanged.
- `.env.example` — the `TAVILY_API_KEY` block, with the non-Azure exception stated.
- `docs/REFERENCES.md` — the Tavily API page, read 2026-09-15.
- `ai/harness/_shared/tools/knowledge/tools.md` — "three tools" → four; describe `search_web`. This
  file is also the corpus `lookup_knowledge` searches, so it is data as well as docs.
- `docs/architecture.md`, `ai/harness/prompt_agent/README.md`, `README.md`, `README.pt-BR.md`,
  `CHANGELOG.md` — wherever the tool list is enumerated (§4).

## Contract / data model changes (constitution §4)

| Fact | Single source of truth | Must move with it |
|---|---|---|
| The tool's name, description, JSON schema | `registry.py` `_REGISTRY` | `agent.yaml` (name only — cross-checked at load) |
| The tool's behaviour and error taxonomy | `web_search_tool.py` | `ai/tests/test_tools.py` |
| `TAVILY_API_KEY` | `.env.example` | `registry.py` (the only reader), `README`s |
| Tavily endpoint, auth header, request/response shape | `docs/REFERENCES.md` | `web_search_tool.py` (cites it in the docstring) |
| "the agent has N tools" | `tools.md` (the knowledge corpus) | `architecture.md`, both READMEs, `agent.yaml` instructions |

No `AgentEvent` change (§9). No recorded fixture changes. No migration.

## i18n strings (constitution §7)

**n/a.** No new user-facing string. `ToolRow` renders `activity.name` and the executor tag from the
existing `EXECUTOR_TAG` map; a fourth function tool renders through the same path as the other two.
Preserving that is a design outcome worth naming: the UI was built to describe *tool calls*, not
*these particular tools*.

## Test strategy (constitution §2 — TDD)

Unit tests drive everything through the `SearchBackend` seam, so the suite never touches the network.
The one test that does is gated and skipped by default.

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | `test_returns_results_with_source_and_score` | `ai/tests/test_tools.py` |
| AC2 | `test_no_results_is_empty_not_an_error` | `ai/tests/test_tools.py` |
| AC3 | `test_blank_query_is_rejected_without_calling_the_backend` | `ai/tests/test_tools.py` |
| AC4 | `test_missing_api_key_returns_search_unavailable` | `ai/tests/test_tools.py` |
| AC5 | `test_provider_http_errors_map_to_distinct_codes` (401/429/500, parameterised) | `ai/tests/test_tools.py` |
| AC6 | `test_timeout_and_connection_failure_return_search_failed` | `ai/tests/test_tools.py` |
| AC7 | `test_malformed_response_body_is_an_error_not_a_keyerror` | `ai/tests/test_tools.py` |
| AC8 | `test_swapping_search_backend_needs_no_tool_change` | `ai/tests/test_tools.py` |
| AC9 | `test_registry_exposes_the_three_tools` + the existing `test_every_schema_is_a_valid_function_tool_shape` (already loops the whole registry) | `ai/tests/test_tools.py` |
| AC10 | `test_shipped_agent_yaml_declares_web_search` | `ai/tests/test_agent_spec.py` |
| AC11 | `test_executes_search_web_and_returns_json_output` | `backend/tests/test_tool_executor.py` |
| AC12 | the existing `test_no_tool_module_imports_…` / `test_no_tool_module_branches_on_a_tool_name` — they glob `*.py`, so the new module is covered the moment it lands | `ai/tests/test_tools.py` |
| AC13 | `test_real_search_returns_results` (skipped without `RUN_INTEGRATION_TESTS=1` + key) | `ai/tests/test_web_search_integration.py` |

HTTP-level tests (AC5–AC7) use `httpx.MockTransport`, which exercises the real `httpx` request and
response objects — not a hand-rolled fake client.

## Risks / trade-offs

- **A key in `.env`.** Called out in the spec; mitigated by scope (non-Azure service, server-side
  only, placeholder in `.env.example`) and by saying so where a reader will hit it.
- **Latency inside a turn.** A `basic` search is typically ~1–3s, spent while Foundry holds the run
  open. The 10-second timeout is well inside the 10-minute expiry, so the worst case is a slow turn
  that still completes, never a hung one.
- **Cost.** One credit per search, on the agent's discretion. Worth stating in `.env.example`; the
  free tier is generous and nothing here loops.
- **`agent.yaml` is not live until applied.** Declaring the tool changes the file; `just agent`
  creates the new agent version. Until then the code is dormant — correct, tested, unused.
- **The provider can change its response shape.** AC7 is the insurance: an unexpected body is an
  error result, not a crash, and the integration test is what would catch it for real.
