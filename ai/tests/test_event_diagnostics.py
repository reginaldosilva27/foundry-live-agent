"""Synthetic privacy/budget probes plus explicitly named, unchanged historical recordings."""

import asyncio
import json
import logging
from pathlib import Path

import pytest

from harness._shared.event_diagnostics import MAX_COUNT, MAX_TYPES, EventDiagnostics
from harness.langgraph import events as hosted
from harness.langgraph.adapter import LangGraphAdapter
from harness.prompt_agent import events as prompt
from harness.prompt_agent.adapter import PromptAgentAdapter


def summaries(caplog):
    return [r.diagnostic for r in caplog.records if hasattr(r, "diagnostic")]


def adapter(kind, factory):
    kwargs = dict(stream_factory=factory, agent_name="local", project_name="local")
    if kind == "prompt_agent":
        return PromptAgentAdapter(executor=lambda *_: ("{}", 0, None), **kwargs)
    return LangGraphAdapter(**kwargs)


def test_collector_bounds_privacy_and_idempotent_flush(caplog):
    caplog.set_level(logging.WARNING)
    collector = EventDiagnostics("prompt_agent")
    for i in range(MAX_TYPES):
        collector.observe(f"secret.type_{i}")
    collector.observe("secret.type_0")
    for i in range(100):
        collector.observe(f"secret.overflow_{i}")
    for value in [None, [], {}, 7, "secret\nvalue", "secret" * 100, "", "é"]:
        collector.observe(value)
    assert len(collector._counts) == MAX_TYPES
    collector.flush()
    collector.flush()
    assert summaries(caplog) == [
        {
            "normalizer": "prompt_agent",
            "types": {f"unmapped_type_{i + 1}": 2 if i == 0 else 1 for i in range(MAX_TYPES)},
            "invalid_type": 8,
            "omitted_occurrences": 100,
            "truncated": True,
            "counts_saturated": False,
        }
    ]
    assert "secret" not in repr([vars(r) for r in caplog.records])
    assert len(collector._counts) == 0


def test_exact_length_boundary_and_turn_local_aliases(caplog):
    for value in ["a" * 96, "b" * 96]:
        collector = EventDiagnostics("prompt_agent")
        collector.observe(value)
        collector.observe("a" * 97)
        collector.flush()
        collector.observe("late.type")
    assert len(summaries(caplog)) == 2
    for report in summaries(caplog):
        assert report["types"] == {"unmapped_type_1": 1}
        assert report["invalid_type"] == 1
        assert not report["truncated"]


@pytest.mark.parametrize("module", [prompt, hosted])
def test_oversized_types_are_not_hashed_for_classification(module, monkeypatch, caplog):
    class KnownTypes:
        def __contains__(self, value):
            assert len(value) <= 96, "oversized type reached vocabulary lookup"
            return False

    monkeypatch.setattr(module, "_KNOWN", KnownTypes())
    assert list(module.normalise([{"type": "a" * 100_000}])) == []
    assert summaries(caplog)[0]["invalid_type"] == 1


