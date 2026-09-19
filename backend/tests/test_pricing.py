"""Rates live on the BFF, or nowhere (spec 028).

Three states, and the difference between the last two is the whole point of §5: rates configured,
**no rates at all**, and a rate table that is malformed. The second is the out-of-the-box state of
this repository and is not an error; the third is, and it fails at startup rather than rendering a
wrong number at 3pm.
"""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import SettingsError, load_settings

RATES = {"gpt-5.5": {"input": 1.25, "cached_input": 0.125, "output": 10.0}}


def client(**overrides):
    settings = {
        "project_endpoint": "https://example.services.ai.azure.com/api/projects/proj-default",
        "project_name": "proj-default",
        "agent_name": "foundry-live-agent",
        "model": "foundry-analytics-demo/gpt-5.5",
        "harness": "prompt-agent",
        **overrides,
    }
    return TestClient(create_app(stream_factory=lambda *_: iter(()), **settings))


# --- settings --------------------------------------------------------------


def test_rates_parse_from_the_environment(monkeypatch):
    monkeypatch.setenv("MODEL_RATES", json.dumps(RATES))
    monkeypatch.setenv("MODEL_RATES_CURRENCY", "USD")
    monkeypatch.setenv("MODEL_RATES_RECORDED_AT", "2026-09-18")

    settings = load_settings()

    assert settings.model_rates == RATES
    assert settings.rates_currency == "USD"
    assert settings.rates_recorded_at == "2026-09-18"
    assert settings.pricing_enabled is True


def test_no_rates_is_the_default_and_is_not_an_error(monkeypatch):
    monkeypatch.delenv("MODEL_RATES", raising=False)
    settings = load_settings()

    assert settings.model_rates == {}
    assert settings.pricing_enabled is False


def test_a_malformed_table_fails_at_startup_rather_than_at_render(monkeypatch):
    monkeypatch.setenv("MODEL_RATES", "{not json")
    with pytest.raises(SettingsError, match="MODEL_RATES"):
        load_settings()


def test_a_rate_that_is_not_a_number_is_refused(monkeypatch):
    monkeypatch.setenv("MODEL_RATES", json.dumps({"gpt-5.5": {"input": "cheap"}}))
    with pytest.raises(SettingsError, match="MODEL_RATES"):
        load_settings()


def test_rates_without_a_recorded_date_are_refused(monkeypatch):
    """A rate with no date is a number nobody can judge the staleness of (§5)."""
    monkeypatch.setenv("MODEL_RATES", json.dumps(RATES))
    monkeypatch.delenv("MODEL_RATES_RECORDED_AT", raising=False)
    with pytest.raises(SettingsError, match="MODEL_RATES_RECORDED_AT"):
        load_settings()


# --- GET /config -----------------------------------------------------------


def test_config_reports_the_rates_when_they_are_configured():
    body = (
        client(model_rates=RATES, rates_currency="USD", rates_recorded_at="2026-09-18")
        .get("/config")
        .json()
    )

    assert body["pricing"] == {
        "currency": "USD",
        "recorded_at": "2026-09-18",
        "per_tokens": 1_000_000,
        "rates": RATES,
    }


def test_config_omits_the_key_entirely_when_nothing_is_configured():
    """Absent, not empty. `{}` would claim we have a rate table with nothing in it (AC3)."""
    assert "pricing" not in client().get("/config").json()
