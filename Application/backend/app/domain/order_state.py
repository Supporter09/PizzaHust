from __future__ import annotations

from enum import StrEnum


class OrderState(StrEnum):
    RECEIVED = "Received"
    PREPARING = "Preparing"
    DISPATCH_PENDING = "DispatchPending"
    READY_FOR_DISPATCH = "ReadyForDispatch"
    DELIVERING = "Delivering"
    DELIVERED = "Delivered"
    DELIVERY_FAILED = "DeliveryFailed"
    CANCELLED = "Cancelled"


class OrderTransitionError(ValueError):
    pass


_ALLOWED_TRANSITIONS: frozenset[tuple[str, str]] = frozenset(
    {
        (OrderState.RECEIVED.value, OrderState.PREPARING.value),
        (OrderState.RECEIVED.value, OrderState.CANCELLED.value),
        (OrderState.PREPARING.value, OrderState.READY_FOR_DISPATCH.value),
        (OrderState.PREPARING.value, OrderState.DISPATCH_PENDING.value),
        (OrderState.PREPARING.value, OrderState.CANCELLED.value),
        (OrderState.DISPATCH_PENDING.value, OrderState.DELIVERING.value),
        (OrderState.DISPATCH_PENDING.value, OrderState.CANCELLED.value),
        (OrderState.READY_FOR_DISPATCH.value, OrderState.DELIVERING.value),
        (OrderState.DELIVERING.value, OrderState.DELIVERED.value),
        (OrderState.DELIVERING.value, OrderState.DELIVERY_FAILED.value),
    }
)

_TERMINAL_STATES = frozenset(
    {
        OrderState.DELIVERED.value,
        OrderState.DELIVERY_FAILED.value,
        OrderState.CANCELLED.value,
    }
)

_DELIVERY_EVENT_TO_STATUS = {
    "Accepted": OrderState.DELIVERING.value,
    "PickedUp": OrderState.DELIVERING.value,
    "Delivering": OrderState.DELIVERING.value,
    "Delivered": OrderState.DELIVERED.value,
    "Failed": OrderState.DELIVERY_FAILED.value,
}


def transition(current: str, target: str) -> str:
    if (current, target) not in _ALLOWED_TRANSITIONS:
        raise OrderTransitionError(f"Illegal order transition: {current} -> {target}")
    return target


def is_terminal(status: str) -> bool:
    return status in _TERMINAL_STATES


def status_for_delivery_event(delivery_state: str) -> str:
    try:
        return _DELIVERY_EVENT_TO_STATUS[delivery_state]
    except KeyError:
        raise OrderTransitionError(f"Unknown delivery state: {delivery_state}") from None
