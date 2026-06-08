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
            return DeliveryReference(reference=resp.json()["reference"])
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            # ValueError covers JSON decode errors; KeyError/TypeError cover a
            # well-formed body that is missing/malformed fields. All are provider
            # faults that must surface as a retryable DeliveryError, not a 500.
            raise DeliveryError(str(exc)) from exc

    def status(self, reference: str) -> DeliveryStatus:
        try:
            resp = self._client.get(f"/deliveries/{reference}")
            resp.raise_for_status()
            body = resp.json()
            return DeliveryStatus(reference=reference, state=body["state"], raw=body)
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            raise DeliveryError(str(exc)) from exc
