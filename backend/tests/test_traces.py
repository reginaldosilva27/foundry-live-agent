"""Spec 005 — reading a run's spans back out of Application Insights.

The query client is injected, so the KQL the BFF *would* send and the shape it makes of the answer
are both asserted without a credential — the same pattern `stream_factory`, `voice_connect` and
`synthesize` already use.

**The rows are a recording, not a hand-written shape** (§5). They come from
`ai/tests/fixtures/recorded/appinsights-spans-20260916.jsonl`, captured from this project's own runs
on 2026-09-16. The fixture lives under `ai/` because what it records is Foundry's behaviour, which
is that layer's subject; reading it from here is the lesser evil against keeping two copies (§4).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.traces import TraceUnavailable, build_trace_reader, read_trace

FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "ai"
    / "tests"
    / "fixtures"
    / "recorded"
    / "appinsights-spans-20260916.jsonl"
)

# The three runs the recording covers.
FUNCTION_TOOL_RUN = "resp_04b4b55f493a2180006aaa767bc2c481908506094053fc1588"
MCP_RUN = "resp_091ce0a85788cf3d006aaa76f17ab48190ba280143c9a03f6d"


def recorded_rows() -> list[dict]:
    return [json.loads(line) for line in FIXTURE.read_text().splitlines() if line.strip()]


def fake_client(rows: list[dict] | None = None, error: Exception | None = None):
    """A query client that replays recorded rows for whichever response id is asked for."""
    sent: list[str] = []

    def query(kql: str) -> list[dict]:
        sent.append(kql)
        if error is not None:
            raise error
        if rows is not None:
            return rows
        # Mimic the real query: everything belonging to the operation the response id names.
        wanted = next((rid for rid in (FUNCTION_TOOL_RUN, MCP_RUN) if rid in kql), None)
        traces = {
            r["operation_Id"]
            for r in recorded_rows()
            if r["customDimensions"].get("gen_ai.response.id") == wanted
        }
        return [r for r in recorded_rows() if r["operation_Id"] in traces]

    return query, sent


class TestSpansComeBackAsATree:
    def test_a_run_resolves_to_its_spans(self):
        """AC1 — name, ids, parent and duration for every span of the run."""
        query, _ = fake_client()

        result = read_trace(query, FUNCTION_TOOL_RUN)

        assert result.status == "ok"
        assert {s.name for s in result.spans} == {
            "invoke_agent foundry-live-agent:3",
            "chat gpt-5.5-2026-04-24",
        }
        root = next(s for s in result.spans if s.name.startswith("invoke_agent"))
        child = next(s for s in result.spans if s.name.startswith("chat"))
        assert child.parent_id == root.span_id
        assert root.duration_ms == pytest.approx(1063.1, abs=0.5)

    def test_the_otel_trace_id_is_the_operation_id(self):
        """AC6' — what fills the panel's `otel trace id`."""
        query, _ = fake_client()

        assert read_trace(query, FUNCTION_TOOL_RUN).otel_trace_id == (
            "7188bc6ee8025f42326d4764fdee7714"
        )

    def test_spans_carry_a_start_offset_from_the_first_span(self):
        """AC2 — a shared axis needs offsets, which the rows give only as timestamps."""
        query, _ = fake_client()

        result = read_trace(query, MCP_RUN)

        assert min(s.start_ms for s in result.spans) == 0
        assert all(s.start_ms >= 0 for s in result.spans)

    def test_a_foundry_side_tool_call_gets_its_own_span(self):
        """AC17 — the duration an MCP call never had in the event stream."""
        query, _ = fake_client()

        tools = [s for s in read_trace(query, MCP_RUN).spans if s.kind == "tool"]

        assert len(tools) == 2
        assert all(s.name.startswith("mcp_microsoft_learn.") for s in tools)
        assert sorted(round(s.duration_ms) for s in tools) == [97, 106]

    def test_a_client_side_tool_call_gets_no_span(self):
        """AC13 — the §8 boundary, showing up in telemetry.

        The function-tool run called `get_current_datetime`, which the BFF executed. Foundry traces
        what Foundry runs, so there is no span for it — and the panel must be able to say so.
        """
        query, _ = fake_client()

        assert [s for s in read_trace(query, FUNCTION_TOOL_RUN).spans if s.kind == "tool"] == []


class TestWhatTheRunCost:
    def test_usage_including_prompt_cache_is_read_off_the_spans(self):
        """AC16 — cached tokens, which the event stream never reported."""
        query, _ = fake_client()

        usage = read_trace(query, MCP_RUN).usage

        assert usage["input_tokens"] == 16380
        assert usage["output_tokens"] == 263
        assert usage["cached_tokens"] == 10812

    def test_the_model_snapshot_and_agent_version_come_from_the_spans(self):
        """AC18 — more specific than `GET /config`'s `gpt-5.5`."""
        query, _ = fake_client()

        result = read_trace(query, FUNCTION_TOOL_RUN)

        assert result.model == "gpt-5.5-2026-04-24"
        assert result.agent_version == "3"

    def test_a_run_whose_spans_report_no_usage_omits_it(self):
        """§5 — absent is absent, not zero."""
        rows = [r for r in recorded_rows() if r["name"].startswith("invoke_agent")]
        query, _ = fake_client(rows=rows)

        assert read_trace(query, FUNCTION_TOOL_RUN).usage == {}


