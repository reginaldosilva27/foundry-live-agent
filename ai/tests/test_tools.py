"""Tests for the client-side function tools (spec 002 AC1-AC6, spec 013 AC1-AC9)."""

import ast
import json
from pathlib import Path

import httpx
import pytest

from harness._shared.tools import registry as reg
from harness._shared.tools.datetime_tool import get_current_datetime
from harness._shared.tools.knowledge_tool import (
    KnowledgeSource,
    LocalMarkdownKnowledge,
    Passage,
    lookup_knowledge,
)
from harness._shared.tools.web_search_tool import (
    SearchBackend,
    SearchError,
    SearchResult,
    TavilySearch,
    search_web,
)

# --- AC1: get_current_datetime --------------------------------------------


def test_returns_time_for_a_known_zone():
    result = get_current_datetime("America/Sao_Paulo")
    assert result["timezone"] == "America/Sao_Paulo"
    assert result["iso"].startswith("20")
    assert "error" not in result


def test_includes_the_utc_offset():
    result = get_current_datetime("America/Sao_Paulo")
    # Sao Paulo is behind UTC; the sign matters more than the exact hours.
    assert result["utc_offset"].startswith("-")


def test_unknown_zone_returns_a_structured_error_not_an_exception():
    # An exception here would become a tool call nobody answers, hanging the run for 10 minutes.
    result = get_current_datetime("Mars/Olympus_Mons")
    assert result["error"] == "unknown_timezone"
    assert "Mars/Olympus_Mons" in result["message"]


def test_empty_zone_is_an_error_not_a_crash():
    assert get_current_datetime("")["error"] == "unknown_timezone"


def test_utc_is_supported():
    assert get_current_datetime("UTC")["timezone"] == "UTC"


# --- AC2: lookup_knowledge -------------------------------------------------


@pytest.fixture
def corpus(tmp_path: Path) -> Path:
    (tmp_path / "harnesses.md").write_text(
        "# Harnesses\n\nA harness runs the agent loop.\n\n"
        "## Prompt agent\n\nFoundry runs the loop for a prompt agent.\n"
    )
    (tmp_path / "tracing.md").write_text(
        "# Tracing\n\nSpans land in Application Insights.\n\n"
        "## Gateway\n\nThe gateway does not log tool traces.\n"
    )
    return tmp_path


def test_finds_a_passage_and_attributes_its_source(corpus):
    result = lookup_knowledge("prompt agent loop", source=LocalMarkdownKnowledge(corpus))
    assert result["passages"], "expected at least one hit"
    assert result["passages"][0]["source"] == "harnesses.md"


def test_ranks_the_better_match_first(corpus):
    result = lookup_knowledge("gateway tool traces", source=LocalMarkdownKnowledge(corpus))
    assert result["passages"][0]["source"] == "tracing.md"


def test_no_match_returns_empty_not_an_error(corpus):
    result = lookup_knowledge("kubernetes helm chart", source=LocalMarkdownKnowledge(corpus))
    assert result["passages"] == []
    assert "error" not in result


def test_empty_corpus_returns_empty_not_an_error(tmp_path):
    result = lookup_knowledge("anything", source=LocalMarkdownKnowledge(tmp_path))
    assert result["passages"] == []
    assert "error" not in result


def test_blank_query_returns_empty(corpus):
    assert lookup_knowledge("   ", source=LocalMarkdownKnowledge(corpus))["passages"] == []


# --- AC3: the knowledge source is swappable -------------------------------


def test_swapping_knowledge_source_needs_no_tool_change():
    """Foundry IQ later is a second KnowledgeSource, nothing more."""

    class StubSource:
        def search(self, query: str, limit: int) -> list[Passage]:
            return [Passage(text=f"answer to {query}", source="stub://iq", score=1.0)]

    assert isinstance(StubSource(), KnowledgeSource)
    result = lookup_knowledge("anything", source=StubSource())
    assert result["passages"][0]["source"] == "stub://iq"


# --- AC4: the registry -----------------------------------------------------


def test_registry_exposes_the_three_tools():
    assert set(reg.tool_names()) == {"get_current_datetime", "lookup_knowledge", "search_web"}


def test_registry_resolves_a_name_to_a_callable():
    spec = reg.get("get_current_datetime")
    assert spec.call(timezone="UTC")["timezone"] == "UTC"


