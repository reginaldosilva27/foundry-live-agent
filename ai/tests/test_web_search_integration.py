"""The one web-search test that touches the real internet (spec 013, AC13).

Constitution §5: external dependencies are exercised **for real** where feasible, and skipped —
never faked — when the credentials are absent. Everything else in the suite runs against a stub or
a `MockTransport`, which is honest about being one. This file is the counterweight: it is the only
place that proves the request this repo actually sends is a request Tavily actually accepts.

Run it with:

    RUN_INTEGRATION_TESTS=1 TAVILY_API_KEY=tvly-... pytest ai/tests/test_web_search_integration.py
"""

import os

import pytest

from harness._shared.tools.web_search_tool import TavilySearch, search_web

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_INTEGRATION_TESTS") != "1" or not os.environ.get("TAVILY_API_KEY"),
    reason="needs RUN_INTEGRATION_TESTS=1 and a real TAVILY_API_KEY",
)


@pytest.fixture
def backend() -> TavilySearch:
    return TavilySearch(os.environ["TAVILY_API_KEY"])


def test_a_real_search_returns_usable_results(backend):
    result = search_web("Microsoft Foundry Agent Service", backend=backend)

    assert "error" not in result, result
    assert result["results"], "a mainstream query returning nothing means the request was wrong"

    for hit in result["results"]:
        assert hit["url"].startswith("http"), hit
        assert hit["title"]
        assert isinstance(hit["score"], float)


def test_the_result_limit_is_respected(backend):
    assert len(search_web("azure", backend=backend, limit=3)["results"]) <= 3


def test_a_bad_key_is_reported_as_an_auth_failure():
    """Proves the 401 mapping against the live service, not against our own mock."""
    result = search_web("anything", backend=TavilySearch("tvly-definitely-not-a-real-key"))
    assert result["error"] == "search_auth_failed"
