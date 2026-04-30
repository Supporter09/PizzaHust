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


class DeliveryPort(Protocol):
    def request(self, order: OrderForDispatch) -> DeliveryReference: ...
    def status(self, reference: str) -> DeliveryStatus: ...