def test_unknown_tool_raises_a_typed_error_naming_it():
    with pytest.raises(reg.UnknownToolError, match="drop_database"):
        reg.get("drop_database")


# --- spec 013 AC1-AC3, AC8: search_web over a swappable backend -----------


class StubBackend:
    """A backend that answers from a script. Honestly a stub — see constitution §5."""

    def __init__(self, results: list[SearchResult] | None = None, error: SearchError | None = None):
        self.results = results or []
        self.error = error
        self.calls: list[tuple[str, int]] = []

    def search(self, query: str, limit: int) -> list[SearchResult]:
        self.calls.append((query, limit))
        if self.error is not None:
            raise self.error
        return self.results


HIT = SearchResult(
    title="Foundry Agent Service overview",
    url="https://learn.microsoft.com/azure/foundry/agents/overview",
    content="Foundry Agent Service runs the agent loop for you.",
    score=0.94,
)


def test_returns_results_with_source_and_score():
    result = search_web("what is foundry agent service", backend=StubBackend([HIT]))
    assert result["query"] == "what is foundry agent service"
    assert result["results"] == [
        {
            "title": HIT.title,
            "url": HIT.url,
            "content": HIT.content,
            "score": 0.94,
        }
    ]
    assert "error" not in result


def test_no_results_is_empty_not_an_error():
    """ "I searched and found nothing" is an answer; an error invites a pointless retry."""
    result = search_web("a phrase nobody has ever written", backend=StubBackend([]))
    assert result["results"] == []
    assert "error" not in result


@pytest.mark.parametrize("query", ["", "   ", "\n\t"])
def test_blank_query_is_rejected_without_calling_the_backend(query):
    backend = StubBackend([HIT])
    result = search_web(query, backend=backend)
    assert result["error"] == "invalid_query"
    assert backend.calls == [], "a blank query must not cost a credit"


def test_swapping_search_backend_needs_no_tool_change():
    """A second provider is another SearchBackend, nothing more."""

    class Braveish:
        def search(self, query: str, limit: int) -> list[SearchResult]:
            return [SearchResult(title="t", url="https://example.test", content="c", score=1.0)]

    assert isinstance(Braveish(), SearchBackend)
    assert search_web("anything", backend=Braveish())["results"][0]["url"] == "https://example.test"


def test_a_backend_failure_becomes_a_result_never_an_exception():
    """The rule that matters most here: an unanswered function call hangs the run for 10 minutes."""
    backend = StubBackend(error=SearchError("search_failed", "the provider fell over"))
    result = search_web("anything", backend=backend)
    assert result["error"] == "search_failed"
    assert "fell over" in result["message"]
    assert result["results"] == []


# --- spec 013 AC4-AC7: the Tavily backend's failure surface ----------------


def _tavily(handler, api_key: str = "tvly-test") -> TavilySearch:
    """A TavilySearch whose transport is a MockTransport — real httpx objects, no network."""
    return TavilySearch(api_key, client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_missing_api_key_returns_search_unavailable(monkeypatch):
    """AC4 — unconfigured is a state the agent can describe, not a startup failure."""
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    result = reg.get("search_web").call(query="anything")
    assert result["error"] == "search_unavailable"
    assert "TAVILY_API_KEY" in result["message"]


def test_sends_the_documented_request():
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"query": "q", "results": []})

    _tavily(handler).search("q", limit=5)

    assert seen["url"] == "https://api.tavily.com/search"
    assert seen["auth"] == "Bearer tvly-test"
    assert seen["body"] == {"query": "q", "max_results": 5, "search_depth": "basic"}


def test_parses_the_documented_response_shape():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "query": "q",
                "results": [
                    {
                        "title": "Result",
                        "url": "https://example.test/a",
                        "content": "a snippet",
                        "score": 0.81,
                        "raw_content": None,
                    }
                ],
                "response_time": 1.2,
            },
        )

    results = _tavily(handler).search("q", limit=5)
    assert results == [
        SearchResult(title="Result", url="https://example.test/a", content="a snippet", score=0.81)
    ]


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (401, "search_auth_failed"),
        (429, "search_rate_limited"),
        (432, "search_quota_exceeded"),
        (433, "search_quota_exceeded"),
        (500, "search_http_error"),
    ],
)
def test_provider_http_errors_map_to_distinct_codes(status, code):
    """AC5 — the agent can say *what* failed, so the user knows whether to retry."""
    handler = lambda request: httpx.Response(status, json={"detail": "nope"})  # noqa: E731
    with pytest.raises(SearchError) as excinfo:
        _tavily(handler).search("q", limit=5)
    assert excinfo.value.code == code


