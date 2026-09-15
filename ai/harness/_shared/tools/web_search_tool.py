"""`search_web` — a client-side function tool over a pluggable web search backend.

This is the repo's third *kind* of function tool, and the reason it exists. Its siblings are a pure
function and a reader of local files; neither shows what a client-side tool actually looks like in
production: a call to a **third-party network service** that can be slow, rate limited, out of
credits, or simply not configured on this machine.

(Those siblings go unnamed on purpose. A tool module that can name another tool is one refactor away
from choosing between them, which is the agent loop leaking out of Foundry — so a test asserts that
no module in this package mentions a sibling's name. Constitution §8.)

Two things follow, and they are the whole design:

**Nothing raises past :func:`search_web`.** Every failure — no key, a timeout, a 401, a 429, a body
in an unexpected shape — comes back as a *result* describing what went wrong. A tool that raises
produces a function call nobody answers, and Foundry waits on an unanswered call until the run
expires ten minutes later: from the browser, the stream simply stops. An error the agent can read
aloud is strictly better than silence.

**The seam is :class:`SearchBackend`.** Today it is Tavily; tomorrow it is whatever you like.
Swapping them changes one class — not the tool, not its schema, not its registration. It is also
what lets the test suite exercise the behaviour without spending a credit per run, or hand-writing a
response body and passing it off as a real one (constitution §5).

API details — endpoint, auth header shape, request fields, response fields, the 432/433 status codes
— are taken from the Tavily `POST /search` reference read on 2026-09-15 and recorded in
`docs/REFERENCES.md`. None of it is written from memory.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

import httpx

__all__ = [
    "SCHEMA",
    "SearchBackend",
    "SearchError",
    "SearchResult",
    "TavilySearch",
    "search_web",
]

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": (
                "What to search the web for, in natural language. Use for current events, "
                "third-party products and anything that may have changed recently."
            ),
        }
    },
    "required": ["query"],
    "additionalProperties": False,
}

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

# Documented status codes worth naming separately, so the agent can tell the user whether waiting
# would help. Everything else collapses into `search_http_error` with the status in the message.
_STATUS_CODES = {
    401: "search_auth_failed",
    429: "search_rate_limited",
    432: "search_quota_exceeded",  # plan limit
    433: "search_quota_exceeded",  # pay-as-you-go limit
}


@dataclass(frozen=True)
class SearchResult:
    """One retrieved page, always carrying the URL it came from."""

    title: str
    url: str
    content: str
    score: float


class SearchError(Exception):
    """A backend failure, carrying a ``code`` the agent can act on."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@runtime_checkable
class SearchBackend(Protocol):
    """Anything that can answer a query with ranked results.

    Implement this to swap providers. Raise :class:`SearchError` for anything that goes wrong;
    returning an empty list means "searched, found nothing", which is not an error.
    """

    def search(self, query: str, limit: int) -> list[SearchResult]: ...


class TavilySearch:
    """The Tavily `/search` endpoint, as one POST.

    The official SDK would wrap this same call in its own exception taxonomy. Here the taxonomy is
    the point, so the call stays visible.
    """

    def __init__(
        self,
        api_key: str,
        *,
        client: httpx.Client | None = None,
        timeout: float = 10.0,
    ) -> None:
        self.api_key = api_key
        self._client = client
        self._timeout = timeout

    def search(self, query: str, limit: int) -> list[SearchResult]:
        if not self.api_key:
            raise SearchError(
                "search_unavailable",
                "web search is not configured: set TAVILY_API_KEY to enable it.",
            )

        payload = {"query": query, "max_results": limit, "search_depth": "basic"}
        headers = {"Authorization": f"Bearer {self.api_key}"}

        try:
            client = self._client or httpx.Client(timeout=self._timeout)
            response = client.post(TAVILY_SEARCH_URL, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise SearchError(
                "search_failed", f"could not reach the search provider: {exc}"
            ) from exc

        if response.status_code >= 400:
            code = _STATUS_CODES.get(response.status_code, "search_http_error")
            raise SearchError(
                code, f"the search provider answered HTTP {response.status_code}."
            ) from None

        return _parse(response)


def _parse(response: httpx.Response) -> list[SearchResult]:
    """Read the documented response shape, or say the shape was wrong.

    A provider is free to change its payload; a turn is not free to crash when it does.
    """
    try:
        body = response.json()
    except ValueError as exc:
        raise SearchError(
            "search_malformed_response", f"the search provider did not return JSON: {exc}"
        ) from None

    if not isinstance(body, dict) or not isinstance(body.get("results"), list):
        raise SearchError(
            "search_malformed_response",
            "the search provider's response had no 'results' list.",
        )

    results: list[SearchResult] = []
    for item in body["results"]:
        if not isinstance(item, dict):
            raise SearchError("search_malformed_response", "a search result was not an object.")
        try:
            results.append(
                SearchResult(
                    title=str(item["title"]),
                    url=str(item["url"]),
                    content=str(item["content"]),
                    score=float(item["score"]),
                )
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise SearchError(
                "search_malformed_response", f"a search result was missing a field: {exc}"
            ) from None

    return results


def search_web(query: str, backend: SearchBackend, limit: int = 5) -> dict[str, Any]:
    """Search the web for ``query`` and return ranked results.

    On success: ``query`` and ``results``, each carrying ``title``, ``url``, ``content`` and
    ``score``. No match is an empty list rather than an error — "I found nothing" is an answer the
    agent can relay, whereas an error invites it to retry a query that will keep finding nothing.

    On failure: ``error``, ``message`` and an empty ``results``. Never raises; see the module
    docstring for why that is not defensive habit.
    """
    if not query or not query.strip():
        return {
            "query": query,
            "results": [],
            "error": "invalid_query",
            "message": "the search query was empty.",
        }

    try:
        found = backend.search(query, limit)
    except SearchError as exc:
        return {"query": query, "results": [], "error": exc.code, "message": exc.message}

    return {
        "query": query,
        "results": [
            {
                "title": result.title,
                "url": result.url,
                "content": result.content,
                "score": round(result.score, 4),
            }
            for result in found
        ],
    }
