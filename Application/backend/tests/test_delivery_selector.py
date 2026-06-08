"""infra-005 — provider selector (get_delivery_port) keyed on DELIVERY_PROVIDER."""

from __future__ import annotations

import pytest

from app.infra.config import get_settings
from app.infra.delivery import get_delivery_port
from app.infra.delivery.mock import MockDeliveryAdapter


def _base_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///./selector-test.sqlite3")
    monkeypatch.setenv("SESSION_SECRET", "test-secret")
    # get_delivery_port is lru_cached on the app-wide singleton; clear both caches
    # so each test re-reads the provider it sets.
    get_settings.cache_clear()
    get_delivery_port.cache_clear()


def test_selector_returns_mock_adapter_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DELIVERY_PROVIDER", "mock")
    _base_env(monkeypatch)

    assert isinstance(get_delivery_port(), MockDeliveryAdapter)


def test_selector_rejects_unknown_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DELIVERY_PROVIDER", "fedex")
    _base_env(monkeypatch)

    with pytest.raises(RuntimeError):
        get_delivery_port()
