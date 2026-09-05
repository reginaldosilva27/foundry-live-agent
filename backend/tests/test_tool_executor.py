"""Tool execution (spec 003, AC3-AC5).

The rule under test: **a collected call is always answered.** Success, exception, unknown name,
malformed arguments -- every path produces an output to send back. Foundry waits on an unanswered
function call until the run expires ten minutes later, and from the browser that looks like the
stream simply stopped.
"""

import json

from app.tool_executor import execute


def test_executes_a_real_tool_and_returns_its_output():
    result = execute("get_current_datetime", '{"timezone": "UTC"}')
    assert result.ok
    assert json.loads(result.output)["timezone"] == "UTC"
    assert result.error is None


def test_records_how_long_it_took():
    assert execute("get_current_datetime", '{"timezone": "UTC"}').duration_ms >= 0


def test_unknown_tool_name_is_answered_not_raised():
    result = execute("drop_database", "{}")
    assert not result.ok
    assert "drop_database" in result.error
    # Still an output the agent can receive -- never an unanswered call.
    assert json.loads(result.output)["error"]


def test_malformed_arguments_are_answered_not_raised():
    result = execute("get_current_datetime", "{not json")
    assert not result.ok
    assert "arguments" in result.error.lower()
    assert json.loads(result.output)["error"]


def test_a_tool_that_raises_is_answered_not_propagated(monkeypatch):
    from harness._shared.tools import registry

    def explode(**_):
        raise RuntimeError("disk on fire")

    monkeypatch.setattr(registry, "get", lambda name: registry.ToolSpec(name, "", {}, explode))
    result = execute("get_current_datetime", "{}")
    assert not result.ok
    assert "disk on fire" in result.error
    assert json.loads(result.output)["error"]


def test_wrong_argument_names_are_answered_not_raised():
    result = execute("get_current_datetime", '{"tz": "UTC"}')
    assert not result.ok
    assert json.loads(result.output)["error"]


def test_output_is_always_a_json_string():
    """Foundry's function_call_output takes a string; every path must produce one."""
    for name, args in [
        ("get_current_datetime", '{"timezone": "UTC"}'),
        ("nope", "{}"),
        ("get_current_datetime", "{bad"),
    ]:
        assert isinstance(execute(name, args).output, str)
        json.loads(execute(name, args).output)
