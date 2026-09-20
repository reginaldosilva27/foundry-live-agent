"""`GET /trace/{response_id}` — one run's spans, or a named reason there are none.

The browser asks by the `response_id` it already has from the `trace_ids` event; the BFF owns the
credential, the resource id and the KQL. Nothing here decides anything — it hands the reader's
answer back as JSON (§8).
"""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Request

from app.traces import read_trace

router = APIRouter()


@router.get("/trace/{response_id}")
def trace(response_id: str, request: Request) -> dict:
    """The run's spans.

    A BFF with no Application Insights answers `unavailable` rather than failing: tracing is
    additive, and a checkout without it must run the whole app normally (AC4, AC19).
    """
    query = request.app.state.read_trace
    if query is None:
        return {"status": "unavailable", "spans": []}
    return asdict(read_trace(query, response_id))
