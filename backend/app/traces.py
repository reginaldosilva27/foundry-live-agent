"""Reading a run's spans back out of Application Insights (spec 005).

Everything Azure about tracing lives here, so the router stays a router and the browser stays
credential-free. `DefaultAzureCredential` like every other Azure call in this project — the
workspace is read with the BFF's own identity and the resource id never leaves the process.

**The join is `gen_ai.response.id`**, verified against the live service on 2026-09-16 and recorded
in `docs/REFERENCES.md`. Every span Foundry writes carries the exact `resp_…` the `trace_ids` event
already gave the frontend, so a turn finds its spans by the id it already holds; nothing is derived.

**One query, not two.** Resolving the trace id and then fetching the trace is two round trips
against a store that is still ingesting, and a run can land between them — id found, spans not. The
`let` below resolves the operation and selects its spans in one answer, so the result is always
internally consistent.

Foundry traces what *Foundry* runs. A function tool this app executes leaves no span, which is
constitution §8 showing up in telemetry; `kind` exists so the panel can say so rather than leaving
the reader to read the gap as data loss.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

__all__ = [
    "Span",
    "Trace",
    "TraceUnavailable",
    "build_trace_reader",
    "read_trace",
    "TRACE_QUERY",
]


class TraceUnavailable(RuntimeError):
    """Asked for a trace on a BFF that has no Application Insights configured."""


class QueryClient(Protocol):
    """What this module needs of a log query client: one KQL in, rows out."""

    def __call__(self, kql: str) -> list[dict[str, Any]]: ...


@dataclass(frozen=True)
class Span:
    name: str
    span_id: str
    parent_id: str
    duration_ms: float
    #: Milliseconds after the run's earliest span — what puts bars on a shared axis (AC2).
    start_ms: float
    #: ``agent`` for the run, ``model`` for a chat call, ``tool`` for a Foundry-side tool call.
    kind: str


@dataclass(frozen=True)
class Trace:
    status: str
    otel_trace_id: str = ""
    spans: list[Span] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)
    model: str = ""
    agent_version: str = ""
    message: str = ""


#: Resolve the run's operation and return its spans, in one answer.
#:
#: ``dependencies`` is the only table Foundry writes to — no ``requests``, ``traces`` or
#: ``customEvents`` rows appear at all (verified 2026-09-16). The 24-hour window is a guard against
#: scanning the workspace, not a retention policy: a reader looking at a turn is looking at a turn
#: from this session.
TRACE_QUERY = """
let op = toscalar(
    dependencies
    | where timestamp > ago(24h)
    | where tostring(customDimensions['gen_ai.response.id']) == '{response_id}'
    | take 1
    | project operation_Id
);
dependencies
| where timestamp > ago(24h)
| where operation_Id == op
| project timestamp, name, id, operation_Id, operation_ParentId, duration, customDimensions
| order by timestamp asc
"""


def build_trace_reader(settings: Any) -> QueryClient | None:
    """A query client, or ``None`` when this BFF has no Application Insights.

    ``None`` is the same answer `build_synthesizer` and `build_connect` give, and the router turns
    it into *unavailable* rather than into a failure — so a checkout with no tracing configured runs
    the whole app normally (AC4, AC19).
    """
    resource_id = getattr(settings, "appinsights_resource_id", "")
    if not resource_id:
        return None

    def query(kql: str) -> list[dict[str, Any]]:
        # Imported here so the dependency is needed only by a deployment that configures tracing.
        from azure.identity import DefaultAzureCredential
        from azure.monitor.query import LogsQueryClient, LogsQueryStatus

        client = LogsQueryClient(DefaultAzureCredential())
        response = client.query_resource(resource_id, kql, timespan=timedelta(days=1))
        tables = (
            response.tables
            if response.status == LogsQueryStatus.SUCCESS
            else (response.partial_data or [])
        )
        return [
            dict(zip(table.columns, row, strict=False)) for table in tables for row in table.rows
        ]

    return query


def read_trace(query: QueryClient | None, response_id: str) -> Trace:
    """One run's spans, or a named reason there are none.

    Four outcomes, each its own answer and none an exception the caller must catch: ``ok``,
    ``pending`` (ingestion has not caught up — not the same as a run with no spans), ``denied``
    (which names the role to grant, because the operator can act on that one) and ``failed``.
    """
    if query is None:
        raise TraceUnavailable("no Application Insights resource is configured")

    try:
        rows = query(TRACE_QUERY.format(response_id=response_id))
    except PermissionError as exc:
        return Trace(
            status="denied",
            message=f"{exc}. Log Analytics Reader on the workspace is required.",
        )
    except Exception as exc:  # noqa: BLE001 - every failure is reported, never swallowed (§5)
        return Trace(status="failed", message=f"{type(exc).__name__}: {exc}")

    if not rows:
        return Trace(status="pending")

    return _build(rows)


def _build(rows: list[dict[str, Any]]) -> Trace:
    started = min(_timestamp(row) for row in rows)
    spans = [
        Span(
            name=_span_name(row),
            span_id=str(row.get("id") or ""),
            parent_id=str(row.get("operation_ParentId") or ""),
            duration_ms=float(row.get("duration") or 0.0),
            start_ms=(_timestamp(row) - started).total_seconds() * 1000,
            kind=_kind(row),
        )
        for row in rows
    ]
    # The model call is where Foundry reports what the run cost; the agent span carries what ran.
    chat = next((row for row in rows if _kind(row) == "model"), {})
    agent = next((row for row in rows if _kind(row) == "agent"), {})

    return Trace(
        status="ok",
        otel_trace_id=str(rows[0].get("operation_Id") or ""),
        spans=spans,
        usage=_usage(_dimensions(chat)),
        model=str(_dimensions(chat or agent).get("gen_ai.response.model") or ""),
        agent_version=str(_dimensions(agent).get("gen_ai.agent.version") or ""),
    )


def _dimensions(row: dict[str, Any]) -> dict[str, Any]:
    """`customDimensions` arrives as a dict from a recording and as JSON text from the service."""
    raw = row.get("customDimensions") or {}
    if isinstance(raw, str):
        import json

        return json.loads(raw or "{}")
    return raw


def _kind(row: dict[str, Any]) -> str:
    operation = str(_dimensions(row).get("gen_ai.operation.name") or "")
    if operation == "invoke_agent":
        return "agent"
    if operation == "chat":
        return "model"
    # `execute_tool` is the only other one this project has observed, and it appears exclusively
    # for tools Foundry itself runs.
    return "tool" if str(row.get("name", "")).startswith("execute_tool") else "other"


def _span_name(row: dict[str, Any]) -> str:
    """`execute_tool mcp_x.y` -> `mcp_x.y`; everything else keeps the name it was given.

    The prefix is the operation, which `kind` already carries — repeating it in the label would
    spend a third of a 320px column saying the same thing twice.
    """
    name = str(row.get("name") or "")
    prefix = "execute_tool "
    return name[len(prefix) :] if name.startswith(prefix) else name


def _usage(dimensions: dict[str, Any]) -> dict[str, int]:
    """Token counts, omitting each one the spans did not report (§5 — absent is not zero)."""
    keys = {
        "input_tokens": "gen_ai.usage.input_tokens",
        "output_tokens": "gen_ai.usage.output_tokens",
        "cached_tokens": "gen_ai.usage.cached_tokens",
    }
    return {
        name: int(dimensions[key])
        for name, key in keys.items()
        if dimensions.get(key) not in (None, "")
    }


def _timestamp(row: dict[str, Any]) -> datetime:
    """Log Analytics returns seven fractional digits; `fromisoformat` accepts exactly six."""
    raw = row.get("timestamp")
    if isinstance(raw, datetime):
        return raw
    text = str(raw or "").replace("Z", "+00:00")
    match = re.fullmatch(r"(.*?)\.(\d+)(.*)", text)
    if match:
        head, digits, rest = match.groups()
        text = f"{head}.{digits[:6].ljust(6, '0')}{rest}"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return datetime.now(UTC)
