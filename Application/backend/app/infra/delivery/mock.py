"""Mock delivery adapter: the backend's DeliveryPort implementation that talks
to the standalone delivery-mock HTTP service (Application/delivery_mock).

The real provider would be a sibling adapter selected via DELIVERY_PROVIDER.
"""

from __future__ import annotations

from dataclasses import asdict

import httpx

from app.infra.delivery.port import (
    DeliveryError,
    DeliveryReference,
    DeliveryStatus,
    OrderForDispatch,
)

__all__ = ["DeliveryError", "MockDeliveryAdapter"]


class MockDeliveryAdapter:
    """Implements DeliveryPort against the delivery-mock service over HTTP."""

    def __init__(
        self,
        base_url: str,
        timeout: float,
        *,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._client = httpx.Client(base_url=base_url, timeout=timeout, transport=transport)

    def request(self, order: OrderForDispatch) -> DeliveryReference:
        try:
            resp = self._client.post("/deliveries", json=asdict(order))
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise DeliveryError(str(exc)) from exc
        return DeliveryReference(reference=resp.json()["reference"])

    def status(self, reference: str) -> DeliveryStatus:
        try:
            resp = self._client.get(f"/deliveries/{reference}")
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise DeliveryError(str(exc)) from exc
        body = resp.json()
        return DeliveryStatus(reference=reference, state=body["state"], raw=body)
