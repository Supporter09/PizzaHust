from __future__ import annotations

import pytest

from app.domain.order_state import (
    OrderTransitionError,
    is_terminal,
    status_for_delivery_event,
    transition,
)


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("Received", "Preparing"),
        ("Received", "Cancelled"),
        ("Preparing", "ReadyForDispatch"),
        ("Preparing", "DispatchPending"),
        ("Preparing", "Cancelled"),
        ("DispatchPending", "Delivering"),
        ("DispatchPending", "Cancelled"),
        ("ReadyForDispatch", "Delivering"),
        ("Delivering", "Delivered"),
        ("Delivering", "DeliveryFailed"),
    ],
)
def test_transition_allows_documented_edges(current: str, target: str) -> None:
    assert transition(current, target) == target


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("Received", "Delivered"),
        ("ReadyForDispatch", "Delivered"),
        ("DispatchPending", "Delivered"),
        ("Delivered", "Delivering"),
        ("DeliveryFailed", "Delivering"),
        ("Cancelled", "Preparing"),
    ],
)
def test_transition_rejects_undocumented_edges(current: str, target: str) -> None:
    with pytest.raises(OrderTransitionError):
        transition(current, target)


@pytest.mark.parametrize("status", ["Delivered", "DeliveryFailed", "Cancelled"])
def test_terminal_statuses_are_closed(status: str) -> None:
    assert is_terminal(status)


@pytest.mark.parametrize("status", ["Received", "Preparing", "DispatchPending", "Delivering"])
def test_non_terminal_statuses_are_open(status: str) -> None:
    assert not is_terminal(status)


@pytest.mark.parametrize(
    ("delivery_state", "order_status"),
    [
        ("Accepted", "Delivering"),
        ("PickedUp", "Delivering"),
        ("Delivering", "Delivering"),
        ("Delivered", "Delivered"),
        ("Failed", "DeliveryFailed"),
    ],
)
def test_delivery_events_map_to_order_status(delivery_state: str, order_status: str) -> None:
    assert status_for_delivery_event(delivery_state) == order_status


def test_unknown_delivery_event_is_rejected() -> None:
    with pytest.raises(OrderTransitionError):
        status_for_delivery_event("Paused")
