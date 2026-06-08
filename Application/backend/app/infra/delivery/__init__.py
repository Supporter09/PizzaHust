"""Delivery port selection.

`get_delivery_port` returns the adapter named by DELIVERY_PROVIDER. The mock is
the default; a real provider would be added as another branch. Routers depend on
this (`Depends(get_delivery_port)`) so tests can override the port.
"""

from __future__ import annotations

from app.infra.config import get_settings
from app.infra.delivery.mock import MockDeliveryAdapter
from app.infra.delivery.port import DeliveryPort


def get_delivery_port() -> DeliveryPort:
    settings = get_settings()
    if settings.delivery_provider == "mock":
        return MockDeliveryAdapter(
            base_url=settings.delivery_base_url,
            timeout=settings.delivery_timeout_seconds,
        )
    raise RuntimeError(f"unknown DELIVERY_PROVIDER: {settings.delivery_provider!r}")