class TestEveryFailureIsItsOwnAnswer:
    def test_no_rows_is_pending_not_empty(self):
        """AC3 — ingestion is staggered; a turn queried too early is not a turn with no spans."""
        query, _ = fake_client(rows=[])

        result = read_trace(query, FUNCTION_TOOL_RUN)

        assert result.status == "pending"
        assert result.spans == []

    def test_a_permission_failure_names_the_role(self):
        """AC5 — the operator can act on this one, so it must say what to grant."""
        query, _ = fake_client(error=PermissionError("(403) Forbidden"))

        result = read_trace(query, FUNCTION_TOOL_RUN)

        assert result.status == "denied"
        assert "Log Analytics Reader" in result.message

    def test_any_other_failure_reports_its_reason(self):
        """AC5 — and never as a silent empty tree."""
        query, _ = fake_client(error=RuntimeError("ThrottledError"))

        result = read_trace(query, FUNCTION_TOOL_RUN)

        assert result.status == "failed"
        assert "ThrottledError" in result.message

    def test_an_unconfigured_bff_has_no_reader_at_all(self):
        """AC4, AC19 — `None`, like `build_synthesizer` and `build_connect` before it."""
        from app.settings import load_settings

        assert build_trace_reader(load_settings(appinsights_resource_id="")) is None

    def test_asking_an_unconfigured_reader_is_a_typed_refusal(self):
        with pytest.raises(TraceUnavailable):
            read_trace(None, FUNCTION_TOOL_RUN)


class TestTheQueryItself:
    def test_it_filters_by_the_response_id_attribute(self):
        """O-B, answered against the live service: `gen_ai.response.id` is the join."""
        query, sent = fake_client()

        read_trace(query, FUNCTION_TOOL_RUN)

        assert "gen_ai.response.id" in sent[0]
        assert FUNCTION_TOOL_RUN in sent[0]

    def test_it_asks_once_so_the_answer_cannot_be_half_ingested(self):
        """The plan's one-round-trip decision, pinned: two queries race each other."""
        query, sent = fake_client()

        read_trace(query, FUNCTION_TOOL_RUN)

        assert len(sent) == 1


class TestTheEndpoint:
    """Spec 005 AC4, AC9, AC19 — `GET /trace/{response_id}`, and a BFF without tracing."""

    BASE = {
        "project_endpoint": "https://example.services.ai.azure.com/api/projects/proj",
        "project_name": "proj",
        "agent_name": "foundry-live-agent",
        "model": "conn/gpt-4o",
        "harness": "prompt-agent",
    }

    def client(self, **overrides):
        from fastapi.testclient import TestClient

        from app.main import create_app

        query, _ = fake_client()
        app = create_app(
            stream_factory=lambda _i, _s: iter(()),
            # A BFF with no resource id gets no reader, exactly as production would build it.
            trace_query=query if overrides.get("appinsights_resource_id") else None,
            **{**self.BASE, **overrides},
        )
        return TestClient(app)

    def test_it_serves_a_run_s_spans(self):
        response = self.client(appinsights_resource_id="/subscriptions/s/rg/x").get(
            f"/trace/{FUNCTION_TOOL_RUN}"
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["otel_trace_id"] == "7188bc6ee8025f42326d4764fdee7714"
        assert len(body["spans"]) == 2
        assert body["spans"][0]["kind"] == "agent"

    def test_a_bff_without_tracing_says_so_rather_than_failing(self):
        """AC4, AC19 — an answer, not a 500, and the rest of the app untouched."""
        client = self.client()

        response = client.get(f"/trace/{FUNCTION_TOOL_RUN}")

        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        # The app is otherwise entirely normal.
        assert client.get("/config").status_code == 200

    def test_config_reports_tracing_without_leaking_where_it_lives(self):
        """AC9 — the browser learns *that* tracing works, never the resource id."""
        body = self.client(appinsights_resource_id="/subscriptions/s/rg/x").get("/config").json()

        assert body["tracing"] == {"enabled": True, "gateway_logged": False}
        assert "/subscriptions/" not in response_text(body)

    def test_config_reports_tracing_off_when_it_is(self):
        body = self.client().get("/config").json()

        assert body["tracing"]["enabled"] is False


def response_text(body: object) -> str:
    import json

    return json.dumps(body)