@pytest.mark.parametrize("module", [prompt, hosted])
def test_logging_handler_failure_does_not_change_stream(module, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("broken logging sink")

    monkeypatch.setattr("harness._shared.event_diagnostics._LOGGER.warning", fail)
    result = list(
        module.normalise(
            [
                {"type": "unknown.type"},
                {"type": "response.completed", "response": {"id": "resp_local"}},
            ]
        )
    )
    assert result[-1]["type"] == "done"


@pytest.mark.parametrize(
    "module,filename",
    [
        (prompt, "prompt-agent-turn-20260915.jsonl"),
        (hosted, "langgraph-hosted-function-20260916.jsonl"),
        (hosted, "langgraph-hosted-learn-20260916.jsonl"),
    ],
)
def test_known_recordings_emit_no_diagnostics(module, filename, caplog):
    path = Path(__file__).parent / "fixtures" / "recorded" / filename
    raw = [json.loads(line) for line in path.read_text().splitlines() if line]
    assert list(module.normalise(raw))
    assert summaries(caplog) == []


def test_counter_saturates_explicitly(caplog):
    collector = EventDiagnostics("langgraph")
    for _ in range(MAX_COUNT + 2):
        collector.observe("secret.valid")
        collector.observe(None)
    for i in range(MAX_TYPES - 1):
        collector.observe(f"local.type_{i}")
    for _ in range(MAX_COUNT + 2):
        collector.observe("local.overflow")
    collector.flush()
    report = summaries(caplog)[0]
    assert report["types"]["unmapped_type_1"] == MAX_COUNT
    assert report["invalid_type"] == MAX_COUNT
    assert report["omitted_occurrences"] == MAX_COUNT
    assert report["counts_saturated"] and report["truncated"]


@pytest.mark.parametrize("module,name", [(prompt, "prompt_agent"), (hosted, "langgraph")])
def test_mapping_vocabulary_and_malformed_types(module, name, caplog):
    collector = EventDiagnostics(name)
    convert = module.convert if module is prompt else module.Normaliser().convert
    # Every declared type is known, even when its shape is unverified; do not fabricate it.
    for mapping in module.MAPPINGS:
        if mapping.produces == "—":
            assert list(convert({"type": mapping.raw_type}, diagnostics=collector)) == []
    collector.flush()
    assert summaries(caplog) == []
    collector = EventDiagnostics(name)
    for value in [[], {}, None, 10, "secret.new_type"]:
        assert list(convert({"type": value, "output": "secret"}, diagnostics=collector)) == []
    collector.flush()
    assert summaries(caplog)[0]["invalid_type"] == 4
    assert "secret" not in repr([vars(r) for r in caplog.records])


@pytest.mark.parametrize("kind", ["prompt_agent", "langgraph"])
@pytest.mark.parametrize("outcome", ["done", "failure", "close", "cancel"])
async def test_turn_summary_on_every_exit(kind, outcome, caplog):
    def factory(*_):
        yield {"type": "secret.new_type", "arguments": "secret"}
        yield {"type": "response.output_text.delta", "delta": "partial"}
        if outcome == "failure":
            raise RuntimeError("local failure")
        yield {"type": "response.completed", "response": {"id": "resp_local"}}

    stream = adapter(kind, factory).stream_response([], {})
    if outcome in {"close", "cancel"}:
        assert (await anext(stream))["type"] == "text_delta"
        if outcome == "cancel":
            with pytest.raises(asyncio.CancelledError):
                await stream.athrow(asyncio.CancelledError())
        else:
            await stream.aclose()
    else:
        result = [e async for e in stream]
        assert result[-1]["type"] == ("error" if outcome == "failure" else "done")
    assert len(summaries(caplog)) == 1
    assert summaries(caplog)[0]["normalizer"] == kind
    assert summaries(caplog)[0]["types"] == {"unmapped_type_1": 1}
    assert "secret" not in repr([vars(r) for r in caplog.records])


async def test_prompt_one_budget_across_tool_legs(caplog):
    legs = iter(
        [
            [
                {"type": "secret.type"},
                {
                    "type": "response.output_item.done",
                    "item": {
                        "type": "function_call",
                        "name": "local",
                        "call_id": "call_local",
                        "arguments": "{}",
                    },
                },
                {"type": "response.completed", "response": {"id": "r1"}},
            ],
            [{"type": "secret.type"}, {"type": "response.completed", "response": {"id": "r2"}}],
        ]
    )
    result = [
        e async for e in adapter("prompt_agent", lambda *_: next(legs)).stream_response([], {})
    ]
    assert result[-1]["type"] == "done"
    assert sum(e["type"] == "done" for e in result) == 1
    assert summaries(caplog)[0]["types"] == {"unmapped_type_1": 2}
    assert len(summaries(caplog)) == 1


@pytest.mark.parametrize("module", [prompt, hosted])
def test_whole_stream_helpers_have_diagnostics(module, caplog):
    result = list(
        module.normalise(
            [
                {"type": "secret.type"},
                {"type": "response.completed", "response": {"id": "resp_local"}},
            ]
        )
    )
    assert result[-1]["type"] == "done"
    assert len(summaries(caplog)) == 1
