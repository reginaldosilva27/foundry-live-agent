"""A response id is untrusted input, and it used to be pasted into KQL.

`GET /trace/{response_id}` takes the id straight from the URL and `read_trace` put it inside a
single-quoted KQL literal with `str.format`. A quote in that value closes the literal, and whatever
follows is query text.

Why this one matters more than an ordinary injection: the identity running the query is the BFF's
own, holding **Log Analytics Reader on the workspace**, and the workspace is where Foundry writes
prompts, tool arguments and tool results — `SECURITY.md` says so itself, under *telemetry is treated
as production data*. This application has no notion of a user and no sign-in, so *anyone who can
reach the BFF* could read that workspace. It is also a plain correctness bug: an id carrying a quote
produced a KQL syntax error the screen reported as a failed query.

The rule the fix applies is **not a claim about Foundry's id format** (§10 — nothing here was read
from a doc). It is a bound on what this app is willing to put into a query: an id is an opaque
token, and a token that cannot appear inside a KQL string literal is refused before the query is
built, not escaped on the way in. Escaping is the thing that gets subtly wrong; refusing is not.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.traces import read_trace

#: Each of these closes the literal or ends the statement. None of them may reach the service.
BREAKOUTS = [
    "resp_1' | union *",
    "resp_1' or '1'=='1",
    "resp_1'); dependencies | project customDimensions //",
    "resp_1\\' | take 100",
    'resp_1" | project *',
    "resp_1\n| project *",
    "resp_1 | where 1==1",
]

#: Shapes an opaque id plausibly takes. These must keep working.
ACCEPTED = [
    "resp_04b4b55f493a2180006aaa767bc2c481908506094053fc1588",
    "resp-with-dashes",
    "resp.with.dots",
    "RESP_UPPER_123",
]


def _recording():
    """A query client that records the KQL it was handed and answers nothing."""
    sent: list[str] = []

    def query(kql: str) -> list[dict]:
        sent.append(kql)
        return []

    return query, sent


@pytest.mark.parametrize("response_id", BREAKOUTS)
def test_an_id_that_could_break_the_query_never_reaches_the_service(response_id: str):
    query, sent = _recording()

    result = read_trace(query, response_id)

    assert sent == [], f"the query was built and sent with {response_id!r} in it"
    assert result.status == "failed"


@pytest.mark.parametrize("response_id", ACCEPTED)
def test_an_ordinary_id_is_still_queried(response_id: str):
    query, sent = _recording()

    result = read_trace(query, response_id)

    assert len(sent) == 1
    assert response_id in sent[0]
    # Nothing was found for it here, which is `pending`, not a refusal.
    assert result.status == "pending"


def test_an_empty_id_is_refused_rather_than_scanning_the_workspace():
    query, sent = _recording()

    assert read_trace(query, "").status == "failed"
    assert sent == []


def test_the_route_refuses_it_too_and_says_so_in_a_state_the_screen_renders():
    """End to end: the refusal arrives as one of the four statuses the drawer already knows."""
    query, sent = _recording()
    app = create_app(trace_query=query, appinsights_resource_id="/subscriptions/x/rg/y")

    with TestClient(app) as client:
        body = client.get("/trace/resp_1' | union *").json()

    assert body["status"] == "failed"
    assert body["spans"] == []
    assert sent == []
