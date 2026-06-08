from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class OrderForDispatch:
    order_code: str
    recipient_name: str
    recipient_phone: str
    address: str
    cod_amount_vnd: int
    pickup_address: str


@dataclass(frozen=True)
class DeliveryReference:
    reference: str


@dataclass(frozen=True)
class DeliveryStatus:
    reference: str
    state: str  # Accepted | PickedUp | Delivering | Delivered | Failed
    raw: dict[str, object]


class DeliveryError(Exception):
    """Provider unreachable or returned an error. Adapters raise this so callers
    map a failed handoff to a retryable 502 instead of advancing the order."""


class DeliveryPort(Protocol):
    def request(self, order: OrderForDispatch) -> DeliveryReference: ...
    def status(self, reference: str) -> DeliveryStatus: ...