@pytest.mark.parametrize(
    "boom",
    [
        httpx.TimeoutException("timed out"),
        httpx.ConnectError("no route to host"),
    ],
)
def test_timeout_and_connection_failure_return_search_failed(boom):
    def handler(request: httpx.Request) -> httpx.Response:
        raise boom

    with pytest.raises(SearchError) as excinfo:
        _tavily(handler).search("q", limit=5)
    assert excinfo.value.code == "search_failed"


@pytest.mark.parametrize(
    "body",
    [
        {"results": [{"url": "https://example.test"}]},  # no title, no content, no score
        {"results": "not a list"},
        {"unexpected": True},
        [1, 2, 3],
    ],
)
def test_malformed_response_body_is_an_error_not_a_keyerror(body):
    """AC7 — the provider changing shape must not crash a turn."""
    handler = lambda request: httpx.Response(200, json=body)  # noqa: E731
    with pytest.raises(SearchError) as excinfo:
        _tavily(handler).search("q", limit=5)
    assert excinfo.value.code == "search_malformed_response"


def test_search_web_over_the_real_backend_still_returns_a_dict():
    """The two halves compose: a transport failure is a dict by the time the executor sees it."""
    handler = lambda request: httpx.Response(401, json={"detail": "bad key"})  # noqa: E731
    assert search_web("q", backend=_tavily(handler))["error"] == "search_auth_failed"


# --- AC5: schemas are valid Foundry FunctionTool shapes --------------------


def test_every_schema_is_a_valid_function_tool_shape():
    for name in reg.tool_names():
        schema = reg.get(name).schema
        assert schema["type"] == "object", name
        assert isinstance(schema["properties"], dict) and schema["properties"], name
        assert isinstance(schema["required"], list) and schema["required"], name
        assert schema["additionalProperties"] is False, name
        for prop in schema["required"]:
            assert prop in schema["properties"], f"{name}: required {prop} not declared"
        for prop, body in schema["properties"].items():
            assert "type" in body and "description" in body, f"{name}.{prop}"


# --- AC6: no tool module decides anything (constitution §8) ----------------


TOOLS_DIR = Path(__file__).resolve().parent.parent / "harness" / "_shared" / "tools"
FORBIDDEN = ("azure", "openai", "adapter", "contract", "agent_spec")


def _imported_modules(path: Path) -> set[str]:
    tree = ast.parse(path.read_text())
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
    return found


def test_no_tool_module_imports_an_agent_model_or_sibling_tool():
    """§8: the app executes tools, it never decides which one to call.

    A tool that can reach the agent, the model SDK, or another tool is one refactor away from
    deciding something. Cheapest guard is to make that import impossible to add quietly.
    """
    offenders = []
    for module in TOOLS_DIR.glob("*.py"):
        if module.name in {"registry.py", "__init__.py"}:
            continue  # the registry's whole job is to know the tools
        for imported in _imported_modules(module):
            if any(bad in imported.lower() for bad in FORBIDDEN):
                offenders.append(f"{module.name} imports {imported}")
    assert not offenders, "tool modules must not reach the agent or each other: " + "; ".join(
        offenders
    )


def test_no_tool_module_branches_on_a_tool_name():
    """A tool referencing another tool's name is tool selection in disguise.

    "Its own" names come from the module's own function definitions, so a module mentioning the
    function it defines is fine; mentioning a sibling's is not.
    """
    names = set(reg.tool_names())
    for module in TOOLS_DIR.glob("*.py"):
        if module.name in {"registry.py", "__init__.py"}:
            continue
        text = module.read_text()
        defined = {
            node.name for node in ast.walk(ast.parse(text)) if isinstance(node, ast.FunctionDef)
        }
        for other in names - defined:
            assert other not in text, f"{module.name} references sibling tool {other!r}"
