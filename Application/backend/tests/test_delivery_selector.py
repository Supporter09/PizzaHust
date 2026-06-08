"""infra-005 — provider selector (get_delivery_port) keyed on DELIVERY_PROVIDER."""

from __future__ import annotations

import pytest

from app.infra.config import get_settings
from app.infra.delivery import get_delivery_port
from app.infra.delivery.mock import MockDeliveryAdapter


def _base_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///./selector-test.sqlite3")
    monkeypatch.setenv("SESSION_SECRET", "test-secret")
    get_settings.cache_clear()


def test_selector_returns_mock_adapter_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    _base_env(monkeypatch)
    monkeypatch.setenv("DELIVERY_PROVIDER", "mock")
    get_settings.cache_clear()

    assert isinstance(get_delivery_port(), MockDeliveryAdapter)


def test_selector_rejects_unknown_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    _base_env(monkeypatch)
    monkeypatch.setenv("DELIVERY_PROVIDER", "fedex")
    get_settings.cache_clear()

    with pytest.raises(RuntimeError):
        get_delivery_port()
